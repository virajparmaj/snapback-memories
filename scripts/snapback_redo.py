import csv
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Tuple, List

# ============================================================
# CONFIG — PHASE 1 ONLY (NO ZIPs)
# ============================================================

SNAPCHAT_DIR = Path("/Volumes/Samsung_T9/Snapchat")

WORK_DIR = Path("/Volumes/Samsung_T9/SnapBack_Work_v2")
RAW_DIR = WORK_DIR / "raw"
ORGANIZED_DIR = WORK_DIR / "organized"
MANIFESTS_DIR = WORK_DIR / "manifests"
LOGS_DIR = WORK_DIR / "logs"

MEMORIES_JSON = Path(
    "/Users/veerr_89/Work/Website/snapback-memories/mydata~1766859916254/json/memories_history.json"
)

OUTPUT_CSV = MANIFESTS_DIR / "manifest.csv"

IMAGE_EXTS = {".jpg", ".jpeg", ".png"}
VIDEO_EXTS = {".mp4"}

# ============================================================
# Helpers
# ============================================================

def safe_mkdir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)

def is_appledouble(p: Path) -> bool:
    return p.name.startswith("._")

def parse_uuid_from_filename(name: str) -> str:
    """
    Extract base UUID from filenames like:
    - XXXXX.mp4
    - XXXXX.jpeg
    """
    return Path(name).stem.lower()

def parse_sid_mid(url: str) -> Optional[str]:
    m = re.search(r"[?&]mid=([^&]+)", url)
    if m:
        return m.group(1).lower()
    s = re.search(r"[?&]sid=([^&]+)", url)
    if s:
        return s.group(1).lower()
    return None

def parse_lat_lon(loc: str) -> Tuple[Optional[float], Optional[float]]:
    m = re.search(r"([-+]?\d+\.\d+)\s*,\s*([-+]?\d+\.\d+)", loc)
    if not m:
        return None, None
    return float(m.group(1)), float(m.group(2))

def parse_utc(dt: str) -> Optional[datetime]:
    try:
        d = datetime.strptime(dt.strip(), "%Y-%m-%d %H:%M:%S UTC")
        return d.replace(tzinfo=timezone.utc)
    except Exception:
        return None

def build_new_name(
    captured_at: Optional[datetime],
    lat: Optional[float],
    lon: Optional[float],
    uuid: str,
    ext: str
) -> str:
    if captured_at:
        ts = captured_at.strftime("%Y-%m-%d_%H-%M-%SZ")
    else:
        ts = "unknown_time"

    if lat is not None and lon is not None:
        loc = f"{lat:.5f}_{lon:.5f}"
    else:
        loc = "unknown_loc"

    return f"{ts}__{loc}__{uuid}{ext}"

def organize_path(captured_at: Optional[datetime], filename: str) -> Path:
    if not captured_at:
        return ORGANIZED_DIR / "unknown_date" / filename
    return ORGANIZED_DIR / captured_at.strftime("%Y") / captured_at.strftime("%m") / filename

# ============================================================
# Load JSON metadata (authoritative)
# ============================================================

def load_memories_meta() -> Dict[str, dict]:
    with open(MEMORIES_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    out = {}
    for it in data.get("Saved Media", []):
        sid = (
            parse_sid_mid(it.get("Download Link", "")) or
            parse_sid_mid(it.get("Media Download Url", ""))
        )
        if not sid:
            continue

        out[sid] = {
            "captured_at": parse_utc(it.get("Date", "")),
            "media_type": it.get("Media Type", "").lower(),
            "lat": parse_lat_lon(it.get("Location", ""))[0],
            "lon": parse_lat_lon(it.get("Location", ""))[1],
        }
    return out

# ============================================================
# MAIN — PHASE 1 PIPELINE
# ============================================================

def main():
    for d in [RAW_DIR, ORGANIZED_DIR, MANIFESTS_DIR, LOGS_DIR]:
        safe_mkdir(d)

    if not MEMORIES_JSON.exists():
        raise FileNotFoundError(f"Missing JSON: {MEMORIES_JSON}")

    meta_by_sid = load_memories_meta()
    rows: List[dict] = []
    log_lines: List[str] = []

    for p in sorted(SNAPCHAT_DIR.iterdir()):
        if p.is_dir() or is_appledouble(p):
            continue

        ext = p.suffix.lower()

        # ❌ Phase 1: explicitly ignore ZIPs
        if ext == ".zip":
            continue

        if ext not in IMAGE_EXTS and ext not in VIDEO_EXTS:
            continue

        uuid = parse_uuid_from_filename(p.name)
        meta = meta_by_sid.get(uuid)

        # Preserve raw
        raw_copy = RAW_DIR / p.name
        if not raw_copy.exists():
            shutil.copy2(p, raw_copy)

        new_name = build_new_name(
            meta["captured_at"] if meta else None,
            meta["lat"] if meta else None,
            meta["lon"] if meta else None,
            uuid,
            ext
        )

        out_path = organize_path(
            meta["captured_at"] if meta else None,
            new_name
        )
        safe_mkdir(out_path.parent)
        shutil.copy2(p, out_path)

        rows.append({
            "uuid": uuid,
            "output_file": str(out_path),
            "media_type": "image" if ext in IMAGE_EXTS else "video",
            "captured_at_utc": meta["captured_at"].isoformat() if meta and meta["captured_at"] else "",
            "latitude": meta["lat"] if meta else "",
            "longitude": meta["lon"] if meta else "",
            "notes": "" if meta else "no_json_match"
        })

    # Write manifest
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "uuid",
                "output_file",
                "media_type",
                "captured_at_utc",
                "latitude",
                "longitude",
                "notes"
            ]
        )
        w.writeheader()
        for r in rows:
            w.writerow(r)

    print("Phase 1 complete.")
    print(f"Manifest: {OUTPUT_CSV}")
    print(f"Organized media: {ORGANIZED_DIR}")

if __name__ == "__main__":
    main()