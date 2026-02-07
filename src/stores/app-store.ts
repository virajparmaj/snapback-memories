import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MonthSummary, MediaFilter, TimeDisplayMode } from "@/types/memory";
import { USE_MOCK } from "@/lib/api/adapter";

interface AppState {
  // Library state
  isLibraryConnected: boolean;
  libraryPath: string | null;
  totalItems: number;
  lastIndexedAt: string | null;

  // UI state
  selectedMemoryId: string | null;
  isViewerOpen: boolean;
  activeFilter: MediaFilter;
  searchQuery: string;
  scrollToMonth: { year: number; month: number } | null;

  // Settings
  timeDisplayMode: TimeDisplayMode;

  // Cached data
  months: MonthSummary[];

  // Actions
  setLibraryConnected: (connected: boolean, path?: string) => void;
  setLibraryStats: (total: number, lastIndexed: string) => void;
  selectMemory: (id: string | null) => void;
  openViewer: (id: string) => void;
  closeViewer: () => void;
  setFilter: (filter: MediaFilter) => void;
  setSearchQuery: (query: string) => void;
  setScrollToMonth: (month: { year: number; month: number } | null) => void;
  setTimeDisplayMode: (mode: TimeDisplayMode) => void;
  setMonths: (months: MonthSummary[]) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state — only pre-fill when running mock mode
      isLibraryConnected: USE_MOCK,
      libraryPath: USE_MOCK ? "/Users/demo/Snapchat/Memories" : null,
      totalItems: USE_MOCK ? 8016 : 0,
      lastIndexedAt: USE_MOCK ? new Date().toISOString() : null,

      selectedMemoryId: null,
      isViewerOpen: false,
      activeFilter: "all",
      searchQuery: "",
      scrollToMonth: null,

      timeDisplayMode: "local",

      months: [],

      // Actions
      setLibraryConnected: (connected, path) =>
        set({ isLibraryConnected: connected, libraryPath: path || null }),

      setLibraryStats: (total, lastIndexed) =>
        set({ totalItems: total, lastIndexedAt: lastIndexed }),

      selectMemory: (id) => set({ selectedMemoryId: id }),

      openViewer: (id) => set({ selectedMemoryId: id, isViewerOpen: true }),

      closeViewer: () => set({ isViewerOpen: false }),

      setFilter: (filter) => set({ activeFilter: filter }),

      setSearchQuery: (query) => set({ searchQuery: query }),

      setScrollToMonth: (month) => set({ scrollToMonth: month }),

      setTimeDisplayMode: (mode) => set({ timeDisplayMode: mode }),

      setMonths: (months) => set({ months }),
    }),
    {
      name: "snapback-storage",
      partialize: (state) => ({
        timeDisplayMode: state.timeDisplayMode,
        libraryPath: state.libraryPath,
      }),
    }
  )
);
