import csv
from datetime import datetime
from pathlib import Path

import exifread
from pymediainfo import MediaInfo

# =========================
# Configuration
# =========================

INPUT_DIR = Path("/Volumes/Samsung_T9/SnapBack_Work/final_media")
OUTPUT_CSV = Path("/Volumes/Samsung_T9/SnapBack_Work/manifest.csv")

IMAGE_EXTS = {".jpg", ".jpeg", ".png"}
VIDEO_EXTS = {".mp4"}

# Minimum realistic media size (bytes)
MIN_VALID_SIZE = 10_000  # filters out AppleDouble / junk

# =========================
# Helpers
# =========================

def parse_zip_uuid(filename: str) -> str:
    """
    Extract ZIP UUID (memory ID) from filename.
    Example: <ZIP_UUID>-FINAL.mp4 → ZIP_UUID
    """
    return filename.split("-")[0]


def dms_to_decimal(coord, ref):
    if not coord or not ref:
        return None
    d, m, s = [float(x.num) / float(x.den) for x in coord.values]
    value = d + m / 60 + s / 3600
    return -value if ref.values[0] in {"S", "W"} else value


def extract_image_exif(path: Path) -> dict:
    data = {
        "captured_at": None,
        "latitude": None,
        "longitude": None,
    }

    with open(path, "rb") as f:
        tags = exifread.process_file(f, details=False)

    # Timestamp
    ts = tags.get("EXIF DateTimeOriginal")
    if ts:
        try:
            data["captured_at"] = datetime.strptime(
                str(ts), "%Y:%m:%d %H:%M:%S"
            )
        except Exception:
            pass

    # GPS
    lat = dms_to_decimal(
        tags.get("GPS GPSLatitude"),
        tags.get("GPS GPSLatitudeRef"),
    )
    lon = dms_to_decimal(
        tags.get("GPS GPSLongitude"),
        tags.get("GPS GPSLongitudeRef"),
    )

    data["latitude"] = lat
    data["longitude"] = lon

    return data


def extract_video_meta(path: Path) -> dict:
    data = {
        "captured_at": None,
        "duration_seconds": None,
    }

    media = MediaInfo.parse(path)
    for track in media.tracks:
        if track.track_type == "General":
            # Timestamp
            if track.encoded_date:
                try:
                    data["captured_at"] = datetime.fromisoformat(
                        track.encoded_date.replace("UTC ", "")
                    )
                except Exception:
                    pass

            # Duration (ms → s)
            if track.duration:
                data["duration_seconds"] = float(track.duration) / 1000

    return data

# =========================
# Main extraction
# =========================

rows = []

for file in sorted(INPUT_DIR.iterdir()):

    # ---- hard filters ----
    if not file.is_file():
        continue

    if file.name.startswith("._"):
        continue

    if file.stat().st_size < MIN_VALID_SIZE:
        continue

    ext = file.suffix.lower()
    if ext not in IMAGE_EXTS and ext not in VIDEO_EXTS:
        continue

    # ---- base record ----
    zip_uuid = parse_zip_uuid(file.name)

    record = {
        "filename": file.name,
        "zip_uuid": zip_uuid,
        "media_type": "photo" if ext in IMAGE_EXTS else "video",
        "file_size_bytes": file.stat().st_size,
        "captured_at": None,
        "timezone": None,          # filled later
        "latitude": None,
        "longitude": None,
        "duration_seconds": None,
        "notes": None,
    }

    try:
        if ext in IMAGE_EXTS:
            meta = extract_image_exif(file)
            record.update(meta)

        else:
            meta = extract_video_meta(file)
            record.update(meta)

        if record["captured_at"] is None:
            record["notes"] = "timestamp_missing"

    except Exception as e:
        record["notes"] = f"error:{type(e).__name__}"

    rows.append(record)

# =========================
# Write CSV
# =========================

if not rows:
    raise RuntimeError("No valid media files found. Check INPUT_DIR.")

with open(OUTPUT_CSV, "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)

print(f"Metadata extracted → {OUTPUT_CSV}")
print(f"Total records written: {len(rows)}")