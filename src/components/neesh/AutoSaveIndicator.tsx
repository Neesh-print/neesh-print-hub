import { Check, Loader2, Cloud, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export interface AutoSaveIndicatorProps {
  status: 'idle' | 'saving' | 'saved' | 'error';
  className?: string;
  lastSaved?: Date | null;
}

/**
 * A subtle indicator that shows the auto-save status of a form.
 * Displays different states: idle, saving, saved, or error.
 */
export const AutoSaveIndicator = ({
  status,
  className,
  lastSaved,
}: AutoSaveIndicatorProps) => {
  const [show, setShow] = useState(false);

  // Show indicator when status changes, hide after a delay for 'saved' state
  useEffect(() => {
    if (status !== 'idle') {
      setShow(true);
    }

    if (status === 'saved') {
      const timer = setTimeout(() => setShow(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  if (!show && status === 'idle') return null;

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm transition-all duration-300",
        "px-3 py-1.5 rounded-full",
        status === 'saving' && "bg-accent/10 text-accent",
        status === 'saved' && "bg-status-success/10 text-status-success-text",
        status === 'error' && "bg-status-error/10 text-status-error-text",
        className
      )}
    >
      {/* Icon */}
      {status === 'saving' && (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      )}
      {status === 'saved' && (
        <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
      )}
      {status === 'error' && (
        <AlertCircle className="w-3.5 h-3.5" />
      )}
      {status === 'idle' && lastSaved && (
        <Cloud className="w-3.5 h-3.5 text-muted-foreground" />
      )}

      {/* Text */}
      <span className="text-caption font-medium">
        {status === 'saving' && 'Saving...'}
        {status === 'saved' && 'Saved'}
        {status === 'error' && 'Save failed'}
        {status === 'idle' && lastSaved && `Saved ${getTimeAgo(lastSaved)}`}
      </span>
    </div>
  );
};
