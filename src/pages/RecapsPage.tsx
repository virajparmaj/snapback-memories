import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  ImageIcon,
  Video,
  MapPin,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api/adapter";
import { MemoryCard } from "@/components/timeline/MemoryCard";
import { MemoryViewerDrawer } from "@/components/viewer/MemoryViewerDrawer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

export default function RecapsPage() {
  const [recapDays, setRecapDays] = useState(7);
  const { timeDisplayMode } = useAppStore();
  const queryClient = useQueryClient();

  const { data: recap, isLoading } = useQuery({
    queryKey: ["recap", recapDays],
    queryFn: () => api.getRecentRecap(recapDays),
  });

  // Viewer state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const memories = recap?.highlights ?? [];
  const selectedMemory = memories.find((m) => m.id === selectedId);
  const selectedIndex = memories.findIndex((m) => m.id === selectedId);

  // Calculate stats
  const locationCounts = memories.reduce(
    (acc, m) => {
      if (m.location?.label) {
        acc[m.location.label] = (acc[m.location.label] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>
  );

  const topLocations = Object.entries(locationCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const dayOptions = [
    { value: 7, label: "Last 7 days" },
    { value: 30, label: "Last 30 days" },
    { value: 90, label: "Last 3 months" },
  ];

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      {/* Hero section */}
      <div className="relative py-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
        <div className="container max-w-screen-2xl px-4 relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Recaps</h1>
              <p className="text-muted-foreground">Your memory highlights and stats</p>
            </div>
          </div>

          {/* Period toggle */}
          <div className="flex flex-wrap items-center gap-3 mt-6">
            {dayOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setRecapDays(option.value)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all",
                  recapDays === option.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-screen-2xl px-4 pb-12">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>Loading recap...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {/* Photos */}
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                      <ImageIcon className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{recap?.stats.photos ?? 0}</p>
                      <p className="text-sm text-muted-foreground">Photos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Videos */}
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                      <Video className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{recap?.stats.videos ?? 0}</p>
                      <p className="text-sm text-muted-foreground">Videos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Total */}
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {(recap?.stats.photos ?? 0) + (recap?.stats.videos ?? 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">Total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Locations */}
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{Object.keys(locationCounts).length}</p>
                      <p className="text-sm text-muted-foreground">Locations</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Top locations */}
            {topLocations.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-3">Top Locations</h2>
                <div className="flex flex-wrap gap-2">
                  {topLocations.map(([location, count]) => (
                    <div
                      key={location}
                      className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg"
                    >
                      <MapPin className="h-4 w-4 text-primary" />
                      <span className="text-sm">{location}</span>
                      <span className="text-xs text-muted-foreground">({count})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Highlights */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Highlights</h2>
              </div>

              {memories.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-2xl">
                  <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No highlights for this period</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {memories.slice(0, 18).map((memory) => (
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
              )}

              {memories.length > 18 && (
                <div className="flex justify-center mt-6">
                  <Button variant="secondary">
                    View all {memories.length} highlights
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </>
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
        onFavoriteToggle={(id, fav) => {
          api.setFavorite(id, fav);
          queryClient.invalidateQueries({ queryKey: ["recap"] });
        }}
        onTagsUpdate={(id, tags) => {
          api.setTags(id, tags);
          queryClient.invalidateQueries({ queryKey: ["recap"] });
        }}
        timeDisplayMode={timeDisplayMode}
      />
    </div>
  );
}
