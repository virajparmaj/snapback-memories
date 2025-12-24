import { cn } from "@/lib/utils";
import { Play, Heart } from "lucide-react";
import { MemoryItem } from "@/types/memory";
import { memo, useState } from "react";

interface MemoryCardProps {
  memory: MemoryItem;
  onClick: () => void;
  isSelected?: boolean;
}

export const MemoryCard = memo(function MemoryCard({
  memory,
  onClick,
  isSelected,
}: MemoryCardProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <button
      onClick={onClick}
      style={{ aspectRatio: "9 / 16" }}
      className={cn(
        "relative w-full rounded-xl overflow-hidden group",
        "bg-card transition-all duration-200",
        "hover:ring-2 hover:ring-primary/50 hover:scale-[1.02]",
        "focus:outline-none focus:ring-2 focus:ring-primary",
        isSelected && "ring-2 ring-primary"
      )}
    >
      {/* Thumbnail */}
      {!hasError && memory.thumbnail_url && (
        <img
          src={memory.thumbnail_url}
          alt={memory.filename_original}
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0"
          )}
        />
      )}

      {/* Loading skeleton */}
      {(!isLoaded || hasError) && (
        <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/50 animate-pulse" />
      )}

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Video indicator */}
      {memory.type === "video" && (
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/50 px-1.5 py-0.5 rounded-md">
          <Play className="h-3 w-3 text-foreground fill-foreground" />
          {memory.duration_sec && (
            <span className="text-2xs text-foreground font-medium">
              {Math.floor(memory.duration_sec / 60)}:
              {String(memory.duration_sec % 60).padStart(2, "0")}
            </span>
          )}
        </div>
      )}

      {/* Favorite indicator */}
      {memory.favorite && (
        <div className="absolute top-2 right-2">
          <Heart className="h-4 w-4 text-primary fill-primary" />
        </div>
      )}

      {/* Date on hover */}
      <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-xs text-foreground/90 font-medium truncate">
          {new Date(memory.captured_at_utc).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>
    </button>
  );
});
