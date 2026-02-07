# SnapBack Memories - Project Analysis

## What Is This?

SnapBack is a **personal Snapchat memories viewer** — a web app that lets you browse, search, and organize your exported Snapchat memories (photos/videos) in a clean, dark-themed timeline UI. Think of it as Apple Photos but specifically for your Snapchat data export.

### The Full Pipeline

```
Snapchat Data Export (ZIPs + media)
        │
        ▼
  Python Scripts (ingest + flatten overlays + extract metadata)
        │
        ▼
  Processed Media Folder (final_media/) + manifest.csv
        │
        ▼
  React Frontend (browse, search, filter, tag, favorite)
```

### Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + TypeScript + Vite |
| UI | shadcn/ui + Tailwind CSS (dark theme, Snapchat yellow accent) |
| State | Zustand (persisted) |
| Data Fetching | TanStack Query (infinite scroll) |
| Virtualization | @tanstack/react-virtual |
| Ingestion | Python (PIL for images, ffmpeg for videos) |
| Metadata | exifread + pymediainfo |

### Key Features

- **Timeline** — Virtual-scrolled grid of 9:16 portrait cards, grouped by month, with infinite scroll
- **On This Day** — "Memories from this date in past years" with adjustable date window
- **Recaps** — Stats and highlights for last 7/30/90 days
- **Import** — Library connection + indexing UI
- **Viewer Drawer** — Side-sliding detail view with metadata, tags, favorites
- **Month Scrubber** — Vertical month navigation for quick jumping
- **Search** — Filter by location, tags, filename
- **Filters** — All / Photos / Videos / Favorites

---

## What's Broken / Logical Flaws

### 1. Mock-Only Mode — No Real Backend Exists

**File:** `src/lib/api/adapter.ts:19`

`USE_MOCK = true` is hardcoded, and the `LocalApiAdapter` makes fetch calls to `http://localhost:5055` — but **there is no backend server**. The Python scripts produce a `manifest.csv` and flat media files, but nothing serves them over HTTP. The entire real API path is a dead end.

**Impact:** The app only works with random placeholder images from picsum.photos. You can never see your actual Snapchat photos.

### 2. Favorite/Tag Updates Are Fire-and-Forget and Diverge

**Files:** `src/stores/app-store.ts:87-99`, `src/components/viewer/MemoryViewerDrawer.tsx:55-63`

