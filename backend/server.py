"""
SnapBack Memories - Local API Server

Primary mode:
    Read the canonical SQLite manifest and serve media directly from `filepath`.

Compatibility mode:
    Read legacy CSV manifests and resolve filepaths against --media.

Usage:
    python backend/server.py --db /path/to/manifests/snapback.db [--media /optional/media/root]
    python backend/server.py --manifest /path/to/manifest.csv --media /path/to/final_media

Runs on http://localhost:5055 by default.
"""

import argparse
import csv
import json
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse


app = FastAPI(title="SnapBack Memories API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- In-memory cache ----------

MEMORIES: list[dict[str, Any]] = []
MANIFEST_PATH: Optional[Path] = None
DB_PATH: Optional[Path] = None
MEDIA_ROOT: Optional[Path] = None
INDEXING_STATE = {"state": "idle", "progress": {"scanned": 0, "total": 0}, "logs": []}


# ---------- Helpers ----------

def normalize_media_type(value: Optional[str]) -> str:
    media_type = (value or "").strip().lower()
    if media_type in {"photo", "image", "jpg", "jpeg", "png"}:
        return "photo"
    if media_type in {"video", "mp4", "mov"}:
        return "video"
    return "photo"


def parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None

    text = str(value).strip()
    if not text:
        return None

    if text.endswith(" UTC"):
        try:
            return datetime.strptime(text, "%Y-%m-%d %H:%M:%S UTC").replace(tzinfo=timezone.utc)
        except ValueError:
            return None

    if text.endswith("Z"):
        text = f"{text[:-1]}+00:00"

    try:
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed
    except ValueError:
        return None


def parse_float(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_int(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def parse_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}


def parse_tags(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v) for v in value if str(v).strip()]

    text = str(value).strip()
    if not text:
        return []

    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return [str(v) for v in parsed if str(v).strip()]
    except json.JSONDecodeError:
        pass

    # Fallback for simple comma-separated legacy values.
    return [part.strip() for part in text.split(",") if part.strip()]


def resolve_path(raw_path: Optional[str], media_root: Optional[Path], fallback_name: Optional[str]) -> Path:
    if raw_path:
        path = Path(raw_path)
        if path.is_absolute() or media_root is None:
            return path
        return media_root / path

    if fallback_name:
        if media_root:
            return media_root / fallback_name
        return Path(fallback_name)

    return Path("")


def build_location(latitude: Optional[float], longitude: Optional[float], label: Optional[str]) -> Optional[dict]:
    if latitude is None or longitude is None:
        return None
    return {
        "latitude": latitude,
        "longitude": longitude,
        "label": label or f"{latitude:.2f}, {longitude:.2f}",
    }


def to_memory_item(row: dict[str, Any], media_root: Optional[Path]) -> dict[str, Any]:
    captured_dt = parse_datetime(row.get("captured_at_utc") or row.get("captured_at"))
    captured_iso = captured_dt.isoformat() if captured_dt else None

    year = parse_int(row.get("year")) or (captured_dt.year if captured_dt else None)
    month = parse_int(row.get("month")) or (captured_dt.month if captured_dt else None)
    day = parse_int(row.get("day")) or (captured_dt.day if captured_dt else None)

    latitude = parse_float(row.get("latitude"))
    longitude = parse_float(row.get("longitude"))
    location_label = row.get("location_label")
    location = build_location(latitude, longitude, location_label)

    filename_original = (
        row.get("filename_original")
        or row.get("filename")
        or Path(str(row.get("output_file", ""))).name
        or row.get("id")
        or row.get("zip_uuid")
        or row.get("uuid")
        or "unknown"
    )
    item_id = row.get("id") or row.get("zip_uuid") or row.get("uuid") or filename_original

    filepath = resolve_path(
        row.get("filepath") or row.get("output_file"),
        media_root,
        filename_original,
    )

    memory = {
        "id": str(item_id),
        "type": normalize_media_type(row.get("type") or row.get("media_type")),
        "filename_original": filename_original,
        "filepath": str(filepath),
        "captured_at_utc": captured_iso,
        "captured_at_local": row.get("captured_at_local") or captured_iso,
        "timezone_hint": row.get("timezone_hint") or row.get("timezone"),
        "year": year,
        "month": month,
        "day": day,
        "location": location,
        "duration_sec": parse_float(row.get("duration_sec") or row.get("duration_seconds")),
        "size_bytes": parse_int(row.get("size_bytes") or row.get("file_size_bytes")) or 0,
        "tags": parse_tags(row.get("tags_json") or row.get("tags")),
        "favorite": parse_bool(row.get("favorite")),
        "thumbnail_url": row.get("thumbnail_url"),
        "thumbnail_path": row.get("thumbnail_path"),
        "sha1": row.get("sha1"),
    }
    return memory


def sort_memories(memories: list[dict[str, Any]]) -> list[dict[str, Any]]:
    memories.sort(key=lambda m: m.get("captured_at_utc") or "", reverse=True)
    return memories


def load_manifest_csv(manifest_path: Path, media_root: Optional[Path]) -> list[dict[str, Any]]:
    """Parse CSV manifest into MemoryItem-compatible dicts."""
    items: list[dict[str, Any]] = []
    with open(manifest_path, newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            items.append(to_memory_item(row, media_root))
    return sort_memories(items)


def sqlite_connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def sqlite_columns(conn: sqlite3.Connection, table_name: str) -> set[str]:
    rows = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    return {str(row["name"]) for row in rows}


def load_manifest_sqlite(db_path: Path, media_root: Optional[Path]) -> list[dict[str, Any]]:
    """Load memories from canonical SQLite manifest."""
    expected_columns = [
        "id",
        "type",
        "filename_original",
        "filepath",
        "captured_at_utc",
        "captured_at_local",
        "timezone_hint",
        "year",
        "month",
        "day",
        "latitude",
        "longitude",
        "location_label",
        "duration_sec",
        "size_bytes",
        "thumbnail_path",
        "thumbnail_url",
        "favorite",
        "tags_json",
        "sha1",
    ]

    with sqlite_connect(db_path) as conn:
        cols = sqlite_columns(conn, "memories")
        if "id" not in cols:
            raise RuntimeError("SQLite manifest is missing required column: memories.id")
        if "filepath" not in cols:
            raise RuntimeError("SQLite manifest is missing required column: memories.filepath")

        select_parts = [col if col in cols else f"NULL AS {col}" for col in expected_columns]
        query = f"SELECT {', '.join(select_parts)} FROM memories"
        rows = conn.execute(query).fetchall()

    return sort_memories([to_memory_item(dict(row), media_root) for row in rows])


def reload_memories() -> list[dict[str, Any]]:
    if DB_PATH:
        return load_manifest_sqlite(DB_PATH, MEDIA_ROOT)
    if MANIFEST_PATH:
        return load_manifest_csv(MANIFEST_PATH, MEDIA_ROOT)
    return []


def persist_sqlite_field(memory_id: str, field_name: str, value: Any) -> None:
    if DB_PATH is None:
        return

    allowed_fields = {"favorite", "tags_json"}
    if field_name not in allowed_fields:
        return

    with sqlite_connect(DB_PATH) as conn:
        cols = sqlite_columns(conn, "memories")
        if field_name not in cols:
            return

        update_time = datetime.now(timezone.utc).isoformat()
        if "updated_at" in cols:
            conn.execute(
                f"UPDATE memories SET {field_name} = ?, updated_at = ? WHERE id = ?",
                (value, update_time, memory_id),
            )
        else:
            conn.execute(
                f"UPDATE memories SET {field_name} = ? WHERE id = ?",
                (value, memory_id),
            )
        conn.commit()

        if conn.total_changes == 0:
            raise HTTPException(status_code=404, detail="Memory not found")


def find_memory(memory_id: str) -> Optional[dict[str, Any]]:
    for memory in MEMORIES:
        if memory["id"] == memory_id:
            return memory
    return None


def get_month_summaries(memories: list[dict[str, Any]]) -> list[dict]:
    counts: dict[tuple[int, int], int] = {}
    for memory in memories:
        if memory["year"] and memory["month"]:
            key = (memory["year"], memory["month"])
            counts[key] = counts.get(key, 0) + 1
    summaries = [{"year": year, "month": month, "count": count} for (year, month), count in counts.items()]
    summaries.sort(key=lambda summary: (summary["year"], summary["month"]), reverse=True)
    return summaries


# ---------- Routes ----------

@app.get("/health")
def health():
    return {"ok": True, "version": "1.1.0"}


@app.get("/library/status")
def library_status():
    library_path = MEDIA_ROOT or (DB_PATH.parent if DB_PATH else MANIFEST_PATH.parent if MANIFEST_PATH else Path("."))
    return {
        "libraryPath": str(library_path),
        "indexed": len(MEMORIES) > 0,
        "totalItems": len(MEMORIES),
        "lastIndexedAt": datetime.now().isoformat(),
    }


@app.post("/library/index")
def start_indexing():
    global MEMORIES
    INDEXING_STATE["state"] = "running"
    INDEXING_STATE["progress"] = {"scanned": 0, "total": 0}
    INDEXING_STATE["logs"] = ["Starting indexing..."]

    MEMORIES = reload_memories()
    INDEXING_STATE["progress"] = {"scanned": len(MEMORIES), "total": len(MEMORIES)}
    INDEXING_STATE["state"] = "done"
    INDEXING_STATE["logs"].append(f"Indexed {len(MEMORIES)} items.")
    return {"ok": True}


@app.get("/library/index/status")
def indexing_status():
    return INDEXING_STATE


@app.get("/months")
def get_months():
    return get_month_summaries(MEMORIES)


@app.get("/memories")
def get_memories(
    year: Optional[int] = None,
    month: Optional[int] = None,
    cursor: Optional[str] = None,
    limit: int = Query(default=200, le=1000),
    filter: Optional[str] = None,
    search: Optional[str] = None,
):
    filtered = list(MEMORIES)

    if year and month:
        filtered = [memory for memory in filtered if memory["year"] == year and memory["month"] == month]

    if filter == "photos":
        filtered = [memory for memory in filtered if memory["type"] == "photo"]
    elif filter == "videos":
        filtered = [memory for memory in filtered if memory["type"] == "video"]
    elif filter == "favorites":
        filtered = [memory for memory in filtered if memory["favorite"]]

    if search:
        query = search.lower()
        filtered = [
            memory
            for memory in filtered
            if query in memory["filename_original"].lower()
            or (memory["location"] and query in memory["location"]["label"].lower())
            or any(query in tag.lower() for tag in (memory["tags"] or []))
        ]

    # Cursor-based pagination
    start = 0
    if cursor:
        for idx, memory in enumerate(filtered):
            if memory["id"] == cursor:
                start = idx
                break

    items = filtered[start : start + limit]
    next_cursor = filtered[start + limit]["id"] if start + limit < len(filtered) else None
    return {"items": items, "nextCursor": next_cursor}


@app.get("/memories/{memory_id}")
def get_memory(memory_id: str):
    memory = find_memory(memory_id)
    if memory:
        return memory
    raise HTTPException(status_code=404, detail="Memory not found")


@app.get("/on-this-day")
def on_this_day(
    month: int = Query(...),
    day: int = Query(...),
    window: int = Query(default=3),
):
    days_before = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
    target_doy = days_before[month - 1] + day

    results = []
    for memory in MEMORIES:
        if memory["month"] is None or memory["day"] is None:
            continue
        memory_doy = days_before[memory["month"] - 1] + memory["day"]
        diff = abs(target_doy - memory_doy)
        circular = min(diff, 365 - diff)
        if circular <= window:
            results.append(memory)

    return results


@app.get("/recaps/recent")
def recent_recap(days: int = Query(default=7)):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    recent = []
    for memory in MEMORIES:
        captured = parse_datetime(memory["captured_at_utc"])
        if captured and captured >= cutoff:
            recent.append(memory)

    photos = sum(1 for memory in recent if memory["type"] == "photo")
    videos = sum(1 for memory in recent if memory["type"] == "video")
    favorites = [memory for memory in recent if memory["favorite"]]
    others = [memory for memory in recent if not memory["favorite"]]
    highlights = (favorites + others)[:20]

    return {
        "highlights": highlights,
        "stats": {"photos": photos, "videos": videos},
    }


@app.post("/memories/{memory_id}/favorite")
def set_favorite(memory_id: str, body: dict):
    memory = find_memory(memory_id)
    if memory is None:
        raise HTTPException(status_code=404, detail="Memory not found")

    favorite = bool(body.get("favorite", False))
    memory["favorite"] = favorite
    persist_sqlite_field(memory_id, "favorite", 1 if favorite else 0)
    return {"ok": True}


@app.post("/memories/{memory_id}/tags")
def set_tags(memory_id: str, body: dict):
    memory = find_memory(memory_id)
    if memory is None:
        raise HTTPException(status_code=404, detail="Memory not found")

    tags = body.get("tags", [])
    if not isinstance(tags, list):
        raise HTTPException(status_code=400, detail="tags must be an array")

    normalized_tags = [str(tag).strip() for tag in tags if str(tag).strip()]
    memory["tags"] = normalized_tags
    persist_sqlite_field(memory_id, "tags_json", json.dumps(normalized_tags))
    return {"ok": True}


@app.get("/thumb/{memory_id}")
def get_thumbnail(memory_id: str):
    memory = find_memory(memory_id)
    if memory is None:
        raise HTTPException(status_code=404, detail="Memory not found")

    thumb_path = memory.get("thumbnail_path")
    if thumb_path:
        path = resolve_path(thumb_path, MEDIA_ROOT, None)
        if path.is_file():
            return FileResponse(path)

    path = Path(memory["filepath"])
    if path.is_file():
        return FileResponse(path)
    raise HTTPException(status_code=404, detail="File not found on disk")


@app.get("/media/{memory_id}")
def get_media(memory_id: str):
    memory = find_memory(memory_id)
    if memory is None:
        raise HTTPException(status_code=404, detail="Memory not found")

    path = Path(memory["filepath"])
    if path.is_file():
        return FileResponse(path)
    raise HTTPException(status_code=404, detail="File not found on disk")


# ---------- Entry point ----------

def main():
    parser = argparse.ArgumentParser(description="SnapBack Memories local API server")
    parser.add_argument("--db", help="Path to canonical SQLite manifest (snapback.db)")
    parser.add_argument("--manifest", help="Path to legacy manifest.csv")
    parser.add_argument("--media", help="Media root for relative filepaths (required for legacy CSV mode)")
    parser.add_argument("--port", type=int, default=5055, help="Port to run on (default: 5055)")
    args = parser.parse_args()

    global DB_PATH, MANIFEST_PATH, MEDIA_ROOT, MEMORIES

    if args.db:
        DB_PATH = Path(args.db)
        if not DB_PATH.is_file():
            raise FileNotFoundError(f"SQLite manifest not found: {DB_PATH}")

        MEDIA_ROOT = Path(args.media) if args.media else None
        if MEDIA_ROOT and not MEDIA_ROOT.is_dir():
            raise FileNotFoundError(f"Media root not found: {MEDIA_ROOT}")

        MEMORIES = load_manifest_sqlite(DB_PATH, MEDIA_ROOT)
        print(f"Loaded {len(MEMORIES)} memories from SQLite: {DB_PATH}")
    else:
        if not args.manifest or not args.media:
            raise ValueError("Provide --db, or provide both --manifest and --media for CSV mode.")

        MANIFEST_PATH = Path(args.manifest)
        MEDIA_ROOT = Path(args.media)

        if not MANIFEST_PATH.is_file():
            raise FileNotFoundError(f"Manifest not found: {MANIFEST_PATH}")
        if not MEDIA_ROOT.is_dir():
            raise FileNotFoundError(f"Media directory not found: {MEDIA_ROOT}")

        MEMORIES = load_manifest_csv(MANIFEST_PATH, MEDIA_ROOT)
        print(f"Loaded {len(MEMORIES)} memories from CSV: {MANIFEST_PATH}")

    uvicorn.run(app, host="0.0.0.0", port=args.port)


if __name__ == "__main__":
    main()
