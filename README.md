# SnapBack Memories

SnapBack is a local Snapchat memories viewer with:
- React frontend (`src/`)
- FastAPI backend (`backend/server.py`)
- JSON-driven ingest pipeline (`scripts/ingest_json_to_sqlite.py`)

The canonical manifest is SQLite (`manifests/snapback.db`) with a `memories` table that the backend serves directly.

## Prerequisites

- Node.js 18+
- Python 3.10+
- `ffmpeg` and `ffprobe` on `PATH`
- Python packages:
  - Backend: `fastapi`, `uvicorn`
  - Ingest image overlays: `Pillow`

Install backend deps:

```bash
pip3 install -r backend/requirements.txt
pip3 install Pillow
```

## Wrapper Commands

Two wrapper scripts are available:

- `npm run ingest:json` -> runs `scripts/run_ingest_json_to_sqlite.sh`
- `npm run backend:sqlite` -> runs `scripts/run_backend_sqlite.sh`

Both wrappers use environment variables so paths stay configurable.

### Ingest wrapper variables

- `SNAPBACK_JSON_PATH` (default: repo `mydata.../json/memories_history.json`)
- `SNAPBACK_OUTPUT_ROOT` (default: `/tmp/snapback_work`)
- `SNAPBACK_EXPORT_ROOT` (optional local export folder)
- `SNAPBACK_DOWNLOAD_MODE` (`missing` | `always` | `never`, default `missing`)
- `SNAPBACK_DB_PATH` (optional override for SQLite output path)
- `SNAPBACK_COOKIE_FILE` (optional Netscape cookie jar)
- `SNAPBACK_TIMEOUT_SEC` (default `120`)
- `SNAPBACK_FFMPEG_BIN` (default `ffmpeg`)
- `SNAPBACK_FFPROBE_BIN` (default `ffprobe`)

### Backend wrapper variables

- `SNAPBACK_OUTPUT_ROOT` (default: `/tmp/snapback_work`)
- `SNAPBACK_DB_PATH` (default: `<output-root>/manifests/snapback.db`)
- `SNAPBACK_MEDIA_ROOT` (default: `<output-root>/organized`)
- `SNAPBACK_API_PORT` (default: `5055`)

## Real Ingest (Example)

```bash
SNAPBACK_JSON_PATH="/Users/veerr_89/Work/Website/snapback-memories/mydata~1766859916254/json/memories_history.json" \
SNAPBACK_OUTPUT_ROOT="/Volumes/Samsung_T9/SnapBack_Work_v3" \
SNAPBACK_EXPORT_ROOT="/Volumes/Samsung_T9/Snapchat" \
SNAPBACK_DOWNLOAD_MODE="missing" \
npm run ingest:json
```

If download auth is needed:

```bash
SNAPBACK_COOKIE_FILE="/path/to/cookies.txt" npm run ingest:json
```

Direct CLI arg form (avoids shell env scoping issues):

```bash
npm run ingest:json -- --cookie-file /Users/veerr_89/Downloads/snapchat_cookies.txt
```

## Start Backend (SQLite mode)

```bash
SNAPBACK_OUTPUT_ROOT="/Volumes/Samsung_T9/SnapBack_Work_v3" \
SNAPBACK_MEDIA_ROOT="/Volumes/Samsung_T9/SnapBack_Work_v3/organized" \
npm run backend:sqlite
```

Backend base URL is `http://localhost:5055`.

## Frontend

Switch frontend to real backend:

File: `src/lib/api/adapter.ts`
- Set `USE_MOCK = false`

Run frontend:

```bash
npm install
npm run dev
```

## Notes

- Ingest uses JSON metadata as source of truth (IDs/timestamps/location).
- Deterministic output name format:
  - `YYYY-MM-DD_HH-MM-SSZ__lat_lon__stable_id.ext`
- ZIPs are flattened:
  - Image ZIPs -> composited JPG
  - Video ZIPs -> overlay-burned MP4
