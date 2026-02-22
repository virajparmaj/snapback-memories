import { MediaFilter, MemoryItem, MonthSummary, PaginatedResponse, RecapData } from "@/types/memory";
import { generateMonthSummaries } from "@/lib/mock-data";

const DEMO_VIDEO_PATH = "/demo/demo-angel-loop.mp4";
const DEMO_VIDEO_THUMBNAIL = "/demo/demo-video-thumb.svg";
const DEMO_PHOTO_PATHS = [
  "/demo/demo-photo-1.svg",
  "/demo/demo-photo-2.svg",
  "/demo/demo-photo-3.svg",
  "/demo/demo-photo-4.svg",
] as const;

const BASE_DEMO_MEMORIES: MemoryItem[] = [
  {
    id: "demo-angel-2026-02-21-evening",
    type: "photo",
    filename_original: "2026-02-21_22-11-09Z__40.7128_-74.0060__demo-angel-01.jpg",
    filepath: DEMO_PHOTO_PATHS[0],
    thumbnail_url: DEMO_PHOTO_PATHS[0],
    captured_at_utc: "2026-02-21T22:11:09Z",
    captured_at_local: "2026-02-21T16:11:09-06:00",
    timezone_hint: "America/Chicago",
    year: 2026,
    month: 2,
    day: 21,
    location: {
      label: "New York, NY, USA",
      latitude: 40.7128,
      longitude: -74.006,
    },
    tags: ["night", "city"],
    favorite: true,
    size_bytes: 524288,
  },
  {
    id: "demo-angel-2026-02-20-drive",
    type: "video",
    filename_original: "2026-02-20_06-18-31Z__41.8781_-87.6298__demo-angel-02.mp4",
    filepath: DEMO_VIDEO_PATH,
    thumbnail_url: DEMO_VIDEO_THUMBNAIL,
    captured_at_utc: "2026-02-20T06:18:31Z",
    captured_at_local: "2026-02-20T00:18:31-06:00",
    timezone_hint: "America/Chicago",
    year: 2026,
    month: 2,
    day: 20,
    location: {
      label: "Chicago, IL, USA",
      latitude: 41.8781,
      longitude: -87.6298,
    },
    tags: ["drive", "late-night"],
    favorite: false,
    duration_sec: 3,
    size_bytes: 262144,
  },
  {
    id: "demo-angel-2026-02-18-cafe",
    type: "photo",
    filename_original: "2026-02-18_14-03-44Z__40.1164_-88.2434__demo-angel-03.jpg",
    filepath: DEMO_PHOTO_PATHS[1],
    thumbnail_url: DEMO_PHOTO_PATHS[1],
    captured_at_utc: "2026-02-18T14:03:44Z",
    captured_at_local: "2026-02-18T08:03:44-06:00",
    timezone_hint: "America/Chicago",
    year: 2026,
    month: 2,
    day: 18,
    location: {
      label: "Champaign, IL, USA",
      latitude: 40.1164,
      longitude: -88.2434,
    },
    tags: ["friends", "coffee"],
    favorite: true,
    size_bytes: 493211,
  },
  {
    id: "demo-angel-2025-11-03-stroll",
    type: "photo",
    filename_original: "2025-11-03_09-22-58Z__37.7749_-122.4194__demo-angel-04.jpg",
    filepath: DEMO_PHOTO_PATHS[2],
    thumbnail_url: DEMO_PHOTO_PATHS[2],
    captured_at_utc: "2025-11-03T09:22:58Z",
    captured_at_local: "2025-11-03T01:22:58-08:00",
    timezone_hint: "America/Los_Angeles",
    year: 2025,
    month: 11,
    day: 3,
    location: {
      label: "San Francisco, CA, USA",
      latitude: 37.7749,
      longitude: -122.4194,
    },
    tags: ["travel", "street"],
    favorite: false,
    size_bytes: 538221,
  },
  {
    id: "demo-angel-2024-02-22-sky",
    type: "photo",
    filename_original: "2024-02-22_17-41-19Z__34.0522_-118.2437__demo-angel-05.jpg",
    filepath: DEMO_PHOTO_PATHS[3],
    thumbnail_url: DEMO_PHOTO_PATHS[3],
    captured_at_utc: "2024-02-22T17:41:19Z",
    captured_at_local: "2024-02-22T09:41:19-08:00",
    timezone_hint: "America/Los_Angeles",
    year: 2024,
    month: 2,
    day: 22,
    location: {
      label: "Los Angeles, CA, USA",
      latitude: 34.0522,
      longitude: -118.2437,
    },
    tags: ["sunset", "sky"],
    favorite: false,
    size_bytes: 502144,
  },
  {
    id: "demo-angel-2023-02-24-lights",
    type: "video",
    filename_original: "2023-02-24_03-09-27Z__48.8566_2.3522__demo-angel-06.mp4",
    filepath: DEMO_VIDEO_PATH,
    thumbnail_url: DEMO_VIDEO_THUMBNAIL,
    captured_at_utc: "2023-02-24T03:09:27Z",
    captured_at_local: "2023-02-24T04:09:27+01:00",
    timezone_hint: "Europe/Paris",
    year: 2023,
    month: 2,
    day: 24,
    location: {
      label: "Paris, France",
      latitude: 48.8566,
      longitude: 2.3522,
    },
    tags: ["city", "lights"],
    favorite: false,
    duration_sec: 3,
    size_bytes: 271882,
  },
  {
    id: "demo-angel-2022-07-14-beach",
    type: "photo",
    filename_original: "2022-07-14_19-44-02Z__19.0760_72.8777__demo-angel-07.jpg",
    filepath: DEMO_PHOTO_PATHS[0],
    thumbnail_url: DEMO_PHOTO_PATHS[0],
    captured_at_utc: "2022-07-14T19:44:02Z",
    captured_at_local: "2022-07-15T01:14:02+05:30",
    timezone_hint: "Asia/Kolkata",
    year: 2022,
    month: 7,
    day: 14,
    location: {
      label: "Mumbai, Maharashtra, IN",
      latitude: 19.076,
      longitude: 72.8777,
    },
    tags: ["summer", "vacation"],
    favorite: false,
    size_bytes: 489120,
  },
  {
    id: "demo-angel-2021-12-31-midnight",
    type: "photo",
    filename_original: "2021-12-31_23-57-45Z__51.5074_-0.1278__demo-angel-08.jpg",
    filepath: DEMO_PHOTO_PATHS[2],
    thumbnail_url: DEMO_PHOTO_PATHS[2],
    captured_at_utc: "2021-12-31T23:57:45Z",
    captured_at_local: "2022-01-01T00:57:45+01:00",
    timezone_hint: "Europe/London",
    year: 2021,
    month: 12,
    day: 31,
    location: {
      label: "London, UK",
      latitude: 51.5074,
      longitude: -0.1278,
    },
    tags: ["new-year", "night"],
    favorite: true,
    size_bytes: 510221,
  },
].sort(
  (a, b) => new Date(b.captured_at_utc).getTime() - new Date(a.captured_at_utc).getTime()
);

