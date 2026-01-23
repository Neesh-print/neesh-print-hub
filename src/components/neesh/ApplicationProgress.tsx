import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/neesh/Logo";

export interface ApplicationProgressProps {
  currentStep: number;
  totalSteps: number;
  labels?: string[];
  className?: string;
}

/**
 * A pencil-and-paper themed progress indicator for multi-step forms.
 * Displays as a series of handwritten-style checkboxes on lined paper.
 */
export const ApplicationProgress = ({
  currentStep,
  totalSteps,
  labels,
  className,
}: ApplicationProgressProps) => {
  const completedSteps = currentStep - 1;
  const progressPercentage = (completedSteps / totalSteps) * 100;

  // Mobile View: Lined Paper Horizontal Bar
  const MobileProgress = () => (
    <div className="lg:hidden w-full sticky top-0 z-30 mb-8 mx-auto -mt-2">
       {/* Paper Container */}
       <div className="bg-[#FFFEF7] border-y border-[#E5E3D8] shadow-sm relative overflow-hidden py-4 px-4">
         {/* Paper lines */}
         <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-0 right-0 h-[1px] bg-[#D4E5F6]/50 top-1/2" />
         </div>

         <div className="relative z-10 flex items-center justify-between gap-4">
             {/* Text with handwriting font */}
             <div className="flex flex-col">
               <span 
                className="text-lg font-medium text-foreground/80 leading-none"
                style={{ fontFamily: 'ui-serif, Georgia, serif' }}
               >
                 {labels ? labels[currentStep - 1] || `Step ${currentStep}` : `Step ${currentStep}`}
               </span>
               <span 
                className="text-xs text-muted-foreground mt-1"
                style={{ fontFamily: 'ui-monospace, monospace' }}
               >
                 {currentStep} / {totalSteps}
               </span>
             </div>

             {/* Progress Bar with Pencil Texture */}
             <div className="h-3 bg-secondary/20 rounded-full overflow-hidden w-32 border border-black/5 relative">
                <div 
                   className="h-full bg-accent relative transition-all duration-500 ease-out"
                   style={{ width: `${((currentStep) / totalSteps) * 100}%` }}
                >
                   {/* Pencil scribbles overlay */}
                   <div 
                     className="absolute inset-0 opacity-40 mix-blend-overlay"
                     style={{
                        backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)`
                     }}
                   />
                </div>
             </div>
         </div>
         
         {/* Texture */}
         <div
            className="absolute inset-0 pointer-events-none opacity-[0.05]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`,
            }}
          />
       </div>
    </div>
  );

  // Desktop View: Lined Paper Sidebar
  const DesktopProgress = () => (
    <div className={cn("relative hidden lg:block", className)}>
      {/* Paper background with lines */}
      <div className="bg-[#FFFEF7] border border-[#E5E3D8] rounded-lg p-6 shadow-sm relative overflow-hidden min-h-[400px]">
        {/* Horizontal lines to mimic lined paper */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 14 }).map((_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 h-[1px] bg-[#D4E5F6]/30"
              style={{ top: `${(i + 1) * 32}px` }}
            />
          ))}
          {/* Left margin line */}
          <div className="absolute left-10 top-0 bottom-0 w-[1px] bg-[#FFB6B6]/20" />
        </div>

        {/* Content */}
        <div className="relative z-10">
          {/* Title */}
          <div className="mb-6 ml-12">
            <h3 className="text-lg font-medium text-foreground/80" style={{ fontFamily: 'ui-serif, Georgia, serif' }}>
              Your Application
            </h3>
          </div>

          {/* Progress List */}
          <div className="space-y-6 ml-12">
            {Array.from({ length: totalSteps }).map((_, index) => {
              const stepNumber = index + 1;
              const isCompleted = stepNumber < currentStep;
              const isCurrent = stepNumber === currentStep;
              const label = labels ? labels[index] : `Step ${stepNumber}`;

              return (
                <div
                  key={index}
                  className={cn(
                    "flex items-start gap-3 transition-all duration-300 group",
                    isCurrent ? "translate-x-1" : "opacity-70 hover:opacity-100"
                  )}
                >
                  {/* Status Indicator (Checkbox feel) */}
                  <div
                    className={cn(
                      "mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-300 flex-shrink-0",
                      "transform -rotate-2", // Slight rotation for handwritten feel
                      isCompleted ? "bg-accent/10 border-accent" : 
                      isCurrent ? "border-accent border-dashed" : "border-border"
                    )}
                  >
                    {isCompleted && <Check className="w-3.5 h-3.5 text-accent" strokeWidth={3} />}
                  </div>

                  {/* Label */}
                  <div className="flex flex-col">
                    <span
                      className={cn(
                        "text-base font-medium leading-none transition-colors duration-300",
                        isCompleted ? "text-accent line-through decoration-accent/30" : 
                        isCurrent ? "text-foreground" : "text-muted-foreground"
                      )}
                      style={{ fontFamily: 'ui-serif, Georgia, serif' }}
                    >
                      {label}
                    </span>
                    {isCurrent && (
                      <span className="text-xs text-muted-foreground mt-1 font-sans animate-fade-in">
                        In Progress...
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom signature area decoration */}
           <div className="absolute bottom-6 right-6 opacity-10 rotate-12 grayscale">
              <Logo size="xl" className="w-48 h-auto" />
           </div>
        </div>

        {/* Paper texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`,
          }}
        />
      </div>
    </div>
  );

  return (
    <>
      <MobileProgress />
      <DesktopProgress />
    </>
  );
};
