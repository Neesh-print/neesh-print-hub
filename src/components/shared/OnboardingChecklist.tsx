import { useNavigate } from "react-router-dom";
import { CheckCircle, Circle, X, PartyPopper, LucideIcon } from "lucide-react";
import { ButtonSecondary } from "@/components/neesh";
import { useState, useEffect } from "react";

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  action: {
    label: string;
    href: string;
  };
  icon: LucideIcon;
}

interface OnboardingChecklistProps {
  items: ChecklistItem[];
  userName?: string;
  welcomeTitle?: string;
  welcomeSubtitle?: string;
  onDismiss?: () => void;
  onItemClick?: (itemId: string) => void;
}

export const OnboardingChecklist = ({
  items,
  userName,
  welcomeTitle = "Welcome to Neesh!",
  welcomeSubtitle = "Complete these steps to get started.",
  onDismiss,
  onItemClick,
}: OnboardingChecklistProps) => {
  const navigate = useNavigate();
  const [showCelebration, setShowCelebration] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const completedCount = items.filter((i) => i.completed).length;
  const totalCount = items.length;
  const allComplete = completedCount === totalCount;
  const progressPercent = (completedCount / totalCount) * 100;

  // Animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Show celebration when all complete
  useEffect(() => {
    if (allComplete) {
      setShowCelebration(true);
      const timer = setTimeout(() => {
        onDismiss?.();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [allComplete, onDismiss]);

  const handleItemClick = (item: ChecklistItem) => {
    onItemClick?.(item.id);
    navigate(item.action.href);
  };

  if (showCelebration) {
    return (
      <div
        className={`bg-green-50 border border-green-200 rounded-xl p-6 mb-6 text-center transition-all duration-500 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
        }`}
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
          <PartyPopper className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="font-display font-bold text-xl text-green-900 mb-2">
          You're all set!
        </h3>
        <p className="text-green-700 mb-4">
          Your storefront is live. Retailers can now discover and order your titles.
        </p>
        <button
          onClick={onDismiss}
          className="text-sm text-green-600 hover:text-green-800 underline"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div
      className={`bg-cream border border-border rounded-xl overflow-hidden mb-6 transition-all duration-500 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
      }`}
    >
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display font-bold text-xl text-foreground">
              {userName ? `Welcome to Neesh, ${userName}!` : welcomeTitle}
            </h2>
            <p className="text-muted-foreground mt-1">{welcomeSubtitle}</p>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">
              {completedCount} of {totalCount} complete
            </span>
            <span className="font-medium">{Math.round(progressPercent)}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Checklist Items */}
      <div className="px-6 pb-6 space-y-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className={`flex items-start gap-4 p-4 rounded-lg transition-all ${
                item.completed
                  ? "bg-green-50/50 border border-green-100"
                  : "bg-background border border-border hover:border-primary/30"
              }`}
            >
              {/* Checkbox */}
              <div className="flex-shrink-0 mt-0.5">
                {item.completed ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Icon
                    className={`w-4 h-4 ${
                      item.completed ? "text-green-600" : "text-muted-foreground"
                    }`}
                  />
                  <h4
                    className={`font-medium ${
                      item.completed
                        ? "text-green-900 line-through"
                        : "text-foreground"
                    }`}
                  >
                    {item.title}
                  </h4>
                </div>
                {!item.completed && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {item.description}
                  </p>
                )}
              </div>

              {/* Action Button */}
              {!item.completed && (
                <div className="flex-shrink-0">
                  <ButtonSecondary
                    onClick={() => handleItemClick(item)}
                    className="text-sm py-1.5 px-3"
                  >
                    {item.action.label}
                  </ButtonSecondary>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OnboardingChecklist;
