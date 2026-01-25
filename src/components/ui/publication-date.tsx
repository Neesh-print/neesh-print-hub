import { cn } from "@/lib/utils";
import { formatPublicationDate, isCurrentMonth } from "@/lib/publication-date";
import { Badge } from "@/components/ui/badge";

export interface PublicationDateProps {
  /** ISO date string (e.g., "2025-12-01") */
  date: string | null | undefined;
  /** 'long' shows "December 2025", 'short' shows "Dec 2025" */
  format?: 'long' | 'short';
  /** When true, prefix with "Published: " */
  showLabel?: boolean;
  /** When true, show a "New" badge if publication is from current month */
  showNewBadge?: boolean;
  /** Controls text size */
  size?: 'sm' | 'md';
  /** Additional CSS classes */
  className?: string;
}

const sizeStyles = {
  sm: 'text-caption',
  md: 'text-sm',
};

/**
 * PublicationDate Component
 * 
 * Displays a publication date in a consistent format.
 * Optionally shows a "New" badge for current month publications.
 */
export function PublicationDate({
  date,
  format = 'long',
  showLabel = false,
  showNewBadge = false,
  size = 'md',
  className,
}: PublicationDateProps) {
  const formattedDate = formatPublicationDate(date, format);
  
  // Return null if date is invalid or null
  if (!formattedDate) return null;
  
  const isNew = showNewBadge && isCurrentMonth(date);
  
  return (
    <span 
      className={cn(
        "inline-flex items-center gap-1.5",
        sizeStyles[size],
        className
      )}
    >
      {showLabel && (
        <span className="text-muted-foreground">Published:</span>
      )}
      <span className="text-muted-foreground">{formattedDate}</span>
      {isNew && (
        <Badge 
          variant="secondary" 
          className="bg-status-success text-status-success-text text-[10px] px-1.5 py-0"
          aria-label="New release"
        >
          New
        </Badge>
      )}
    </span>
  );
}
