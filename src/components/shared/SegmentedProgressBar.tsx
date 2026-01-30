import React from "react";
import { cn } from "@/lib/utils";

interface SegmentedProgressBarProps {
  total: number;
  current: number; // 1-based step index (or count of completed items). Items < current are 100%, items >= current are 30%.
  onItemClick?: (index: number) => void;
  className?: string;
}

export const SegmentedProgressBar = ({
  total,
  current,
  onItemClick,
  className,
}: SegmentedProgressBarProps) => {
  return (
    <div
      className={cn(
        "relative w-full h-8 bg-white border border-black rounded-full overflow-hidden",
        className
      )}
    >
      <div className="flex h-full w-[120%] -ml-[10%]">
        {Array.from({ length: total }).map((_, index) => {
          // If current represents "current active step" (1-based), then index < current means "active or completed".
          // Example: Step 1 (current=1). Index 0 (<1) is Active. Index 1 (>=1) is Future.
          const isActiveOrCompleted = index < current;
          
          return (
            <div
              key={index}
              onClick={() => onItemClick?.(index)}
              className={cn(
                "flex-1 h-full border-r border-black last:border-r-0 transition-all duration-300 -skew-x-[20deg]",
                // "purple a higher opacity when finished like 100, and 30% when it still needs to be done."
                isActiveOrCompleted ? "bg-accent" : "bg-accent/30",
                onItemClick ? "cursor-pointer hover:opacity-90" : ""
              )}
            />
          );
        })}
      </div>
    </div>
  );
};
