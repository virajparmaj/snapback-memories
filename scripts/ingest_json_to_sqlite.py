#!/usr/bin/env python3
"""
SnapBack JSON-driven ingest pipeline.

Pipeline:
1) Read Snapchat memories_history.json (source of truth).
2) Resolve source media per memory (raw cache -> optional local export -> download URL).
3) Flatten ZIP overlay packages into final media (image/video).
4) Organize output files using deterministic names.
5) Upsert metadata into canonical SQLite manifest.
"""

import argparse
import csv
import hashlib
import json
import re
import shutil
import sqlite3
import subprocess
import uuid
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen

IMAGE_EXTS = {".jpg", ".jpeg", ".png"}
VIDEO_EXTS = {".mp4", ".mov"}
ZIP_EXTS = {".zip"}
MEDIA_EXTS = IMAGE_EXTS | VIDEO_EXTS

CONTENT_TYPE_EXT_MAP = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "application/zip": ".zip",
    "application/x-zip-compressed": ".zip",
}


@dataclass
class MemoryEntry:
    index: int
    stable_id: str
    media_type: str
    captured_at_utc: Optional[datetime]
    latitude: Optional[float]
    longitude: Optional[float]
    location_label: Optional[str]
    download_link: str
    media_download_url: str

    def download_urls(self) -> list[str]:
        urls = [self.media_download_url.strip(), self.download_link.strip()]
        deduped: list[str] = []
        seen = set()
        for url in urls:
            if not url:
                continue
            if url in seen:
                continue
            seen.add(url)
            deduped.append(url)
        return deduped


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_ext(ext: str) -> str:
    ext = ext.lower()
    if ext == ".jpeg":
        return ".jpg"
    return ext


def sanitize_stable_id(raw_id: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]", "_", raw_id.strip())
    if not cleaned:
        raise ValueError("stable id is empty after sanitization")
    return cleaned


def normalize_media_type(raw_type: str) -> str:
    value = (raw_type or "").strip().lower()
    if value in {"image", "photo", "jpg", "jpeg", "png"}:
        return "photo"
    if value in {"video", "mp4", "mov"}:
        return "video"
    return "photo"


def parse_datetime_utc(raw_date: str) -> Optional[datetime]:
    text = (raw_date or "").strip()
    if not text:
        return None
    try:
        return datetime.strptime(text, "%Y-%m-%d %H:%M:%S UTC").replace(tzinfo=timezone.utc)
    except ValueError:
        pass
    try:
        if text.endswith("Z"):
            text = f"{text[:-1]}+00:00"
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except ValueError:
        return None


def parse_lat_lon(location_text: str) -> tuple[Optional[float], Optional[float]]:
    match = re.search(r"([-+]?\d+\.\d+)\s*,\s*([-+]?\d+\.\d+)", location_text or "")
    if not match:
        return None, None
    return float(match.group(1)), float(match.group(2))


def parse_url_param(url: str, key: str) -> Optional[str]:
    if not url:
        return None
    parsed = urlparse(url)
    values = parse_qs(parsed.query).get(key)
    if values and values[0]:
        return values[0]
    return None


def parse_stable_id(download_link: str, media_download_url: str) -> Optional[str]:
    urls = [download_link or "", media_download_url or ""]
    for key in ("mid", "sid"):
        for url in urls:
            value = parse_url_param(url, key)
            if value:
                return value
    return None


