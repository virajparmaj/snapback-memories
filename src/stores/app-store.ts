import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MemoryItem, MonthSummary, MediaFilter, TimeDisplayMode } from "@/types/memory";

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
  currentMemories: MemoryItem[];

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
  setCurrentMemories: (memories: MemoryItem[]) => void;
  updateMemoryFavorite: (id: string, favorite: boolean) => void;
  updateMemoryTags: (id: string, tags: string[]) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      isLibraryConnected: true, // Start as connected for mock mode
      libraryPath: "/Users/demo/Snapchat/Memories",
      totalItems: 8016,
      lastIndexedAt: new Date().toISOString(),

      selectedMemoryId: null,
      isViewerOpen: false,
      activeFilter: "all",
      searchQuery: "",
      scrollToMonth: null,

      timeDisplayMode: "local",

      months: [],
      currentMemories: [],

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

      setCurrentMemories: (memories) => set({ currentMemories: memories }),

      updateMemoryFavorite: (id, favorite) =>
        set((state) => ({
          currentMemories: state.currentMemories.map((m) =>
            m.id === id ? { ...m, favorite } : m
          ),
        })),

      updateMemoryTags: (id, tags) =>
        set((state) => ({
          currentMemories: state.currentMemories.map((m) =>
            m.id === id ? { ...m, tags } : m
          ),
        })),
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
