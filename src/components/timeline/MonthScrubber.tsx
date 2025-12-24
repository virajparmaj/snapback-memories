import { cn } from "@/lib/utils";
import { MonthSummary } from "@/types/memory";
import { formatMonthYear } from "@/lib/mock-data";

interface MonthScrubberProps {
  months: MonthSummary[];
  activeMonth: { year: number; month: number } | null;
  onMonthClick: (year: number, month: number) => void;
}

export function MonthScrubber({
  months,
  activeMonth,
  onMonthClick,
}: MonthScrubberProps) {
  // Group months by year
  const groupedByYear = months.reduce(
    (acc, month) => {
      if (!acc[month.year]) acc[month.year] = [];
      acc[month.year].push(month);
      return acc;
    },
    {} as Record<number, MonthSummary[]>
  );

  const years = Object.keys(groupedByYear)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col items-end gap-1">
      {years.map((year) => (
        <div key={year} className="flex flex-col items-end">
          {/* Year label */}
          <span className="text-xs text-muted-foreground font-medium mb-0.5 pr-1">
            {year}
          </span>

          {/* Month dots */}
          <div className="flex flex-col gap-0.5 items-end">
            {groupedByYear[year]
              .sort((a, b) => b.month - a.month)
              .map((monthData) => {
                const isActive =
                  activeMonth?.year === monthData.year &&
                  activeMonth?.month === monthData.month;

                return (
                  <button
                    key={`${monthData.year}-${monthData.month}`}
                    onClick={() => onMonthClick(monthData.year, monthData.month)}
                    className={cn(
                      "group flex items-center gap-2 py-0.5 transition-all duration-200",
                      "hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded"
                    )}
                    title={`${formatMonthYear(monthData.year, monthData.month)} (${monthData.count})`}
                  >
                    {/* Month label on hover */}
                    <span
                      className={cn(
                        "text-xs opacity-0 group-hover:opacity-100 transition-opacity",
                        isActive ? "text-primary font-medium" : "text-muted-foreground"
                      )}
                    >
                      {new Date(monthData.year, monthData.month - 1).toLocaleDateString(
                        "en-US",
                        { month: "short" }
                      )}
                    </span>

                    {/* Dot indicator */}
                    <div
                      className={cn(
                        "rounded-full transition-all duration-200",
                        isActive
                          ? "w-3 h-3 bg-primary glow-primary-sm"
                          : "w-2 h-2 bg-muted-foreground/50 group-hover:bg-primary/70"
                      )}
                    />
                  </button>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
