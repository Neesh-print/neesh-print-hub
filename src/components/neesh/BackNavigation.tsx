import { ChevronLeft } from "lucide-react";
import { ReactNode } from "react";

export interface BackNavigationProps {
  title: string;
  onBack: () => void;
  rightContent?: ReactNode;
}

export const BackNavigation = ({
  title,
  onBack,
  rightContent,
}: BackNavigationProps) => {
  return (
    <div className="flex items-center justify-between py-4 px-4 md:px-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1 group"
        aria-label="Go back"
      >
        <ChevronLeft className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        <span className="font-display font-semibold text-lg text-foreground">
          {title}
        </span>
      </button>

      {rightContent && (
        <div className="flex items-center">
          {rightContent}
        </div>
      )}
    </div>
  );
};
