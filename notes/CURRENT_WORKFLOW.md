# SnapBack Memories - Current Workflow

## 1. End-to-End Flow (Current)

1. Parse Snapchat source-of-truth JSON (`mydata~1766859916254/json/memories_history.json`).
2. Resolve each memory's source media using this order:
- existing cached raw file (`raw/<stable_id>.*`)
- optional local export reuse (`--export-root`)
- network download via Snapchat URLs
3. If source is ZIP:
- extract to `unzipped/<stable_id>/`
- detect main + overlay assets
- flatten image overlays with Pillow
- flatten video overlays with ffmpeg
4. Normalize and copy media into deterministic organized path:
- `organized/YYYY/MM/YYYY-MM-DD_HH-MM-SSZ__lat_lon__stable_id.ext`
- fallback `organized/unknown_date/` when time is missing
5. Upsert memory metadata into SQLite:
- `manifests/snapback.db` -> `memories`
- preserve existing `favorite` and `tags_json` on upsert
6. Record ingest observability:
- run-level records in `ingest_runs`
- per-item failures in `ingest_errors`
- CSV runtime log in `logs/ingest_json_to_sqlite_log.csv`

## 2. Runtime Directories Produced by Ingest

For `--output-root <X>`:
- `<X>/raw`
- `<X>/unzipped`
- `<X>/composited`
- `<X>/organized`
- `<X>/manifests/snapback.db`
- `<X>/logs`

## 3. Backend Serving Workflow

1. Start backend in SQLite mode:
- `python backend/server.py --db <snapback.db> --media <organized_root>`
2. Backend loads manifest rows, materializes in-memory cache, and serves API routes:
- health/status/indexing
- memories/months/search/filter/pagination
- on-this-day/recaps
- media/thumb
- favorite/tag mutations
3. Favorite/tag writes persist back to SQLite when DB mode is active.

## 4. Frontend Workflow

1. Frontend is configured in real mode (`USE_MOCK = false`).
2. React Query pulls data from local backend (`http://localhost:5055`).
3. Timeline uses infinite queries + virtualization.
4. Drawer interactions (favorite/tags) call backend mutation endpoints and invalidate relevant queries.

## 5. Operational Commands

Ingest via wrapper:
- `npm run ingest:json`

Backend via wrapper:
- `npm run backend:sqlite`

Direct CLI cookie path (no env-scope dependency):
- `npm run ingest:json -- --cookie-file /Users/veerr_89/Downloads/snapchat_cookies.txt`

## 6. Current Runtime Reality

- In this environment, `/Volumes/Samsung_T9` is not mounted.
- Download attempts from Snapchat private endpoints currently fail (`403/405`) even when cookie file is passed.
- Because of that, ingest infrastructure runs successfully but media population remains blocked by external auth acceptance.
