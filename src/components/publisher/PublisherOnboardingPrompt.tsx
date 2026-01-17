import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";

export const PublisherOnboardingPrompt = () => {
  const navigate = useNavigate();
  const [isDismissed, setIsDismissed] = useState(false);

  // Check if onboarding was skipped but not completed
  const wasSkipped = localStorage.getItem("neesh_publisher_onboarding_skipped") === "true";
  const isComplete = localStorage.getItem("neesh_publisher_onboarding_complete") === "true";

  if (isDismissed || isComplete || !wasSkipped) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  const handleContinue = () => {
    navigate("/publisher/onboarding");
  };

  return (
    <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="font-display font-medium text-foreground text-sm">
            Finish setting up your profile
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Complete your storefront to help retailers discover you
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleContinue}
            className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            Continue
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          
          <button
            onClick={handleDismiss}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
