export interface MemoryLocation {
  latitude?: number;
  longitude?: number;
  label?: string;
}

export interface MemoryItem {
  id: string;
  type: "photo" | "video";
  filename_original: string;
  filepath: string;
  captured_at_utc: string;
  captured_at_local?: string;
  timezone_hint?: string;
  location?: MemoryLocation;
  thumbnail_path?: string;
  thumbnail_url?: string;
  duration_sec?: number;
  size_bytes?: number;
  tags?: string[];
  favorite?: boolean;
  sha1?: string;
  year: number;
  month: number;
  day: number;
}

export interface MonthSummary {
  year: number;
  month: number;
  count: number;
}

export interface LibraryStatus {
  libraryPath: string;
  indexed: boolean;
  totalItems: number;
  lastIndexedAt?: string;
}

export interface IndexingStatus {
  state: "idle" | "running" | "done" | "error";
  progress: {
    scanned: number;
    total: number;
  };
  logs: string[];
}

export interface IndexingOptions {
  folderPath: string;
  options: {
    generateThumbs: boolean;
    resolveLocations: boolean;
    renameStrategy: "none" | "copy_organized" | "in_place_safe";
  };
}

export interface RecapData {
  highlights: MemoryItem[];
  stats: {
    photos: number;
    videos: number;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
}

export type MediaFilter = "all" | "photos" | "videos" | "favorites";

export type TimeDisplayMode = "local" | "utc";
