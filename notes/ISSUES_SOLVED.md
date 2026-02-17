# SnapBack Memories - Issues Solved

This file tracks issues confirmed as solved in the current codebase.

## 1. Real Backend Path Exists and Is Wired

- Backend now exists and serves LocalApiAdapter-compatible endpoints.
- Frontend is currently set to real mode (`USE_MOCK = false`).
- Files:
- `backend/server.py`
- `src/lib/api/adapter.ts`

## 2. Metadata Script Path Portability

- `extract_metadata.py` now uses CLI arguments (`--input`, `--output`) instead of hardcoded absolute paths.
- File:
- `scripts/extract_metadata.py`

## 3. Fragile ZIP UUID Parsing

- `parse_zip_uuid` now handles `-FINAL` / `-RAW` suffix logic safely.
- File:
- `scripts/extract_metadata.py`

## 4. CSV Logging Escaping in Ingest

- Logging uses `csv.writer` instead of ad-hoc string replacement.
- File:
- `scripts/ingest_snapchat.py`

## 5. Mock/Real Initial State Handling

- App store defaults are now derived from `USE_MOCK` instead of always pretending library is connected.
- File:
- `src/stores/app-store.ts`

## 6. Render Side-Effect and Virtualizer Dependency Problems

- Timeline no longer mutates store inside render memo path.
- Active month effect no longer depends directly on `virtualizer.getVirtualItems()` call in deps.
- File:
- `src/pages/TimelinePage.tsx`

## 7. Search Refetch Churn

- Search now uses deferred input (`useDeferredValue`) for query-key updates.
- File:
- `src/pages/TimelinePage.tsx`

## 8. Mock ID Stability

- Mock UUID generation is seeded and deterministic.
- File:
- `src/lib/mock-data.ts`

## 9. On-This-Day Year Boundary Logic

- Circular day-of-year comparison fixes wraparound behavior (Dec/Jan boundary).
- File:
- `src/lib/mock-data.ts`

## 10. Recaps Empty-State Caused by Date Range Drift

- Mock generator now includes recent-window data relative to current time.
- File:
- `src/lib/mock-data.ts`

## 11. Fake Video Playback

- Drawer now renders actual `<video>` playback for video memories.
- File:
- `src/components/viewer/MemoryViewerDrawer.tsx`

## 12. Index Progress Overshoot in Mock Indexing

- Mock indexing progress uses `Math.min(...)` and no longer overshoots total count.
- File:
- `src/lib/api/adapter.ts`

## 13. End-to-End JSON-Driven Ingest Foundation

- Added canonical JSON-to-SQLite ingest pipeline with deterministic organization and ZIP flattening.
- Added wrapper scripts and npm commands for repeatable execution.
- Files:
- `scripts/ingest_json_to_sqlite.py`
- `scripts/run_ingest_json_to_sqlite.sh`
- `scripts/run_backend_sqlite.sh`
- `package.json`