When you toggle a favorite or edit tags, three things happen independently:
1. The Zustand store's `currentMemories` array gets updated (shallow copy)
2. `api.setFavorite()` / `api.setTags()` is called (in mock mode, mutates the `MockApiAdapter`'s internal array)
3. React Query's cached data is **never invalidated**

This means the next time React Query refetches (filter change, search, pagination), it reads from `MockApiAdapter.memories` which *was* mutated — but the Zustand `currentMemories` and the React Query cache are now **three separate sources of truth**. If any of these get out of sync (and they will), the UI shows stale data.

### 3. `setCurrentMemories` Called Inside `useMemo` — Side Effect in Render

**File:** `src/pages/TimelinePage.tsx:88-92`

```ts
const allMemories = useMemo(() => {
  const items = data?.pages.flatMap((page) => page.items) ?? [];
  setCurrentMemories(items); // Zustand state update during render!
  return items;
}, [data?.pages, setCurrentMemories]);
```

Calling a Zustand setter inside `useMemo` is a **side effect during render**. This violates React's rules and can cause:
- Extra re-renders
- State update warnings in strict mode
- Race conditions with concurrent rendering

### 4. `virtualizer.getVirtualItems()` in useEffect Dependency — Infinite Re-render Risk

**File:** `src/pages/TimelinePage.tsx:207`

```ts
useEffect(() => {
  // ...update active month
}, [virtualizer.getVirtualItems(), rows, activeMonth]);
```

`virtualizer.getVirtualItems()` returns a **new array reference every call**. Putting it in the dependency array means this effect runs on **every single render**, not just when the visible items actually change. This is a performance bug that triggers unnecessary state updates.

### 5. Mock UUIDs Are Not Seeded — Data Changes on Every Page Load

**File:** `src/lib/mock-data.ts:39-45`

The mock data generator uses a seeded random for dates/types/locations, but `generateUUID()` uses `Math.random()` (not the seeded RNG). This means **every page load generates different IDs** for the same memories. Consequences:
- Cursor-based pagination breaks if the data is regenerated mid-session
- Any bookmarked/shared memory ID becomes invalid on refresh
- The `getMockMemories()` cache helps within a session, but not across reloads

### 6. "On This Day" Window Logic Doesn't Handle Year Boundaries

**File:** `src/lib/mock-data.ts:151-165`

```ts
const targetDate = new Date(2000, month - 1, day);
const checkDate = new Date(2000, memoryMonth - 1, memoryDay);
const diffDays = Math.abs(
  (targetDate.getTime() - checkDate.getTime()) / (1000 * 60 * 60 * 24)
);
return diffDays <= windowDays;
```

Pinning both dates to year 2000 and computing a simple time diff means:
- **Dec 30 ± 3 days won't match Jan 2** — the diff wraps to ~363 days instead of 3
- Any cross-year-boundary window is broken

### 7. Recaps "Recent" Feature Uses Mock Data from 2020-2025

**File:** `src/lib/mock-data.ts:186-208`

`getRecentHighlights()` filters memories where `captured_at_utc >= now - N days`. But mock data spans 2020-2025, and `now` is 2026. **No mock memories fall within any recent window**, so the Recaps page always shows 0 photos, 0 videos, empty highlights. The entire page is non-functional.

### 8. Video Playback Is Fake

**File:** `src/components/viewer/MemoryViewerDrawer.tsx:153-171`

The video viewer shows a static thumbnail with a play/pause button that toggles `isPlaying` state — but **there's no `<video>` element**. Clicking play/pause just swaps the icon. No video ever plays.

### 9. Indexing Simulation Can Overshoot

**File:** `src/lib/api/adapter.ts:77-88`

```ts
this.indexingState.progress.scanned += Math.floor(Math.random() * 200) + 100;
```

Each tick adds 100-300 to `scanned`, but only checks `< total` (8016). Since increments are random, `scanned` can jump to e.g. 8200/8016, showing **over 100% progress** before the next tick catches it.

### 10. Python Scripts Have Hardcoded Paths

**File:** `scripts/extract_metadata.py:12-13`

```python
INPUT_DIR = Path("/Volumes/Samsung_T9/SnapBack_Work/final_media")
OUTPUT_CSV = Path("/Volumes/Samsung_T9/SnapBack_Work/manifest.csv")
```

These are absolute paths to a specific external SSD. Anyone else (or even you on a different machine) can't run this script without editing the source. Should be CLI args like `ingest_snapchat.py` does.

### 11. `parse_zip_uuid` Is Fragile

**File:** `scripts/extract_metadata.py:26-30`

```python
def parse_zip_uuid(filename: str) -> str:
    return filename.split("-")[0]
```

Splits on first `-` and takes everything before it. If a filename has dashes elsewhere (e.g., `some-photo-name-FINAL.jpg`), this returns `some` instead of the actual UUID. Only works by accident when UUIDs are the first segment.

### 12. CSV Logging Doesn't Properly Escape

**File:** `scripts/ingest_snapchat.py:218`

```python
f.write(f"{status},{name},{detail.replace(',', ' ')}\n")
```

Only replaces commas in `detail`, not in `name`. If a filename contains commas (rare but possible), the CSV is malformed. Should use Python's `csv.writer` for proper escaping.

### 13. Store Hardcodes Mock State

**File:** `src/stores/app-store.ts:46-49`

```ts
isLibraryConnected: true,
libraryPath: "/Users/demo/Snapchat/Memories",
totalItems: 8016,
lastIndexedAt: new Date().toISOString(),
```

The store initializes as "connected" with fake data. When switching to real mode, these defaults would make the app appear connected when it's not. The initial state should derive from `USE_MOCK`.

### 14. Search Has No Debouncing

**File:** `src/pages/TimelinePage.tsx:284`

Every keystroke in the search box calls `setSearchQuery()`, which changes the React Query key `["memories", activeFilter, searchQuery]`, triggering a full data refetch. With 8,000+ items this is wasteful. Should debounce by 300-500ms.

### 15. Multiple Stub Buttons That Do Nothing

Several UI buttons are completely non-functional:
- **"Open in Finder"** (`MemoryViewerDrawer.tsx:282`) — no click handler
- **"Shuffle"** (`OnThisDayPage.tsx:96`) — no click handler
- **"Play Highlights"** (`OnThisDayPage.tsx:99`) — no click handler
- **"Play Reel"** (`RecapsPage.tsx:193`) — no click handler
- **"View all"** (`OnThisDayPage.tsx:137`) — no click handler
- **"Incremental Update"** (`ImportPage.tsx:143`) — no click handler

---

## Architecture Recommendations

### Priority 1: Make It Actually Work

1. **Build a FastAPI backend** that reads `manifest.csv` and serves media files from `final_media/`. This bridges the Python pipeline to the React frontend.
2. **Make `extract_metadata.py` take CLI args** instead of hardcoded paths.
3. **Fix the UUID generation** in mock data to use the seeded RNG.

### Priority 2: Fix the Data Flow

4. **Remove the triple state sync** — let React Query be the single source of truth. Use query invalidation after mutations instead of parallel Zustand updates.
5. **Move `setCurrentMemories` out of `useMemo`** into a `useEffect`.
6. **Fix the virtualizer dependency** — use a ref or memoized selector instead of calling `getVirtualItems()` in the dep array.

### Priority 3: Fix Feature Logic

7. **Fix year-boundary "On This Day"** — use day-of-year arithmetic with modular wrap at 365.
8. **Fix Recaps** — either generate mock data that includes recent dates, or make the cutoff relative to the data range.
9. **Add search debouncing** with `useDeferredValue` or a debounce hook.
10. **Cap indexing progress** at `total` to prevent overshoot.

### Priority 4: Polish

11. **Implement or remove stub buttons** — dead buttons erode trust.
12. **Add actual `<video>` playback** in the viewer drawer.
13. **Use `csv.writer`** in the Python ingestion script.
