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
import {
  createDemoMemories,
  filterDemoMemories,
  getDemoMediaUrl,
  getDemoMonths,
  getDemoOnThisDay,
  getDemoRecentRecap,
  getDemoThumbnailUrl,
  paginateDemoMemories,
} from "@/lib/demo-data";

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
    const filtered = filterDemoMemories(this.memories, {
      year: params.year,
      month: params.month,
      filter: params.filter,
      search: params.search,
    });

    return paginateDemoMemories(filtered, params.cursor, params.limit || 200);
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
    return memory ? getDemoThumbnailUrl(memory) : "/demo/demo-photo-1.svg";
  }

  getMediaUrl(id: string): string {
    const memory = this.memories.find((m) => m.id === id);
    return memory ? getDemoMediaUrl(memory) : "/demo/demo-photo-1.svg";
  }
}

// Real API Implementation with automatic local demo fallback
class LocalApiAdapter implements ApiAdapter {
  private readonly demoMemories = createDemoMemories();
  private readonly demoById = new Map(this.demoMemories.map((memory) => [memory.id, memory]));
  private cachedStatus: { fetchedAt: number; value: LibraryStatus } | null = null;
  private readonly statusCacheMs = 15_000;

  private async fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }

  private async postJson(url: string, body: unknown): Promise<void> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }
  }

  private async fetchLibraryStatusCached(forceRefresh = false): Promise<LibraryStatus> {
    const now = Date.now();
    if (
      !forceRefresh &&
      this.cachedStatus &&
      now - this.cachedStatus.fetchedAt < this.statusCacheMs
    ) {
      return this.cachedStatus.value;
    }

    const status = await this.fetchJson<LibraryStatus>(`${API_BASE}/library/status`);
    this.cachedStatus = { fetchedAt: now, value: status };
    return status;
  }

  private async shouldUseDemoFallback(): Promise<boolean> {
    try {
      const status = await this.fetchLibraryStatusCached();
      return !status.indexed || status.totalItems === 0;
    } catch {
      // If backend is unavailable, keep UI usable with local preview data.
      return true;
    }
  }

  private getDemoMemoriesResponse(params: {
    year?: number;
    month?: number;
    cursor?: string;
    limit?: number;
    filter?: MediaFilter;
    search?: string;
  }): PaginatedResponse<MemoryItem> {
    const filtered = filterDemoMemories(this.demoMemories, {
      year: params.year,
      month: params.month,
      filter: params.filter,
      search: params.search,
    });

    return paginateDemoMemories(filtered, params.cursor, params.limit || 200);
  }

  async checkHealth() {
    return this.fetchJson<{ ok: boolean; version: string }>(`${API_BASE}/health`);
  }

  async getLibraryStatus(): Promise<LibraryStatus> {
    return this.fetchLibraryStatusCached(true);
  }

  async startIndexing(options: IndexingOptions): Promise<void> {
    await this.postJson(`${API_BASE}/library/index`, options);
    this.cachedStatus = null;
  }

  async getIndexingStatus(): Promise<IndexingStatus> {
    return this.fetchJson<IndexingStatus>(`${API_BASE}/library/index/status`);
  }

  async getMonths(): Promise<MonthSummary[]> {
    if (await this.shouldUseDemoFallback()) {
      return getDemoMonths(this.demoMemories);
    }
    return this.fetchJson<MonthSummary[]>(`${API_BASE}/months`);
  }

  async getMemories(params: {
    year?: number;
    month?: number;
    cursor?: string;
    limit?: number;
    filter?: MediaFilter;
    search?: string;
  }): Promise<PaginatedResponse<MemoryItem>> {
    if (await this.shouldUseDemoFallback()) {
      return this.getDemoMemoriesResponse(params);
    }

    const searchParams = new URLSearchParams();
    if (params.year) searchParams.set("year", String(params.year));
    if (params.month) searchParams.set("month", String(params.month));
    if (params.cursor) searchParams.set("cursor", params.cursor);
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.filter) searchParams.set("filter", params.filter);
    if (params.search) searchParams.set("search", params.search);

    return this.fetchJson<PaginatedResponse<MemoryItem>>(
      `${API_BASE}/memories?${searchParams.toString()}`
    );
  }

  async getMemory(id: string): Promise<MemoryItem> {
    const demoMemory = this.demoById.get(id);
    if (demoMemory) {
      return demoMemory;
    }

    return this.fetchJson<MemoryItem>(`${API_BASE}/memories/${id}`);
  }

  async getOnThisDay(
    month: number,
    day: number,
    window: number = 3
  ): Promise<MemoryItem[]> {
    if (await this.shouldUseDemoFallback()) {
      return getDemoOnThisDay(this.demoMemories, month, day, window);
    }

    return this.fetchJson<MemoryItem[]>(
      `${API_BASE}/on-this-day?month=${month}&day=${day}&window=${window}`
    );
  }

  async getRecentRecap(days: number = 7): Promise<RecapData> {
    if (await this.shouldUseDemoFallback()) {
      return getDemoRecentRecap(this.demoMemories, days);
    }

    return this.fetchJson<RecapData>(`${API_BASE}/recaps/recent?days=${days}`);
  }

  async setFavorite(id: string, favorite: boolean): Promise<void> {
    const demoMemory = this.demoById.get(id);
    if (demoMemory) {
      demoMemory.favorite = favorite;
      return;
    }

    await this.postJson(`${API_BASE}/memories/${id}/favorite`, { favorite });
  }

  async setTags(id: string, tags: string[]): Promise<void> {
    const demoMemory = this.demoById.get(id);
    if (demoMemory) {
      demoMemory.tags = tags;
      return;
    }

    await this.postJson(`${API_BASE}/memories/${id}/tags`, { tags });
  }

  getThumbnailUrl(id: string): string {
    const demoMemory = this.demoById.get(id);
    if (demoMemory) {
      return getDemoThumbnailUrl(demoMemory);
    }

    return `${API_BASE}/thumb/${id}`;
  }

  getMediaUrl(id: string): string {
    const demoMemory = this.demoById.get(id);
    if (demoMemory) {
      return getDemoMediaUrl(demoMemory);
    }

    return `${API_BASE}/media/${id}`;
  }
}

// Export the appropriate adapter based on configuration
export const api: ApiAdapter = USE_MOCK ? new MockApiAdapter() : new LocalApiAdapter();
