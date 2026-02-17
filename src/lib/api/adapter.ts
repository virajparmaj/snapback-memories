import {
  MemoryItem,
  MonthSummary,
  LibraryStatus,
  IndexingStatus,
  IndexingOptions,
  RecapData,
  PaginatedResponse,
  MediaFilter,
} from "@/types/memory";
import {
  getMockMemories,
  generateMonthSummaries,
  getOnThisDayMemories,
  getRecentHighlights,
} from "@/lib/mock-data";

// Toggle between mock and real API
export const USE_MOCK = false;
const API_BASE = "http://localhost:5055";

// API Interface
export interface ApiAdapter {
  checkHealth(): Promise<{ ok: boolean; version: string }>;
  getLibraryStatus(): Promise<LibraryStatus>;
  startIndexing(options: IndexingOptions): Promise<void>;
  getIndexingStatus(): Promise<IndexingStatus>;
  getMonths(): Promise<MonthSummary[]>;
  getMemories(params: {
    year?: number;
    month?: number;
    cursor?: string;
    limit?: number;
    filter?: MediaFilter;
    search?: string;
  }): Promise<PaginatedResponse<MemoryItem>>;
  getMemory(id: string): Promise<MemoryItem>;
  getOnThisDay(month: number, day: number, window?: number): Promise<MemoryItem[]>;
  getRecentRecap(days?: number): Promise<RecapData>;
  setFavorite(id: string, favorite: boolean): Promise<void>;
  setTags(id: string, tags: string[]): Promise<void>;
  getThumbnailUrl(id: string): string;
  getMediaUrl(id: string): string;
}

// Mock API Implementation
class MockApiAdapter implements ApiAdapter {
  private memories = getMockMemories();
  private monthSummaries = generateMonthSummaries(this.memories);
  private indexingState: IndexingStatus = {
    state: "idle",
    progress: { scanned: 0, total: 0 },
    logs: [],
  };

  async checkHealth() {
    return { ok: true, version: "1.0.0-mock" };
  }

  async getLibraryStatus(): Promise<LibraryStatus> {
    return {
      libraryPath: "/Users/demo/Snapchat/Memories",
      indexed: true,
      totalItems: this.memories.length,
      lastIndexedAt: new Date().toISOString(),
    };
  }

  async startIndexing(options: IndexingOptions): Promise<void> {
    this.indexingState = {
      state: "running",
      progress: { scanned: 0, total: 8016 },
      logs: ["Starting indexing...", `Scanning ${options.folderPath}`],
    };

    // Simulate progress
    const interval = setInterval(() => {
      if (this.indexingState.progress.scanned < this.indexingState.progress.total) {
        this.indexingState.progress.scanned = Math.min(
          this.indexingState.progress.scanned + Math.floor(Math.random() * 200) + 100,
          this.indexingState.progress.total
        );
        this.indexingState.logs.push(
          `Processed ${this.indexingState.progress.scanned} items...`
        );
      } else {
        this.indexingState.state = "done";
        this.indexingState.logs.push("Indexing complete!");
        clearInterval(interval);
      }
    }, 500);
  }

  async getIndexingStatus(): Promise<IndexingStatus> {
    return this.indexingState;
  }

  async getMonths(): Promise<MonthSummary[]> {
    return this.monthSummaries;
  }

  async getMemories(params: {
    year?: number;
    month?: number;
    cursor?: string;
    limit?: number;
    filter?: MediaFilter;
    search?: string;
  }): Promise<PaginatedResponse<MemoryItem>> {
    let filtered = [...this.memories];

    // Filter by year/month
    if (params.year && params.month) {
      filtered = filtered.filter(
        (m) => m.year === params.year && m.month === params.month
      );
    }

    // Filter by type
    if (params.filter === "photos") {
      filtered = filtered.filter((m) => m.type === "photo");
    } else if (params.filter === "videos") {
      filtered = filtered.filter((m) => m.type === "video");
    } else if (params.filter === "favorites") {
      filtered = filtered.filter((m) => m.favorite);
    }

    // Search
    if (params.search) {
      const query = params.search.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.filename_original.toLowerCase().includes(query) ||
          m.location?.label?.toLowerCase().includes(query) ||
          m.tags?.some((t) => t.toLowerCase().includes(query))
      );
    }

