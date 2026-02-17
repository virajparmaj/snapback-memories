# SnapBack Memories - Issues Remaining

This file tracks issues still open after current changes.

## 1. Authenticated Download Still Blocked

- Ingest now correctly receives cookie files and can show host-specific failures.
- Snapchat download endpoints still return:
- `us-east1-aws.api.snapchat.com` -> `403 Forbidden`
- `app.snapchat.com` -> `405 Method Not Allowed`
- Impact:
- JSON ingest runs complete structurally, but no media is ingested from network-only paths.
- Needed next step:
- capture exact successful browser request headers and pass via `--header` flags, or rely on local export reuse.

## 2. Local Export Reuse Not Available Unless SSD Is Mounted

- Current environment does not show `/Volumes/Samsung_T9` mounted.
- Impact:
- fallback to local source reuse cannot execute here.

## 3. Duplicate Favorite/Tag Mutation Calls

- `MemoryViewerDrawer` calls `api.setFavorite` / `api.setTags` internally.
- Parent pages (`TimelinePage`, `OnThisDayPage`, `RecapsPage`) also call the same API in callbacks passed to drawer.
- Impact:
- duplicate network writes and potentially duplicated side effects.
- Files:
- `src/components/viewer/MemoryViewerDrawer.tsx`
- `src/pages/TimelinePage.tsx`
- `src/pages/OnThisDayPage.tsx`
- `src/pages/RecapsPage.tsx`

## 4. One Stub Action Still Present

- Recaps includes a "View all highlights" button without behavior.
- File:
- `src/pages/RecapsPage.tsx`

## 5. Docs/Guide Drift

- `GuidePage` still references legacy UI copy like "Incremental Update" despite newer flow.
- File:
- `src/pages/GuidePage.tsx`

## 6. Backend Scalability Profile

- Backend currently loads all memories into in-memory list at startup.
- Filtering/search/pagination are in-process list operations, not SQL query pushdown.
- Impact:
- acceptable for smaller libraries; potential slowdown at larger scales.

## 7. Security Hardening Not Applied

- Backend CORS allows `*` origins.
- Acceptable for local dev but not production-hardened.

## 8. Test Coverage Gaps

- No automated integration tests for:
- ingest JSON -> SQLite -> backend API correctness
- ZIP overlay edge cases
- mutation persistence across restart

## 9. Environment Setup Friction

- README uses direct `pip3 install` examples, but macOS/Homebrew Python can require venv due PEP 668 managed environment.
- A local `.venv` workflow is effectively needed for consistent execution.