def parse_json_entry(raw: dict[str, Any], index: int) -> MemoryEntry:
    download_link = str(raw.get("Download Link", "")).strip()
    media_download_url = str(raw.get("Media Download Url", "")).strip()
    stable_id_raw = parse_stable_id(download_link, media_download_url)
    if not stable_id_raw:
        raise ValueError("missing stable id from URL params (mid/sid)")

    stable_id = sanitize_stable_id(stable_id_raw)
    media_type = normalize_media_type(str(raw.get("Media Type", "")))
    captured_at_utc = parse_datetime_utc(str(raw.get("Date", "")))
    latitude, longitude = parse_lat_lon(str(raw.get("Location", "")))
    location_label = None
    if latitude is not None and longitude is not None:
        location_label = f"{latitude:.6f}, {longitude:.6f}"

    entry = MemoryEntry(
        index=index,
        stable_id=stable_id,
        media_type=media_type,
        captured_at_utc=captured_at_utc,
        latitude=latitude,
        longitude=longitude,
        location_label=location_label,
        download_link=download_link,
        media_download_url=media_download_url,
    )
    if not entry.download_urls():
        raise ValueError("missing download URL")
    return entry


def parse_cli_headers(header_values: list[str]) -> dict[str, str]:
    headers: dict[str, str] = {}
    for header_line in header_values:
        if ":" not in header_line:
            raise ValueError(f"invalid --header value '{header_line}', expected 'Key: Value'")
        key, value = header_line.split(":", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            raise ValueError(f"invalid header key in '{header_line}'")
        headers[key] = value
    return headers


def parse_cookie_file(cookie_file: Path) -> str:
    """
    Parse a Netscape cookie jar and return an HTTP Cookie header value.
    """
    cookies: list[str] = []
    with cookie_file.open("r", encoding="utf-8", errors="ignore") as handle:
        for line in handle:
            text = line.strip()
            if not text or text.startswith("#"):
                continue
            parts = text.split("\t")
            if len(parts) >= 7:
                name = parts[5].strip()
                value = parts[6].strip()
                if name:
                    cookies.append(f"{name}={value}")
    return "; ".join(cookies)


def run_command(cmd: list[str]) -> str:
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        stderr = proc.stderr.strip()[:4000]
        raise RuntimeError(f"command failed ({proc.returncode}): {' '.join(cmd)}\n{stderr}")
    return proc.stdout.strip()


def guess_ext_from_response(url: str, content_type: str, media_type: str) -> str:
    path_ext = normalize_ext(Path(urlparse(url).path).suffix)
    if path_ext in MEDIA_EXTS or path_ext in ZIP_EXTS:
        return path_ext
    if content_type:
        normalized = content_type.split(";", 1)[0].strip().lower()
        if normalized in CONTENT_TYPE_EXT_MAP:
            return CONTENT_TYPE_EXT_MAP[normalized]
    return ".jpg" if media_type == "photo" else ".mp4"


def download_source(
    entry: MemoryEntry, raw_dir: Path, headers: dict[str, str], timeout_sec: int
) -> tuple[Path, str]:
    errors: list[str] = []
    for url in entry.download_urls():
        try:
            request = Request(url, headers=headers)
            with urlopen(request, timeout=timeout_sec) as response:
                content_type = response.headers.get("Content-Type", "")
                ext = guess_ext_from_response(url, content_type, entry.media_type)
                out_path = raw_dir / f"{entry.stable_id}{ext}"
                tmp_path = out_path.with_suffix(out_path.suffix + ".part")
                if tmp_path.exists():
                    tmp_path.unlink()
                with tmp_path.open("wb") as handle:
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        handle.write(chunk)
                tmp_path.replace(out_path)
                host = urlparse(url).netloc
                return out_path, host
        except Exception as exc:
            host = urlparse(url).netloc or "unknown-host"
            errors.append(f"{host}: {exc}")

    joined = " | ".join(errors) if errors else "download failed with no URL attempts"
    raise RuntimeError(joined)


def is_zip_source(path: Path) -> bool:
    if normalize_ext(path.suffix) in ZIP_EXTS:
        return True
    try:
        with path.open("rb") as handle:
            return handle.read(4) == b"PK\x03\x04"
    except OSError:
        return False


def is_overlay_name(path: Path) -> bool:
    name = path.name.lower()
    return ("overlay" in name) or name.endswith("-overlay.png")


def pick_main_and_overlays(extracted_dir: Path) -> tuple[Optional[Path], list[Path]]:
    files = [path for path in extracted_dir.rglob("*") if path.is_file()]
    media = [path for path in files if normalize_ext(path.suffix) in MEDIA_EXTS]

    if not media:
        return None, []

    overlays = [path for path in media if normalize_ext(path.suffix) == ".png" and is_overlay_name(path)]
    mains = [path for path in media if "-main" in path.name.lower() and not is_overlay_name(path)]

    if mains:
        main = sorted(mains, key=lambda path: path.stat().st_size, reverse=True)[0]
    else:
        candidates = [path for path in media if not is_overlay_name(path)]
        main = sorted(candidates, key=lambda path: path.stat().st_size, reverse=True)[0] if candidates else None

    if main is None:
        return None, []

    if not overlays:
        overlays = [
            path
            for path in media
            if normalize_ext(path.suffix) == ".png" and path.resolve() != main.resolve()
        ]

    return main, sorted(overlays, key=lambda path: path.name.lower())


def flatten_image(main_path: Path, overlay_paths: list[Path], out_path: Path) -> None:
    try:
        from PIL import Image
    except ImportError as exc:
        raise RuntimeError("Pillow is required for image overlay flattening (pip install Pillow)") from exc

    base = Image.open(main_path).convert("RGBA")
    for overlay_path in overlay_paths:
        overlay = Image.open(overlay_path).convert("RGBA")
        if overlay.size != base.size:
            overlay = overlay.resize(base.size, Image.Resampling.LANCZOS)
        base = Image.alpha_composite(base, overlay)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    base.convert("RGB").save(out_path, quality=95)


def flatten_video(main_path: Path, overlay_paths: list[Path], out_path: Path, ffmpeg_bin: str) -> None:
    input_args = ["-i", str(main_path)]
    for overlay_path in overlay_paths:
        input_args += ["-loop", "1", "-i", str(overlay_path)]

    filters = []
    last = "[0:v]"
    for index in range(1, len(overlay_paths) + 1):
        out_tag = f"[v{index}]"
        filters.append(f"{last}[{index}:v]overlay=0:0{out_tag}")
        last = out_tag

    cmd = [
        ffmpeg_bin,
        "-y",
        *input_args,
        "-filter_complex",
        ";".join(filters),
        "-map",
        last,
        "-map",
        "0:a?",
        "-shortest",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "18",
        "-preset",
        "veryfast",
        "-c:a",
        "copy",
        str(out_path),
    ]
    out_path.parent.mkdir(parents=True, exist_ok=True)
    run_command(cmd)


def process_zip_source(
    source_zip: Path,
    stable_id: str,
    unzipped_dir: Path,
    composited_dir: Path,
    ffmpeg_bin: str,
    keep_unzipped: bool,
) -> tuple[Path, str]:
    extract_dir = unzipped_dir / stable_id
    if extract_dir.exists():
        shutil.rmtree(extract_dir, ignore_errors=True)
    extract_dir.mkdir(parents=True, exist_ok=True)

    try:
        with zipfile.ZipFile(source_zip, "r") as zip_handle:
            zip_handle.extractall(extract_dir)

        main, overlays = pick_main_and_overlays(extract_dir)
        if main is None:
            raise RuntimeError("zip had no media files")

        main_ext = normalize_ext(main.suffix)
        if not overlays:
            out_path = composited_dir / f"{stable_id}{main_ext}"
            out_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(main, out_path)
            return out_path, "zip_main_only"

        if main_ext in IMAGE_EXTS:
            out_path = composited_dir / f"{stable_id}.jpg"
            flatten_image(main, overlays, out_path)
            return out_path, "zip_flattened_image"

        if main_ext in VIDEO_EXTS:
            out_path = composited_dir / f"{stable_id}.mp4"
            flatten_video(main, overlays, out_path, ffmpeg_bin)
            return out_path, "zip_flattened_video"

        raise RuntimeError(f"unsupported zip main type: {main_ext}")
    finally:
        if not keep_unzipped:
            shutil.rmtree(extract_dir, ignore_errors=True)


def copy_standalone_to_composited(source_path: Path, stable_id: str, composited_dir: Path) -> tuple[Path, str]:
    ext = normalize_ext(source_path.suffix)
    if not ext:
        ext = ".bin"
    out_path = composited_dir / f"{stable_id}{ext}"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_path, out_path)
    return out_path, "standalone_copy"


