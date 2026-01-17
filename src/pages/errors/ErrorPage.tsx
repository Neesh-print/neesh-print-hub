import { useNavigate } from "react-router-dom";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { ButtonPrimary, ButtonSecondary, Logo } from "@/components/neesh";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ErrorPageProps {
  error?: Error;
  resetErrorBoundary?: () => void;
}

export default function ErrorPage({ error, resetErrorBoundary }: ErrorPageProps) {
  const navigate = useNavigate();
  const isDev = import.meta.env.DEV;
  const [detailsOpen, setDetailsOpen] = useState(false);

  const handleTryAgain = () => {
    if (resetErrorBoundary) {
      resetErrorBoundary();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="mb-12">
        <Logo size="lg" />
      </div>

      {/* Icon */}
      <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-8">
        <AlertTriangle className="w-10 h-10 text-amber-600" />
      </div>

      {/* Heading */}
      <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-3 text-center">
        Something went wrong
      </h1>

      {/* Description */}
      <p className="text-muted-foreground text-center max-w-md mb-8">
        We're sorry, but something unexpected happened. Please try again.
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <ButtonPrimary onClick={handleTryAgain}>
          Try Again
        </ButtonPrimary>
        <ButtonSecondary onClick={() => navigate('/')}>
          Go Home
        </ButtonSecondary>
      </div>

      {/* Contact Support */}
      <a
        href="mailto:hi@neesh.art"
        className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors"
      >
        Contact Support
      </a>

      {/* Technical Details (dev only) */}
      {isDev && error && (
        <Collapsible
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          className="w-full max-w-lg mt-8"
        >
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto">
            <span>Technical Details</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${detailsOpen ? 'rotate-180' : ''}`}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <div className="bg-secondary/50 rounded-lg p-4 text-left overflow-auto max-h-64">
              <p className="text-sm font-mono text-destructive mb-2">
                {error.message}
              </p>
              {error.stack && (
                <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all">
                  {error.stack}
                </pre>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
