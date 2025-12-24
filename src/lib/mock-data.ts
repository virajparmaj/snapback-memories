import { MemoryItem, MonthSummary } from "@/types/memory";

// Locations pool for variety
const LOCATIONS = [
  { label: "Mumbai, Maharashtra, IN", latitude: 19.076, longitude: 72.8777 },
  { label: "Champaign, IL, USA", latitude: 40.1164, longitude: -88.2434 },
  { label: "Chicago, IL, USA", latitude: 41.8781, longitude: -87.6298 },
  { label: "New York, NY, USA", latitude: 40.7128, longitude: -74.006 },
  { label: "San Francisco, CA, USA", latitude: 37.7749, longitude: -122.4194 },
  { label: "Los Angeles, CA, USA", latitude: 34.0522, longitude: -118.2437 },
  { label: "London, UK", latitude: 51.5074, longitude: -0.1278 },
  { label: "Tokyo, Japan", latitude: 35.6762, longitude: 139.6503 },
  { label: "Paris, France", latitude: 48.8566, longitude: 2.3522 },
  { label: "Sydney, Australia", latitude: -33.8688, longitude: 151.2093 },
  undefined, // Some items have no location
  undefined,
  undefined,
];

const TAGS_POOL = [
  ["friends", "party"],
  ["travel", "vacation"],
  ["food", "restaurant"],
  ["sunset", "nature"],
  ["selfie"],
  ["concert", "music"],
  ["work", "office"],
  ["pet", "dog"],
  ["pet", "cat"],
  ["family"],
  ["beach", "summer"],
  ["snow", "winter"],
  [],
  [],
  [],
];

// Generate a random UUID
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Seeded random for consistent data
function seededRandom(seed: number): () => number {
  return function () {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

// Generate mock memories
export function generateMockMemories(count: number = 8016): MemoryItem[] {
  const random = seededRandom(42);
  const memories: MemoryItem[] = [];

  const startYear = 2020;
  const endYear = 2025;

  for (let i = 0; i < count; i++) {
    const year = startYear + Math.floor(random() * (endYear - startYear + 1));
    const month = 1 + Math.floor(random() * 12);
    const daysInMonth = new Date(year, month, 0).getDate();
    const day = 1 + Math.floor(random() * daysInMonth);

    const hour = Math.floor(random() * 24);
    const minute = Math.floor(random() * 60);
    const second = Math.floor(random() * 60);

    const capturedDate = new Date(year, month - 1, day, hour, minute, second);
    const isVideo = random() < 0.35;

    const locationData = LOCATIONS[Math.floor(random() * LOCATIONS.length)];
    const tagsData = TAGS_POOL[Math.floor(random() * TAGS_POOL.length)];
    const isFavorite = random() < 0.1;

    const memory: MemoryItem = {
      id: generateUUID(),
      type: isVideo ? "video" : "photo",
      filename_original: isVideo
        ? `SNAP_${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}_${i}.mp4`
        : `SNAP_${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}_${i}.jpg`,
      filepath: `/library/memories/${year}/${String(month).padStart(2, "0")}/${isVideo ? "video" : "photo"}_${i}`,
      captured_at_utc: capturedDate.toISOString(),
      captured_at_local: capturedDate.toISOString(),
      timezone_hint: "America/Chicago",
      year,
      month,
      day,
      favorite: isFavorite,
      tags: tagsData,
      size_bytes: Math.floor(random() * 5000000) + 100000,
    };

    if (locationData) {
      memory.location = locationData;
    }

    if (isVideo) {
      memory.duration_sec = Math.floor(random() * 60) + 1;
    }

    // Generate placeholder thumbnail URL using a gradient pattern
    const hue = (year * 50 + month * 20 + day * 5) % 360;
    memory.thumbnail_url = `https://picsum.photos/seed/${memory.id.slice(0, 8)}/300/300`;

    memories.push(memory);
  }

  // Sort by date descending (newest first)
  memories.sort(
    (a, b) =>
      new Date(b.captured_at_utc).getTime() - new Date(a.captured_at_utc).getTime()
  );

  return memories;
}

// Generate month summaries from memories
export function generateMonthSummaries(memories: MemoryItem[]): MonthSummary[] {
  const summaryMap = new Map<string, MonthSummary>();

  memories.forEach((memory) => {
    const key = `${memory.year}-${memory.month}`;
    if (!summaryMap.has(key)) {
      summaryMap.set(key, {
        year: memory.year,
        month: memory.month,
        count: 0,
      });
    }
    summaryMap.get(key)!.count++;
  });

  return Array.from(summaryMap.values()).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
}

// Get "On This Day" memories
export function getOnThisDayMemories(
  memories: MemoryItem[],
  month: number,
  day: number,
  windowDays: number = 3
): MemoryItem[] {
  return memories.filter((memory) => {
    const memoryDate = new Date(memory.captured_at_utc);
    const memoryMonth = memoryDate.getMonth() + 1;
    const memoryDay = memoryDate.getDate();

    // Check if within window
    const targetDate = new Date(2000, month - 1, day);
    const checkDate = new Date(2000, memoryMonth - 1, memoryDay);

    const diffDays = Math.abs(
      (targetDate.getTime() - checkDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return diffDays <= windowDays;
  });
}

// Get memories for a specific month
export function getMemoriesForMonth(
  memories: MemoryItem[],
  year: number,
  month: number
): MemoryItem[] {
  return memories.filter(
    (memory) => memory.year === year && memory.month === month
  );
}

// Format month name
export function formatMonthYear(year: number, month: number): string {
  const date = new Date(year, month - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// Get recent highlights
export function getRecentHighlights(
  memories: MemoryItem[],
  days: number = 7
): { highlights: MemoryItem[]; stats: { photos: number; videos: number } } {
  const now = new Date();
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const recentMemories = memories.filter(
    (m) => new Date(m.captured_at_utc) >= cutoff
  );

  const photos = recentMemories.filter((m) => m.type === "photo").length;
  const videos = recentMemories.filter((m) => m.type === "video").length;

  // Get a sample of highlights (favorites first, then random)
  const favorites = recentMemories.filter((m) => m.favorite);
  const others = recentMemories.filter((m) => !m.favorite);
  const highlights = [...favorites, ...others].slice(0, 20);

  return {
    highlights,
    stats: { photos, videos },
  };
}

// Singleton instance of mock data
let mockMemoriesCache: MemoryItem[] | null = null;

export function getMockMemories(): MemoryItem[] {
  if (!mockMemoriesCache) {
    mockMemoriesCache = generateMockMemories();
  }
  return mockMemoriesCache;
}
