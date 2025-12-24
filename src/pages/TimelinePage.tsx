import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { Search, CalendarDays } from "lucide-react";
import { MemoryCard } from "@/components/timeline/MemoryCard";
import { MonthScrubber } from "@/components/timeline/MonthScrubber";
import { FilterChips } from "@/components/timeline/FilterChips";
import { MemoryViewerDrawer } from "@/components/viewer/MemoryViewerDrawer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api/adapter";
import { useAppStore } from "@/stores/app-store";
import { formatMonthYear } from "@/lib/mock-data";
import { MemoryItem, MonthSummary } from "@/types/memory";
import { cn } from "@/lib/utils";

// Number of columns based on screen width
const getColumns = (width: number) => {
  if (width >= 1536) return 6;
  if (width >= 1280) return 5;
  if (width >= 1024) return 4;
  if (width >= 768) return 3;
  if (width >= 640) return 3;
  return 2;
};

// Calculate row height based on column width and 9:16 aspect ratio
const getRowHeight = (containerWidth: number, columns: number, gap: number = 8) => {
  const totalGaps = (columns - 1) * gap;
  const availableWidth = containerWidth - 32 - totalGaps; // 32px for container padding
  const cardWidth = availableWidth / columns;
  const cardHeight = cardWidth * (16 / 9);
  return cardHeight + gap; // Add gap for spacing between rows
};