def deterministic_filename(
    captured_at_utc: Optional[datetime],
    latitude: Optional[float],
    longitude: Optional[float],
    stable_id: str,
    ext: str,
) -> str:
    if captured_at_utc:
        ts = captured_at_utc.strftime("%Y-%m-%d_%H-%M-%SZ")
    else:
        ts = "unknown_time"

    if latitude is not None and longitude is not None:
        loc = f"{latitude:.6f}_{longitude:.6f}"
    else:
        loc = "unknown_loc"

    return f"{ts}__{loc}__{stable_id}{ext}"


def organized_output_path(organized_dir: Path, captured_at_utc: Optional[datetime], filename: str) -> Path:
    if not captured_at_utc:
        return organized_dir / "unknown_date" / filename
    return organized_dir / captured_at_utc.strftime("%Y") / captured_at_utc.strftime("%m") / filename


def probe_duration_seconds(path: Path, ffprobe_bin: str) -> Optional[float]:
    try:
        output = run_command(
            [
                ffprobe_bin,
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ]
        )
        if not output:
            return None
        return float(output)
    except Exception:
        return None


def compute_sha1(path: Path) -> str:
    digest = hashlib.sha1()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS memories (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            filename_original TEXT,
            filepath TEXT NOT NULL,
            captured_at_utc TEXT,
            captured_at_local TEXT,
            timezone_hint TEXT,
            year INTEGER,
            month INTEGER,
            day INTEGER,
            latitude REAL,
            longitude REAL,
            location_label TEXT,
            duration_sec REAL,
            size_bytes INTEGER NOT NULL DEFAULT 0,
            thumbnail_path TEXT,
            thumbnail_url TEXT,
            favorite INTEGER NOT NULL DEFAULT 0,
            tags_json TEXT NOT NULL DEFAULT '[]',
            sha1 TEXT,
            notes TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_memories_date ON memories(captured_at_utc);
        CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
        CREATE INDEX IF NOT EXISTS idx_memories_fav ON memories(favorite);
        CREATE INDEX IF NOT EXISTS idx_memories_ym ON memories(year, month);
        CREATE INDEX IF NOT EXISTS idx_memories_id ON memories(id);

        CREATE TABLE IF NOT EXISTS ingest_runs (
            id TEXT PRIMARY KEY,
            started_at TEXT NOT NULL,
            finished_at TEXT,
            source_json TEXT NOT NULL,
            source_export_root TEXT,
            output_root TEXT NOT NULL,
            stats_json TEXT
        );

        CREATE TABLE IF NOT EXISTS ingest_errors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id TEXT NOT NULL,
            memory_id TEXT,
            stage TEXT NOT NULL,
            message TEXT NOT NULL,
            details_json TEXT
        );
        """
    )
    conn.commit()


def start_ingest_run(
    conn: sqlite3.Connection, run_id: str, source_json: Path, source_export_root: Optional[Path], output_root: Path
) -> None:
    conn.execute(
        """
        INSERT INTO ingest_runs(id, started_at, source_json, source_export_root, output_root, stats_json)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            run_id,
            now_utc_iso(),
            str(source_json),
            str(source_export_root) if source_export_root else None,
            str(output_root),
            None,
        ),
    )
    conn.commit()


