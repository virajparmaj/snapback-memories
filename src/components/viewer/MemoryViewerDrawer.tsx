import { useState, useCallback } from "react";
import { X, Heart, MapPin, Calendar, Clock, Tag, Copy, ExternalLink, ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
import { MemoryItem, TimeDisplayMode } from "@/types/memory";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/adapter";
import { useToast } from "@/hooks/use-toast";

interface MemoryViewerDrawerProps {
  memory: MemoryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onFavoriteToggle?: (id: string, favorite: boolean) => void;
  onTagsUpdate?: (id: string, tags: string[]) => void;
  timeDisplayMode: TimeDisplayMode;
}

export function MemoryViewerDrawer({
  memory,
  isOpen,
  onClose,
  onPrev,
  onNext,
  onFavoriteToggle,
  onTagsUpdate,
  timeDisplayMode,
}: MemoryViewerDrawerProps) {
  const { toast } = useToast();
  const [isPlaying, setIsPlaying] = useState(false);
  const [newTag, setNewTag] = useState("");

  const handleAddTag = useCallback(() => {
    if (!memory || !newTag.trim()) return;
    const updatedTags = [...(memory.tags || []), newTag.trim()];
    onTagsUpdate?.(memory.id, updatedTags);
    api.setTags(memory.id, updatedTags);
    setNewTag("");
    toast({ title: "Tag added", description: newTag.trim() });
  }, [memory, newTag, onTagsUpdate, toast]);

  const handleRemoveTag = useCallback(
    (tagToRemove: string) => {
      if (!memory) return;
      const updatedTags = (memory.tags || []).filter((t) => t !== tagToRemove);
      onTagsUpdate?.(memory.id, updatedTags);
      api.setTags(memory.id, updatedTags);
    },
    [memory, onTagsUpdate]
  );

  const handleFavoriteToggle = useCallback(() => {
    if (!memory) return;
    const newFavorite = !memory.favorite;
    onFavoriteToggle?.(memory.id, newFavorite);
    api.setFavorite(memory.id, newFavorite);
    toast({
      title: newFavorite ? "Added to favorites" : "Removed from favorites",
    });
  }, [memory, onFavoriteToggle, toast]);

  const copyToClipboard = useCallback(
    (text: string, label: string) => {
      navigator.clipboard.writeText(text);
      toast({ title: "Copied!", description: label });
    },
    [toast]
  );

  const formatDate = useCallback(
    (dateStr: string) => {
      const date = new Date(dateStr);
      if (timeDisplayMode === "utc") {
        return date.toUTCString();
      }
      return date.toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    },
    [timeDisplayMode]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev?.();
      if (e.key === "ArrowRight") onNext?.();
    },
    [onClose, onPrev, onNext]
  );

  if (!isOpen || !memory) return null;

  const mediaUrl = api.getMediaUrl(memory.id);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl bg-card border-l border-border animate-slide-in-right flex flex-col"
        onKeyDown={handleKeyDown}
        tabIndex={0}
        style={{ animation: "slideInRight 0.3s ease-out" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrev}
              className="hover:bg-secondary"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNext}
              className="hover:bg-secondary"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="hover:bg-secondary"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Media viewer */}
        <div className="flex-1 bg-background flex items-center justify-center p-4 overflow-hidden">
          {memory.type === "video" ? (
            <div className="relative w-full max-w-lg aspect-square">
              <img
                src={memory.thumbnail_url}
                alt={memory.filename_original}
                className="w-full h-full object-contain rounded-xl"
              />
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors rounded-xl"
              >
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center glow-primary">
                  {isPlaying ? (
                    <Pause className="h-8 w-8 text-primary-foreground" />
                  ) : (
                    <Play className="h-8 w-8 text-primary-foreground ml-1" />
                  )}
                </div>
              </button>
            </div>
          ) : (
            <img
              src={mediaUrl}
              alt={memory.filename_original}
              className="max-w-full max-h-full object-contain rounded-xl"
            />
          )}
        </div>

        {/* Metadata panel */}
        <div className="p-4 border-t border-border space-y-4 overflow-y-auto max-h-[40vh]">
          {/* Date & Time */}
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">{formatDate(memory.captured_at_utc)}</p>
              <p className="text-xs text-muted-foreground">
                {timeDisplayMode === "utc" ? "UTC" : "Local time"}
              </p>
            </div>
          </div>

          {/* Location */}
          {memory.location?.label && (
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <p className="text-sm">{memory.location.label}</p>
            </div>
          )}

          {/* Duration for videos */}
          {memory.type === "video" && memory.duration_sec && (
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
              <p className="text-sm">
                {Math.floor(memory.duration_sec / 60)}:
                {String(memory.duration_sec % 60).padStart(2, "0")}
              </p>
            </div>
          )}

          {/* Tags */}
          <div className="flex items-start gap-3">
            <Tag className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {memory.tags?.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    onClick={() => handleRemoveTag(tag)}
                  >
                    {tag} ×
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                  className="h-8 text-sm bg-secondary border-border"
                />
                <Button size="sm" onClick={handleAddTag} className="h-8">
                  Add
                </Button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              variant={memory.favorite ? "default" : "secondary"}
              size="sm"
              onClick={handleFavoriteToggle}
              className={cn(
                memory.favorite && "bg-primary text-primary-foreground"
              )}
            >
              <Heart
                className={cn(
                  "h-4 w-4 mr-1.5",
                  memory.favorite && "fill-current"
                )}
              />
              {memory.favorite ? "Favorited" : "Favorite"}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => copyToClipboard(memory.filename_original, "Filename copied")}
            >
              <Copy className="h-4 w-4 mr-1.5" />
              Copy Name
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => copyToClipboard(memory.filepath, "Path copied")}
            >
              <Copy className="h-4 w-4 mr-1.5" />
              Copy Path
            </Button>

            <Button variant="secondary" size="sm">
              <ExternalLink className="h-4 w-4 mr-1.5" />
              Open in Finder
            </Button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}
