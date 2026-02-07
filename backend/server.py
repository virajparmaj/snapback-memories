"""
SnapBack Memories — Local API Server

Reads manifest.csv produced by extract_metadata.py and serves media files
from the final_media/ folder. Implements the endpoints expected by
LocalApiAdapter in the React frontend.

Usage:
    python backend/server.py --manifest /path/to/manifest.csv --media /path/to/final_media

Runs on http://localhost:5055 by default.
"""

import argparse
import csv
import math
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import uvicorn


app = FastAPI(title="SnapBack Memories API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- In-memory state ----------

MEMORIES: list[dict] = []
MEDIA_DIR: Path = Path(".")
MANIFEST_PATH: Path = Path(".")
INDEXING_STATE = {"state": "idle", "progress": {"scanned": 0, "total": 0}, "logs": []}


# ---------- Helpers ----------

def load_manifest(manifest_path: Path, media_dir: Path) -> list[dict]:
    """Parse manifest.csv into a list of memory dicts matching the MemoryItem type."""
    items = []
    with open(manifest_path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            captured_at = row.get("captured_at") or None
            lat = row.get("latitude")
            lon = row.get("longitude")
            duration = row.get("duration_seconds")

            # Parse date parts
            year, month, day = None, None, None
            if captured_at:
                try:
                    dt = datetime.fromisoformat(str(captured_at))
                    year, month, day = dt.year, dt.month, dt.day
                    captured_at = dt.isoformat()
                except Exception:
                    captured_at = None

            # Build a stable ID from the zip_uuid or filename
            item_id = row.get("zip_uuid") or row["filename"]

            location = None
            if lat and lon:
                try:
                    location = {
                        "latitude": float(lat),
                        "longitude": float(lon),
                        "label": f"{float(lat):.2f}, {float(lon):.2f}",
                    }
                except (ValueError, TypeError):
                    pass

            item = {
                "id": item_id,
                "type": row.get("media_type", "photo"),
                "filename_original": row["filename"],
                "filepath": str(media_dir / row["filename"]),
                "captured_at_utc": captured_at,
                "captured_at_local": captured_at,
                "timezone_hint": row.get("timezone"),
                "year": year,
                "month": month,
                "day": day,
                "location": location,
                "duration_sec": float(duration) if duration else None,
                "size_bytes": int(row.get("file_size_bytes", 0)),
                "tags": [],
                "favorite": False,
                "thumbnail_url": None,
            }
            items.append(item)

    # Sort newest first
    items.sort(
        key=lambda m: m["captured_at_utc"] or "",
        reverse=True,
    )
    return items


def get_month_summaries(memories: list[dict]) -> list[dict]:
    counts: dict[tuple[int, int], int] = {}
    for m in memories:
        if m["year"] and m["month"]:
            key = (m["year"], m["month"])
            counts[key] = counts.get(key, 0) + 1
    summaries = [{"year": y, "month": mo, "count": c} for (y, mo), c in counts.items()]
    summaries.sort(key=lambda s: (s["year"], s["month"]), reverse=True)
    return summaries


# ---------- Routes ----------

@app.get("/health")
def health():
    return {"ok": True, "version": "1.0.0"}


@app.get("/library/status")
def library_status():
    return {
        "libraryPath": str(MEDIA_DIR),
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

    MEMORIES = load_manifest(MANIFEST_PATH, MEDIA_DIR)
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
        filtered = [m for m in filtered if m["year"] == year and m["month"] == month]

    if filter == "photos":
        filtered = [m for m in filtered if m["type"] == "photo"]
    elif filter == "videos":
        filtered = [m for m in filtered if m["type"] == "video"]
    elif filter == "favorites":
        filtered = [m for m in filtered if m["favorite"]]

    if search:
        q = search.lower()
        filtered = [
            m for m in filtered
            if q in m["filename_original"].lower()
            or (m["location"] and q in m["location"]["label"].lower())
            or any(q in t.lower() for t in (m["tags"] or []))
        ]

    # Cursor-based pagination
    start = 0
    if cursor:
        for i, m in enumerate(filtered):
            if m["id"] == cursor:
                start = i
                break

    items = filtered[start : start + limit]
    next_cursor = filtered[start + limit]["id"] if start + limit < len(filtered) else None

    return {"items": items, "nextCursor": next_cursor}


@app.get("/memories/{memory_id}")
def get_memory(memory_id: str):
    for m in MEMORIES:
        if m["id"] == memory_id:
            return m
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
    for m in MEMORIES:
        if m["month"] is None or m["day"] is None:
            continue
        mem_doy = days_before[m["month"] - 1] + m["day"]
        diff = abs(target_doy - mem_doy)
        circular = min(diff, 365 - diff)
        if circular <= window:
            results.append(m)

    return results


@app.get("/recaps/recent")
def recent_recap(days: int = Query(default=7)):
    cutoff = datetime.now() - timedelta(days=days)
    recent = []
    for m in MEMORIES:
        if m["captured_at_utc"]:
            try:
                dt = datetime.fromisoformat(m["captured_at_utc"])
                if dt >= cutoff:
                    recent.append(m)
            except Exception:
                pass

    photos = sum(1 for m in recent if m["type"] == "photo")
    videos = sum(1 for m in recent if m["type"] == "video")

    favorites = [m for m in recent if m["favorite"]]
    others = [m for m in recent if not m["favorite"]]
    highlights = (favorites + others)[:20]

    return {
        "highlights": highlights,
        "stats": {"photos": photos, "videos": videos},
    }


@app.post("/memories/{memory_id}/favorite")
def set_favorite(memory_id: str, body: dict):
    for m in MEMORIES:
        if m["id"] == memory_id:
            m["favorite"] = body.get("favorite", False)
            return {"ok": True}
    raise HTTPException(status_code=404, detail="Memory not found")


@app.post("/memories/{memory_id}/tags")
def set_tags(memory_id: str, body: dict):
    for m in MEMORIES:
        if m["id"] == memory_id:
            m["tags"] = body.get("tags", [])
            return {"ok": True}
    raise HTTPException(status_code=404, detail="Memory not found")


@app.get("/thumb/{memory_id}")
def get_thumbnail(memory_id: str):
    for m in MEMORIES:
        if m["id"] == memory_id:
            path = Path(m["filepath"])
            if path.is_file():
                return FileResponse(path)
            raise HTTPException(status_code=404, detail="File not found on disk")
    raise HTTPException(status_code=404, detail="Memory not found")


@app.get("/media/{memory_id}")
def get_media(memory_id: str):
    for m in MEMORIES:
        if m["id"] == memory_id:
            path = Path(m["filepath"])
            if path.is_file():
                return FileResponse(path)
            raise HTTPException(status_code=404, detail="File not found on disk")
    raise HTTPException(status_code=404, detail="Memory not found")


# ---------- Entry point ----------

def main():
    ap = argparse.ArgumentParser(description="SnapBack Memories local API server")
    ap.add_argument("--manifest", required=True, help="Path to manifest.csv")
    ap.add_argument("--media", required=True, help="Path to final_media/ folder")
    ap.add_argument("--port", type=int, default=5055, help="Port to run on (default: 5055)")
    args = ap.parse_args()

    global MEMORIES, MEDIA_DIR, MANIFEST_PATH
    MANIFEST_PATH = Path(args.manifest)
    MEDIA_DIR = Path(args.media)

    if not MANIFEST_PATH.is_file():
        raise FileNotFoundError(f"Manifest not found: {MANIFEST_PATH}")
    if not MEDIA_DIR.is_dir():
        raise FileNotFoundError(f"Media directory not found: {MEDIA_DIR}")

    MEMORIES = load_manifest(MANIFEST_PATH, MEDIA_DIR)
    print(f"Loaded {len(MEMORIES)} memories from {MANIFEST_PATH}")

    uvicorn.run(app, host="0.0.0.0", port=args.port)


if __name__ == "__main__":
    main()
