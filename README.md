                                                                                                     
  Files Changed                                                                                      
  #: 1                                                                               
  Fix: Seeded UUIDs — generateUUID() now takes the seeded RNG instead of Math.random(), so IDs are   
    stable across reloads                                                                            
  File(s): src/lib/mock-data.ts
  ────────────────────────────────────────                                                           
  #: 2                                                                                               
  Fix: Side effect in render — Moved setCurrentMemories out of useMemo (removed entirely since React 
    Query is now the single source of truth)                                                         
  File(s): src/pages/TimelinePage.tsx                                                                
  ────────────────────────────────────────                                                           
  #: 3                                                                                               
  Fix: Virtualizer infinite re-render — Extracted firstVisibleIndex as a primitive value for the     
    useEffect dep array instead of calling getVirtualItems() inside it                               
  File(s): src/pages/TimelinePage.tsx                                                                
  ────────────────────────────────────────
  #: 4
  Fix: Triple source of truth — Removed updateMemoryFavorite, updateMemoryTags, setCurrentMemories
    from Zustand store. Favorites/tags now call api.setFavorite()/api.setTags() +
    queryClient.invalidateQueries()
  File(s): src/stores/app-store.ts, src/pages/TimelinePage.tsx, OnThisDayPage.tsx, RecapsPage.tsx
  ────────────────────────────────────────
  #: 5
  Fix: On This Day year-boundary — Replaced naive date diff with circular day-of-year comparison so
    Dec 30 ± 3 correctly matches Jan 2
  File(s): src/lib/mock-data.ts
  ────────────────────────────────────────
  #: 6
  Fix: Recaps always empty — Mock data now reserves ~5% of items within the last 90 days, and date
    range is relative to current year
  File(s): src/lib/mock-data.ts
  ────────────────────────────────────────
  #: 7
  Fix: Fake video playback — Replaced static thumbnail + icon toggle with a real <video> element with

    poster, native controls, and play/pause/ended handlers
  File(s): src/components/viewer/MemoryViewerDrawer.tsx
  ────────────────────────────────────────
  #: 8
  Fix: Indexing overshoot — Capped scanned at total with Math.min()
  File(s): src/lib/api/adapter.ts
  ────────────────────────────────────────
  #: 9
  Fix: Python hardcoded paths — extract_metadata.py now uses --input/--output CLI args. Fixed
    parse_zip_uuid to split on -FINAL/-RAW suffixes. ingest_snapchat.py uses csv.writer for proper
    escaping
  File(s): scripts/extract_metadata.py, scripts/ingest_snapchat.py
  ────────────────────────────────────────
  #: 10
  Fix: Store hardcoded mock state — Initial state now derives from USE_MOCK flag (disconnected +
  empty
     when in real mode)
  File(s): src/stores/app-store.ts
  ────────────────────────────────────────
  #: 11
  Fix: Search debouncing — Used useDeferredValue to defer the search query so React Query doesn't
    refetch on every keystroke
  File(s): src/pages/TimelinePage.tsx
  ────────────────────────────────────────
  #: 12
  Fix: Stub buttons removed — Removed: Open in Finder, Shuffle, Play Highlights, Play Reel, View all,

    Incremental Update
  File(s): MemoryViewerDrawer.tsx, OnThisDayPage.tsx, RecapsPage.tsx, ImportPage.tsx
  ────────────────────────────────────────
  #: 13
  Fix: FastAPI backend — New backend/server.py that reads manifest.csv, serves media files, and
    implements all LocalApiAdapter endpoints (health, memories, months, on-this-day, recaps,
    favorites, tags, thumbnails, media)
  File(s): backend/server.py, backend/requirements.txt
  Build passes with 0 TypeScript errors.

  To use the real backend:
  1. pip install -r backend/requirements.txt
  2. python backend/server.py --manifest /path/to/manifest.csv --media /path/to/final_media
  3. Set USE_MOCK = false in src/lib/api/adapter.ts