export default function TimelinePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const columns = getColumns(containerWidth);

  const {
    activeFilter,
    setFilter,
    searchQuery,
    setSearchQuery,
    scrollToMonth,
    setScrollToMonth,
    openViewer,
    isViewerOpen,
    selectedMemoryId,
    closeViewer,
    timeDisplayMode,
    setCurrentMemories,
    updateMemoryFavorite,
    updateMemoryTags,
  } = useAppStore();

  // Fetch months summary
  const { data: months = [] } = useQuery({
    queryKey: ["months"],
    queryFn: () => api.getMonths(),
  });

  // Fetch all memories with infinite scroll
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["memories", activeFilter, searchQuery],
    queryFn: ({ pageParam }) =>
      api.getMemories({
        cursor: pageParam,
        limit: 200,
        filter: activeFilter,
        search: searchQuery || undefined,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
  });

  // Flatten all memories
  const allMemories = useMemo(() => {
    const items = data?.pages.flatMap((page) => page.items) ?? [];
    setCurrentMemories(items);
    return items;
  }, [data?.pages, setCurrentMemories]);

  // Group memories by month
  const groupedMemories = useMemo(() => {
    const groups: { key: string; year: number; month: number; items: MemoryItem[] }[] = [];
    const monthMap = new Map<string, MemoryItem[]>();

    allMemories.forEach((memory) => {
      const key = `${memory.year}-${memory.month}`;
      if (!monthMap.has(key)) {
        monthMap.set(key, []);
      }
      monthMap.get(key)!.push(memory);
    });

    monthMap.forEach((items, key) => {
      const [year, month] = key.split("-").map(Number);
      groups.push({ key, year, month, items });
    });

    groups.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

    return groups;
  }, [allMemories]);

  // Create rows for virtualization (headers + item rows)
  const rows = useMemo(() => {
    const result: { type: "header" | "items"; data: unknown }[] = [];

    groupedMemories.forEach((group) => {
      // Add month header
      result.push({
        type: "header",
        data: { year: group.year, month: group.month, count: group.items.length },
      });

      // Add item rows (chunked by columns)
      for (let i = 0; i < group.items.length; i += columns) {
        result.push({
          type: "items",
          data: group.items.slice(i, i + columns),
        });
      }
    });

    return result;
  }, [groupedMemories, columns]);

  // Calculate row height for virtualization
  const rowHeight = useMemo(() => getRowHeight(containerWidth, columns), [containerWidth, columns]);

  // Virtualizer
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: (index) => (rows[index].type === "header" ? 48 : rowHeight),
    overscan: 3,
  });

  // Track active month for scrubber
  const [activeMonth, setActiveMonth] = useState<{ year: number; month: number } | null>(null);

  // Update container width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  // Scroll to month when requested
  useEffect(() => {
    if (scrollToMonth && containerRef.current) {
      const rowIndex = rows.findIndex(
        (row) =>
          row.type === "header" &&
          (row.data as { year: number; month: number }).year === scrollToMonth.year &&
          (row.data as { year: number; month: number }).month === scrollToMonth.month
      );

      if (rowIndex !== -1) {
        virtualizer.scrollToIndex(rowIndex, { align: "start" });
      }

      setScrollToMonth(null);
    }
  }, [scrollToMonth, rows, virtualizer, setScrollToMonth]);

  // Update active month based on scroll position
  useEffect(() => {
    const items = virtualizer.getVirtualItems();
    if (items.length > 0) {
      const firstVisible = items[0];
      let headerIndex = firstVisible.index;

      // Find the closest header above the current position
      while (headerIndex >= 0 && rows[headerIndex].type !== "header") {
        headerIndex--;
      }

      if (headerIndex >= 0 && rows[headerIndex].type === "header") {
        const headerData = rows[headerIndex].data as { year: number; month: number };
        if (activeMonth?.year !== headerData.year || activeMonth?.month !== headerData.month) {
          setActiveMonth(headerData);
        }
      }
    }
  }, [virtualizer.getVirtualItems(), rows, activeMonth]);

  // Load more when scrolling near bottom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop - clientHeight < 500 && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handle month click from scrubber
  const handleMonthClick = useCallback(
    (year: number, month: number) => {
      setScrollToMonth({ year, month });
    },
    [setScrollToMonth]
  );

  // Find current memory for viewer navigation
  const currentMemoryIndex = useMemo(
    () => allMemories.findIndex((m) => m.id === selectedMemoryId),
    [allMemories, selectedMemoryId]
  );

  const currentMemory = currentMemoryIndex >= 0 ? allMemories[currentMemoryIndex] : null;

  const handlePrev = useCallback(() => {
    if (currentMemoryIndex > 0) {
      openViewer(allMemories[currentMemoryIndex - 1].id);
    }
  }, [currentMemoryIndex, allMemories, openViewer]);

  const handleNext = useCallback(() => {
    if (currentMemoryIndex < allMemories.length - 1) {
      openViewer(allMemories[currentMemoryIndex + 1].id);
    }
  }, [currentMemoryIndex, allMemories, openViewer]);

  // Date picker for jump to date
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const handleDateSelect = useCallback(
    (date: Date | undefined) => {
      if (date) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        setScrollToMonth({ year, month });
        setDatePickerOpen(false);
      }
    },
    [setScrollToMonth]
  );

  return (
    <div className="relative h-[calc(100vh-3.5rem)]">
      {/* Toolbar */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="container max-w-screen-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Filters */}
          <FilterChips activeFilter={activeFilter} onFilterChange={setFilter} />

          <div className="flex-1" />

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search location, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-secondary border-border"
            />
          </div>

          {/* Jump to date */}
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="secondary" size="sm">
                <CalendarDays className="h-4 w-4 mr-2" />
                Jump to Date
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                onSelect={handleDateSelect}
                defaultMonth={new Date(2023, 11)}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Month Scrubber */}
      <MonthScrubber
        months={months}
        activeMonth={activeMonth}
        onMonthClick={handleMonthClick}
      />

      {/* Virtual scroll container */}
      <div
        ref={containerRef}
        className="h-[calc(100vh-3.5rem-60px)] overflow-y-auto scrollbar-hide pr-16 lg:pr-20"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {isLoading ? (
            // Loading skeleton
            <div className="container max-w-screen-2xl px-4 py-6 space-y-8">
              {[1, 2].map((i) => (
                <div key={i}>
                  <Skeleton className="h-8 w-48 mb-4" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
                    {Array.from({ length: 12 }).map((_, j) => (
                      <Skeleton key={j} className="aspect-square rounded-xl" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];

              return (
                <div
                  key={virtualRow.key}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {row.type === "header" ? (
                    <div className="container max-w-screen-2xl px-4 py-2">
                      <h2 className="text-lg font-bold text-foreground">
                        {formatMonthYear(
                          (row.data as { year: number; month: number }).year,
                          (row.data as { year: number; month: number }).month
                        )}
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          {(row.data as { count: number }).count} memories
                        </span>
                      </h2>
                    </div>
                  ) : (
                    <div className="container max-w-screen-2xl px-4">
                      <div
                        className="grid gap-2"
                        style={{
                          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                          gridAutoRows: "auto",
                        }}
                      >
                        {(row.data as MemoryItem[]).map((memory) => (
                          <MemoryCard
                            key={memory.id}
                            memory={memory}
                            onClick={() => openViewer(memory.id)}
                            isSelected={memory.id === selectedMemoryId}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Loading more indicator */}
        {isFetchingNextPage && (
          <div className="flex justify-center py-8">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>Loading more...</span>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && allMemories.length === 0 && (
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-1">No memories found</h3>
            <p className="text-muted-foreground">
              {searchQuery
                ? "Try adjusting your search or filters"
                : "Import your Snapchat memories to get started"}
            </p>
          </div>
        )}
      </div>

      {/* Memory Viewer Drawer */}
      <MemoryViewerDrawer
        memory={currentMemory}
        isOpen={isViewerOpen}
        onClose={closeViewer}
        onPrev={currentMemoryIndex > 0 ? handlePrev : undefined}
        onNext={currentMemoryIndex < allMemories.length - 1 ? handleNext : undefined}
        onFavoriteToggle={updateMemoryFavorite}
        onTagsUpdate={updateMemoryTags}
        timeDisplayMode={timeDisplayMode}
      />
    </div>
  );
}