def finish_ingest_run(conn: sqlite3.Connection, run_id: str, stats: dict[str, Any]) -> None:
    conn.execute(
        """
        UPDATE ingest_runs
        SET finished_at = ?, stats_json = ?
        WHERE id = ?
        """,
        (now_utc_iso(), json.dumps(stats, sort_keys=True), run_id),
    )
    conn.commit()


def record_ingest_error(
    conn: sqlite3.Connection,
    run_id: str,
    memory_id: Optional[str],
    stage: str,
    message: str,
    details: Optional[dict[str, Any]] = None,
) -> None:
    conn.execute(
        """
        INSERT INTO ingest_errors(run_id, memory_id, stage, message, details_json)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            run_id,
            memory_id,
            stage,
            message,
            json.dumps(details, sort_keys=True) if details else None,
        ),
    )
    conn.commit()


def upsert_memory(conn: sqlite3.Connection, record: dict[str, Any]) -> None:
    conn.execute(
        """
        INSERT INTO memories(
            id, type, filename_original, filepath, captured_at_utc, captured_at_local, timezone_hint,
            year, month, day, latitude, longitude, location_label, duration_sec, size_bytes,
            thumbnail_path, thumbnail_url, favorite, tags_json, sha1, notes, created_at, updated_at
        ) VALUES (
            :id, :type, :filename_original, :filepath, :captured_at_utc, :captured_at_local, :timezone_hint,
            :year, :month, :day, :latitude, :longitude, :location_label, :duration_sec, :size_bytes,
            :thumbnail_path, :thumbnail_url, :favorite, :tags_json, :sha1, :notes, :created_at, :updated_at
        )
        ON CONFLICT(id) DO UPDATE SET
            type = excluded.type,
            filename_original = excluded.filename_original,
            filepath = excluded.filepath,
            captured_at_utc = excluded.captured_at_utc,
            captured_at_local = excluded.captured_at_local,
            timezone_hint = excluded.timezone_hint,
            year = excluded.year,
            month = excluded.month,
            day = excluded.day,
            latitude = excluded.latitude,
            longitude = excluded.longitude,
            location_label = excluded.location_label,
            duration_sec = excluded.duration_sec,
            size_bytes = excluded.size_bytes,
            thumbnail_path = excluded.thumbnail_path,
            thumbnail_url = excluded.thumbnail_url,
            sha1 = excluded.sha1,
            notes = excluded.notes,
            updated_at = excluded.updated_at,
            favorite = memories.favorite,
            tags_json = memories.tags_json
        """,
        record,
    )
    conn.commit()


def build_export_index(export_root: Path) -> dict[str, list[Path]]:
    index: dict[str, list[Path]] = {}
    for path in sorted(export_root.iterdir()):
        if not path.is_file():
            continue
        if path.name.startswith("._"):
            continue
        key = path.stem.lower()
        index.setdefault(key, []).append(path)
    return index


def find_cached_raw(raw_dir: Path, stable_id: str) -> Optional[Path]:
    candidates = [
        path
        for path in sorted(raw_dir.glob(f"{stable_id}.*"))
        if not path.name.endswith(".part")
    ]
    return candidates[0] if candidates else None


def write_log_csv(log_path: Path, rows: list[dict[str, Any]]) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["time_utc", "status", "memory_id", "stage", "detail"],
        )
        writer.writeheader()
        writer.writerows(rows)


def setup_output_dirs(output_root: Path) -> dict[str, Path]:
    dirs = {
        "root": output_root,
        "raw": output_root / "raw",
        "unzipped": output_root / "unzipped",
        "composited": output_root / "composited",
        "organized": output_root / "organized",
        "manifests": output_root / "manifests",
        "logs": output_root / "logs",
    }
    for path in dirs.values():
        path.mkdir(parents=True, exist_ok=True)
    return dirs


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="SnapBack JSON-driven ingest pipeline to SQLite manifest")
    parser.add_argument("--json", required=True, help="Path to memories_history.json")
    parser.add_argument("--output-root", required=True, help="Output root for raw/unzipped/composited/organized/manifests/logs")
    parser.add_argument("--db-path", help="SQLite output path (default: <output-root>/manifests/snapback.db)")
    parser.add_argument("--export-root", help="Optional local Snapchat export dir to reuse existing files before downloading")
    parser.add_argument(
        "--download-mode",
        choices=["missing", "always", "never"],
        default="missing",
        help="missing: download only when no cached/local source; always: force download; never: fail if source missing",
    )
    parser.add_argument("--timeout-sec", type=int, default=120, help="HTTP download timeout in seconds")
    parser.add_argument("--header", action="append", default=[], help="HTTP header, repeatable, format 'Key: Value'")
    parser.add_argument("--cookie-file", help="Netscape cookie jar file, converted to Cookie header")
    parser.add_argument("--ffmpeg-bin", default="ffmpeg", help="ffmpeg binary path")
    parser.add_argument("--ffprobe-bin", default="ffprobe", help="ffprobe binary path")
    parser.add_argument("--keep-unzipped", action="store_true", help="Keep per-memory ZIP extraction folders")
    parser.add_argument("--compute-sha1", action="store_true", help="Compute sha1 for each organized file")
    parser.add_argument("--limit", type=int, help="Optional max number of entries to process")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    json_path = Path(args.json)
    if not json_path.is_file():
        raise FileNotFoundError(f"JSON not found: {json_path}")

    output_root = Path(args.output_root)
    dirs = setup_output_dirs(output_root)

    db_path = Path(args.db_path) if args.db_path else dirs["manifests"] / "snapback.db"
    headers = parse_cli_headers(args.header)
    if args.cookie_file:
        cookie_header = parse_cookie_file(Path(args.cookie_file))
        if cookie_header:
            existing = headers.get("Cookie")
            headers["Cookie"] = f"{existing}; {cookie_header}" if existing else cookie_header

    export_root = Path(args.export_root) if args.export_root else None
    export_index: dict[str, list[Path]] = {}
    if export_root:
        if not export_root.is_dir():
            raise FileNotFoundError(f"export root not found: {export_root}")
        export_index = build_export_index(export_root)

    with json_path.open("r", encoding="utf-8") as handle:
        raw_json = json.load(handle)
    raw_items = raw_json.get("Saved Media")
    if not isinstance(raw_items, list):
        raise RuntimeError("JSON missing expected key: Saved Media[]")

    if args.limit is not None:
        raw_items = raw_items[: args.limit]

    conn = sqlite3.connect(db_path)
    run_id = uuid.uuid4().hex
    ensure_schema(conn)
    start_ingest_run(conn, run_id, json_path, export_root, output_root)

    log_rows: list[dict[str, Any]] = []
    stats = {
        "total_entries": len(raw_items),
        "processed": 0,
        "downloaded": 0,
        "used_cached_raw": 0,
        "used_export_file": 0,
        "zip_processed": 0,
        "errors": 0,
    }

    for index, raw_item in enumerate(raw_items):
        stage = "parse"
        memory_id: Optional[str] = None
        try:
            if not isinstance(raw_item, dict):
                raise ValueError("entry is not a JSON object")

            entry = parse_json_entry(raw_item, index)
            memory_id = entry.stable_id

            source_path: Optional[Path] = None
            source_note = ""
            cached = find_cached_raw(dirs["raw"], entry.stable_id)

            stage = "source_resolve"
            if args.download_mode != "always" and cached:
                source_path = cached
                source_note = "cached_raw"
                stats["used_cached_raw"] += 1
            elif args.download_mode != "always" and export_index.get(entry.stable_id.lower()):
                local_source = export_index[entry.stable_id.lower()][0]
                copied_raw = dirs["raw"] / f"{entry.stable_id}{normalize_ext(local_source.suffix)}"
                shutil.copy2(local_source, copied_raw)
                source_path = copied_raw
                source_note = "export_source"
                stats["used_export_file"] += 1
            else:
                if args.download_mode == "never":
                    raise RuntimeError("source missing and downloads are disabled")
                stage = "download"
                source_path, source_host = download_source(entry, dirs["raw"], headers, args.timeout_sec)
                source_note = f"downloaded:{source_host}"
                stats["downloaded"] += 1

            if source_path is None:
                raise RuntimeError("failed to resolve source file")

            stage = "media_transform"
            if is_zip_source(source_path):
                processed_path, process_note = process_zip_source(
                    source_zip=source_path,
                    stable_id=entry.stable_id,
                    unzipped_dir=dirs["unzipped"],
                    composited_dir=dirs["composited"],
                    ffmpeg_bin=args.ffmpeg_bin,
                    keep_unzipped=args.keep_unzipped,
                )
                stats["zip_processed"] += 1
            else:
                processed_path, process_note = copy_standalone_to_composited(
                    source_path=source_path,
                    stable_id=entry.stable_id,
                    composited_dir=dirs["composited"],
                )

            ext = normalize_ext(processed_path.suffix) or (".jpg" if entry.media_type == "photo" else ".mp4")
            final_name = deterministic_filename(
                captured_at_utc=entry.captured_at_utc,
                latitude=entry.latitude,
                longitude=entry.longitude,
                stable_id=entry.stable_id,
                ext=ext,
            )
            final_path = organized_output_path(dirs["organized"], entry.captured_at_utc, final_name)

            stage = "organize"
            final_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(processed_path, final_path)

            stage = "metadata"
            captured = entry.captured_at_utc
            duration_sec = None
            if entry.media_type == "video":
                duration_sec = probe_duration_seconds(final_path, args.ffprobe_bin)
            sha1 = compute_sha1(final_path) if args.compute_sha1 else None
            file_size = final_path.stat().st_size
            timestamp = now_utc_iso()

            record = {
                "id": entry.stable_id,
                "type": entry.media_type,
                "filename_original": source_path.name,
                "filepath": str(final_path),
                "captured_at_utc": captured.isoformat() if captured else None,
                "captured_at_local": captured.isoformat() if captured else None,
                "timezone_hint": "UTC" if captured else None,
                "year": captured.year if captured else None,
                "month": captured.month if captured else None,
                "day": captured.day if captured else None,
                "latitude": entry.latitude,
                "longitude": entry.longitude,
                "location_label": entry.location_label,
                "duration_sec": duration_sec,
                "size_bytes": file_size,
                "thumbnail_path": None,
                "thumbnail_url": None,
                "favorite": 0,
                "tags_json": "[]",
                "sha1": sha1,
                "notes": f"{source_note}|{process_note}",
                "created_at": timestamp,
                "updated_at": timestamp,
            }

            stage = "sqlite_upsert"
            upsert_memory(conn, record)
            stats["processed"] += 1
            log_rows.append(
                {
                    "time_utc": now_utc_iso(),
                    "status": "ok",
                    "memory_id": entry.stable_id,
                    "stage": stage,
                    "detail": record["notes"],
                }
            )
        except Exception as exc:
            stats["errors"] += 1
            message = str(exc)
            record_ingest_error(
                conn=conn,
                run_id=run_id,
                memory_id=memory_id,
                stage=stage,
                message=message,
                details={"entry_index": index},
            )
            log_rows.append(
                {
                    "time_utc": now_utc_iso(),
                    "status": "error",
                    "memory_id": memory_id or "",
                    "stage": stage,
                    "detail": message,
                }
            )

    finish_ingest_run(conn, run_id, stats)
    conn.close()

    log_path = dirs["logs"] / "ingest_json_to_sqlite_log.csv"
    write_log_csv(log_path, log_rows)

    print("Ingest complete.")
    print(f"Run id: {run_id}")
    print(f"Database: {db_path}")
    print(f"Log: {log_path}")
    print(json.dumps(stats, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
