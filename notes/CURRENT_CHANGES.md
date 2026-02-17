# SnapBack Memories - Current Changes

Last updated from local working tree status and code inspection.

## 1. Backend and Data Layer Changes

- `backend/server.py` was upgraded from CSV-only loading to a dual mode:
  - canonical SQLite mode (`--db`)
  - legacy CSV compatibility mode (`--manifest --media`)
- API now normalizes manifest rows into frontend-compatible `MemoryItem` shape.
- Favorite and tag updates now persist to SQLite (`favorite`, `tags_json`) when DB mode is active.
- Thumbnail route prefers `thumbnail_path` and falls back to `filepath`.

## 2. New Ingest Pipeline

- Added `scripts/ingest_json_to_sqlite.py` as the primary ingest pipeline.
- Pipeline is JSON-driven from `memories_history.json` and writes canonical SQLite output.
- Added deterministic organization output and ZIP flattening support (image/video overlays).
- Added ingest run/error tracking tables (`ingest_runs`, `ingest_errors`).

## 3. New Wrapper Scripts and NPM Commands

- Added `scripts/run_ingest_json_to_sqlite.sh`.
- Added `scripts/run_backend_sqlite.sh`.
- Added npm scripts in `package.json`:
  - `ingest:json`
  - `backend:sqlite`
- Wrapper scripts auto-prefer `.venv/bin/python3` when available.

## 4. Frontend Runtime Mode Change

- `src/lib/api/adapter.ts` now has `USE_MOCK = false`.
- Frontend is configured to hit `http://localhost:5055` local backend APIs.

## 5. Project Metadata and Tooling Updates

- `README.md` was rewritten into operational setup/runbook format.
- `index.html` app metadata was updated from Lovable placeholders to SnapBack naming.
- `vite.config.ts` removed `lovable-tagger` plugin and simplified plugin configuration.
- `package.json`/`package-lock.json` reflect removal of `lovable-tagger` and script additions.

## 6. Current Working Tree State

Modified tracked files:
- `README.md`
- `backend/server.py`
- `index.html`
- `package-lock.json`
- `package.json`
- `src/lib/api/adapter.ts`
- `vite.config.ts`

New untracked files:
- `scripts/ingest_json_to_sqlite.py`
- `scripts/run_backend_sqlite.sh`
- `scripts/run_ingest_json_to_sqlite.sh`
