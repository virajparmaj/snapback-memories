import { cn } from "@/lib/utils";
import { MediaFilter } from "@/types/memory";
import { ImageIcon, Video, Heart, LayoutGrid } from "lucide-react";

interface FilterChipsProps {
  activeFilter: MediaFilter;
  onFilterChange: (filter: MediaFilter) => void;
}

const filters: { value: MediaFilter; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "All", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
  { value: "photos", label: "Photos", icon: <ImageIcon className="h-3.5 w-3.5" /> },
  { value: "videos", label: "Videos", icon: <Video className="h-3.5 w-3.5" /> },
  { value: "favorites", label: "Favorites", icon: <Heart className="h-3.5 w-3.5" /> },
];

export function FilterChips({ activeFilter, onFilterChange }: FilterChipsProps) {
  return (
    <div className="flex items-center gap-2">
      {filters.map((filter) => (
        <button
          key={filter.value}
          onClick={() => onFilterChange(filter.value)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium",
            "transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-primary/50",
            activeFilter === filter.value
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          )}
        >
          {filter.icon}
          <span>{filter.label}</span>
        </button>
      ))}
    </div>
  );
}
