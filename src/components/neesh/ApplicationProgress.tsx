import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ApplicationProgressProps {
  currentStep: number;
  totalSteps: number;
  className?: string;
}

/**
 * A pencil-and-paper themed progress indicator for multi-step forms.
 * Displays as a series of handwritten-style checkboxes on lined paper.
 */
export const ApplicationProgress = ({
  currentStep,
  totalSteps,
  className,
}: ApplicationProgressProps) => {
  const completedSteps = currentStep - 1;
  const progressPercentage = (completedSteps / totalSteps) * 100;

  return (
    <div className={cn("relative", className)}>
      {/* Paper background with lines */}
      <div className="bg-[#FFFEF7] border border-[#E5E3D8] rounded-lg p-6 shadow-sm relative overflow-hidden">
        {/* Horizontal lines to mimic lined paper */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 h-[1px] bg-[#D4E5F6]/30"
              style={{ top: `${(i + 1) * 8.333}%` }}
            />
          ))}
          {/* Left margin line */}
          <div className="absolute left-12 top-0 bottom-0 w-[1px] bg-[#FFB6B6]/20" />
        </div>

        {/* Content */}
        <div className="relative z-10">
          {/* Title with handwritten feel */}
          <div className="mb-4 ml-14">
            <h3 className="text-lg font-medium text-foreground/80" style={{ fontFamily: 'ui-serif, Georgia, serif' }}>
              Application Progress
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {completedSteps} of {totalSteps} steps completed
            </p>
          </div>

          {/* Progress checkboxes */}
          <div className="space-y-3 ml-14">
            {Array.from({ length: totalSteps }).map((_, index) => {
              const stepNumber = index + 1;
              const isCompleted = stepNumber < currentStep;
              const isCurrent = stepNumber === currentStep;

              return (
                <div
                  key={index}
                  className={cn(
                    "flex items-center gap-3 transition-all duration-300",
                    isCurrent && "scale-105"
                  )}
                >
                  {/* Checkbox */}
                  <div
                    className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-300",
                      "transform rotate-1", // Slight rotation for handwritten feel
                      isCompleted
                        ? "bg-accent/10 border-accent shadow-sm"
                        : isCurrent
                        ? "border-accent/60 border-dashed scale-110"
                        : "border-border"
                    )}
                  >
                    {isCompleted && (
                      <Check className="w-3.5 h-3.5 text-accent" strokeWidth={3} />
                    )}
                  </div>

                  {/* Step indicator line */}
                  <div
                    className={cn(
                      "h-[2px] flex-1 transition-all duration-300 rounded-full",
                      "relative",
                      isCompleted
                        ? "bg-accent/30"
                        : isCurrent
                        ? "bg-accent/20"
                        : "bg-border/30"
                    )}
                  >
                    {/* Pencil mark effect */}
                    {isCompleted && (
                      <div
                        className="absolute inset-0 bg-gradient-to-r from-accent/40 to-transparent rounded-full"
                        style={{ width: `${Math.random() * 20 + 80}%` }}
                      />
                    )}
                  </div>

                  {/* Step number */}
                  <span
                    className={cn(
                      "text-xs font-medium w-6 text-right",
                      "transition-colors duration-300",
                      isCompleted
                        ? "text-accent"
                        : isCurrent
                        ? "text-accent/80 font-semibold"
                        : "text-muted-foreground/50"
                    )}
                    style={{ fontFamily: 'ui-monospace, monospace' }}
                  >
                    {stepNumber}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Progress bar at bottom */}
          <div className="mt-6 ml-14">
            <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden relative">
              {/* Pencil-drawn progress bar */}
              <div
                className="h-full bg-gradient-to-r from-accent/70 via-accent to-accent/70 rounded-full transition-all duration-500 ease-out relative"
                style={{ width: `${progressPercentage}%` }}
              >
                {/* Pencil texture overlay */}
                <div className="absolute inset-0 opacity-30 mix-blend-soft-light">
                  <div className="h-full w-full bg-[linear-gradient(90deg,transparent_49%,rgba(255,255,255,0.1)_50%,transparent_51%)]" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Paper texture overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Pencil icon decoration */}
      <div className="absolute -right-2 -top-2 text-muted-foreground/20 transform rotate-45">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          <path d="m15 5 4 4" />
        </svg>
      </div>
    </div>
  );
};