    // Pagination
    const limit = params.limit || 200;
    const cursorIndex = params.cursor
      ? filtered.findIndex((m) => m.id === params.cursor)
      : 0;
    const startIndex = cursorIndex === -1 ? 0 : cursorIndex;
    const items = filtered.slice(startIndex, startIndex + limit);
    const nextCursor =
      startIndex + limit < filtered.length
        ? filtered[startIndex + limit]?.id
        : undefined;

    return { items, nextCursor };
  }

  async getMemory(id: string): Promise<MemoryItem> {
    const memory = this.memories.find((m) => m.id === id);
    if (!memory) throw new Error("Memory not found");
    return memory;
  }

  async getOnThisDay(
    month: number,
    day: number,
    window: number = 3
  ): Promise<MemoryItem[]> {
    return getOnThisDayMemories(this.memories, month, day, window);
  }

  async getRecentRecap(days: number = 7): Promise<RecapData> {
    return getRecentHighlights(this.memories, days);
  }

  async setFavorite(id: string, favorite: boolean): Promise<void> {
    const memory = this.memories.find((m) => m.id === id);
    if (memory) {
      memory.favorite = favorite;
    }
  }

  async setTags(id: string, tags: string[]): Promise<void> {
    const memory = this.memories.find((m) => m.id === id);
    if (memory) {
      memory.tags = tags;
    }
  }

  getThumbnailUrl(id: string): string {
    const memory = this.memories.find((m) => m.id === id);
    return memory?.thumbnail_url || `https://picsum.photos/seed/${id.slice(0, 8)}/300/300`;
  }

  getMediaUrl(id: string): string {
    const memory = this.memories.find((m) => m.id === id);
    return memory?.thumbnail_url || `https://picsum.photos/seed/${id.slice(0, 8)}/800/800`;
  }
}

// Real API Implementation (stub for later)
class LocalApiAdapter implements ApiAdapter {
  async checkHealth() {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  }

  async getLibraryStatus(): Promise<LibraryStatus> {
    const res = await fetch(`${API_BASE}/library/status`);
    return res.json();
  }

  async startIndexing(options: IndexingOptions): Promise<void> {
    await fetch(`${API_BASE}/library/index`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });
  }

  async getIndexingStatus(): Promise<IndexingStatus> {
    const res = await fetch(`${API_BASE}/library/index/status`);
    return res.json();
  }

  async getMonths(): Promise<MonthSummary[]> {
    const res = await fetch(`${API_BASE}/months`);
    return res.json();
  }

  async getMemories(params: {
    year?: number;
    month?: number;
    cursor?: string;
    limit?: number;
    filter?: MediaFilter;
    search?: string;
  }): Promise<PaginatedResponse<MemoryItem>> {
    const searchParams = new URLSearchParams();
    if (params.year) searchParams.set("year", String(params.year));
    if (params.month) searchParams.set("month", String(params.month));
    if (params.cursor) searchParams.set("cursor", params.cursor);
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.filter) searchParams.set("filter", params.filter);
    if (params.search) searchParams.set("search", params.search);

    const res = await fetch(`${API_BASE}/memories?${searchParams}`);
    return res.json();
  }

  async getMemory(id: string): Promise<MemoryItem> {
    const res = await fetch(`${API_BASE}/memories/${id}`);
    return res.json();
  }

  async getOnThisDay(
    month: number,
    day: number,
    window: number = 3
  ): Promise<MemoryItem[]> {
    const res = await fetch(
      `${API_BASE}/on-this-day?month=${month}&day=${day}&window=${window}`
    );
    return res.json();
  }

  async getRecentRecap(days: number = 7): Promise<RecapData> {
    const res = await fetch(`${API_BASE}/recaps/recent?days=${days}`);
    return res.json();
  }

  async setFavorite(id: string, favorite: boolean): Promise<void> {
    await fetch(`${API_BASE}/memories/${id}/favorite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite }),
    });
  }

  async setTags(id: string, tags: string[]): Promise<void> {
    await fetch(`${API_BASE}/memories/${id}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });
  }

  getThumbnailUrl(id: string): string {
    return `${API_BASE}/thumb/${id}`;
  }

  getMediaUrl(id: string): string {
    return `${API_BASE}/media/${id}`;
  }
}

// Export the appropriate adapter based on configuration
export const api: ApiAdapter = USE_MOCK ? new MockApiAdapter() : new LocalApiAdapter();
