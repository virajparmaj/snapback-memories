import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Shuffle, Play, ChevronRight } from "lucide-react";
import { api } from "@/lib/api/adapter";
import { MemoryCard } from "@/components/timeline/MemoryCard";
import { MemoryViewerDrawer } from "@/components/viewer/MemoryViewerDrawer";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

export default function OnThisDayPage() {
  const [windowDays, setWindowDays] = useState(3);
  const { timeDisplayMode, updateMemoryFavorite, updateMemoryTags } = useAppStore();

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  // Fetch memories for this day
  const { data: memories = [], isLoading } = useQuery({
    queryKey: ["on-this-day", currentMonth, currentDay, windowDays],
    queryFn: () => api.getOnThisDay(currentMonth, currentDay, windowDays),
  });

  // Group by year
  const groupedByYear = useMemo(() => {
    const groups: Record<number, typeof memories> = {};
    memories.forEach((memory) => {
      if (!groups[memory.year]) groups[memory.year] = [];
      groups[memory.year].push(memory);
    });
    return Object.entries(groups)
      .map(([year, items]) => ({ year: Number(year), items }))
      .sort((a, b) => b.year - a.year);
  }, [memories]);

  // Viewer state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const selectedMemory = memories.find((m) => m.id === selectedId);
  const selectedIndex = memories.findIndex((m) => m.id === selectedId);

  const windowOptions = [
    { value: 0, label: "Exact day" },
    { value: 3, label: "±3 days" },
    { value: 7, label: "±7 days" },
  ];

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      {/* Hero section */}
      <div className="relative py-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
        <div className="container max-w-screen-2xl px-4 relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
              <CalendarDays className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">On This Day</h1>
              <p className="text-muted-foreground">
                {today.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          {/* Window toggle */}
          <div className="flex flex-wrap items-center gap-3 mt-6">
            <span className="text-sm text-muted-foreground">Show memories from:</span>
            <div className="flex gap-2">
              {windowOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setWindowDays(option.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                    windowDays === option.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex-1" />

            {/* Quick actions */}
            <Button variant="secondary" size="sm">
              <Shuffle className="h-4 w-4 mr-2" />
              Shuffle
            </Button>
            <Button size="sm">
              <Play className="h-4 w-4 mr-2" />
              Play Highlights
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-screen-2xl px-4 pb-12">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>Loading memories...</span>
            </div>
          </div>
        ) : memories.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-secondary mx-auto flex items-center justify-center mb-4">
              <CalendarDays className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-medium mb-2">No memories on this day</h3>
            <p className="text-muted-foreground">
              Try expanding the date window to see more memories
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedByYear.map(({ year, items }) => (
              <div key={year} className="animate-fade-in">
                {/* Year header */}
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-2xl font-bold text-primary">{year}</h2>
                  <span className="text-muted-foreground">
                    {items.length} {items.length === 1 ? "memory" : "memories"}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                  <Button variant="ghost" size="sm" className="text-muted-foreground">
                    View all
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {items.map((memory) => (
                    <MemoryCard
                      key={memory.id}
                      memory={memory}
                      onClick={() => {
                        setSelectedId(memory.id);
                        setIsViewerOpen(true);
                      }}
                      isSelected={memory.id === selectedId}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* This week section */}
        {memories.length > 0 && (
          <div className="mt-12 pt-8 border-t border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Also this week</h2>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                See all
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            <p className="text-muted-foreground text-sm">
              More memories from around this time of year coming soon...
            </p>
          </div>
        )}
      </div>

      {/* Viewer */}
      <MemoryViewerDrawer
        memory={selectedMemory ?? null}
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        onPrev={
          selectedIndex > 0
            ? () => setSelectedId(memories[selectedIndex - 1].id)
            : undefined
        }
        onNext={
          selectedIndex < memories.length - 1
            ? () => setSelectedId(memories[selectedIndex + 1].id)
            : undefined
        }
        onFavoriteToggle={updateMemoryFavorite}
        onTagsUpdate={updateMemoryTags}
        timeDisplayMode={timeDisplayMode}
      />
    </div>
  );
}