function cloneMemory(memory: MemoryItem): MemoryItem {
  return {
    ...memory,
    tags: memory.tags ? [...memory.tags] : [],
    location: memory.location ? { ...memory.location } : undefined,
  };
}

export function createDemoMemories(): MemoryItem[] {
  return BASE_DEMO_MEMORIES.map(cloneMemory);
}

export function filterDemoMemories(
  memories: MemoryItem[],
  params: {
    year?: number;
    month?: number;
    filter?: MediaFilter;
    search?: string;
  }
): MemoryItem[] {
  let filtered = [...memories];

  if (params.year && params.month) {
    filtered = filtered.filter((m) => m.year === params.year && m.month === params.month);
  }

  if (params.filter === "photos") {
    filtered = filtered.filter((m) => m.type === "photo");
  } else if (params.filter === "videos") {
    filtered = filtered.filter((m) => m.type === "video");
  } else if (params.filter === "favorites") {
    filtered = filtered.filter((m) => m.favorite);
  }

  if (params.search) {
    const query = params.search.toLowerCase();
    filtered = filtered.filter(
      (m) =>
        m.filename_original.toLowerCase().includes(query) ||
        m.location?.label?.toLowerCase().includes(query) ||
        m.tags?.some((tag) => tag.toLowerCase().includes(query))
    );
  }

  return filtered;
}

export function paginateDemoMemories(
  memories: MemoryItem[],
  cursor?: string,
  limit: number = 200
): PaginatedResponse<MemoryItem> {
  const safeLimit = Math.max(1, limit);
  const cursorIndex = cursor ? memories.findIndex((m) => m.id === cursor) : 0;
  const startIndex = cursorIndex === -1 ? 0 : cursorIndex;

  const items = memories.slice(startIndex, startIndex + safeLimit);
  const nextCursor =
    startIndex + safeLimit < memories.length
      ? memories[startIndex + safeLimit]?.id
      : undefined;

  return { items, nextCursor };
}

export function getDemoMonths(memories: MemoryItem[]): MonthSummary[] {
  return generateMonthSummaries(memories);
}

function dayOfYear(month: number, day: number): number {
  const daysBeforeMonth = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  return daysBeforeMonth[month - 1] + day;
}

export function getDemoOnThisDay(
  memories: MemoryItem[],
  month: number,
  day: number,
  windowDays: number = 3
): MemoryItem[] {
  const targetDOY = dayOfYear(month, day);

  const ranked = memories
    .map((memory) => {
      const memoryDOY = dayOfYear(memory.month, memory.day);
      const diff = Math.abs(targetDOY - memoryDOY);
      const circularDiff = Math.min(diff, 365 - diff);
      return { memory, distance: circularDiff };
    })
    .sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      return (
        new Date(b.memory.captured_at_utc).getTime() -
        new Date(a.memory.captured_at_utc).getTime()
      );
    });

  const exactMatches = ranked
    .filter((entry) => entry.distance <= windowDays)
    .map((entry) => entry.memory);

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  // Keep the page useful in preview mode even when exact date matches are absent.
  return ranked.slice(0, Math.min(6, ranked.length)).map((entry) => entry.memory);
}

export function getDemoRecentRecap(memories: MemoryItem[], days: number = 7): RecapData {
  const now = new Date();
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const recentMemories = memories.filter((m) => new Date(m.captured_at_utc) >= cutoff);
  const source = recentMemories.length > 0 ? recentMemories : memories;

  const photos = source.filter((m) => m.type === "photo").length;
  const videos = source.filter((m) => m.type === "video").length;

  const favorites = source.filter((m) => m.favorite);
  const others = source.filter((m) => !m.favorite);

  return {
    highlights: [...favorites, ...others].slice(0, 20),
    stats: { photos, videos },
  };
}

export function getDemoThumbnailUrl(memory: MemoryItem): string {
  return memory.thumbnail_url || DEMO_PHOTO_PATHS[0];
}

export function getDemoMediaUrl(memory: MemoryItem): string {
  if (memory.type === "video") {
    return DEMO_VIDEO_PATH;
  }
  return memory.filepath || memory.thumbnail_url || DEMO_PHOTO_PATHS[0];
}
