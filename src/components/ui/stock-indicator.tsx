import { cn } from "@/lib/utils";
import { getStockLevel, getStockMessage, type StockLevel } from "@/lib/inventory";

export interface StockIndicatorProps {
  /** Available stock quantity */
  quantity: number | null | undefined;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional CSS classes */
  className?: string;
}

const levelStyles: Record<StockLevel, { container: string; dot: string }> = {
  out: {
    container: 'bg-muted text-muted-foreground',
    dot: 'bg-muted-foreground',
  },
  critical: {
    container: 'bg-status-error/10 text-status-error-text',
    dot: 'bg-status-error',
  },
  low: {
    container: 'bg-status-warning/10 text-status-warning-text',
    dot: 'bg-status-warning',
  },
  normal: {
    container: '',
    dot: '',
  },
};

const sizeStyles = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
};

/**
 * Stock scarcity indicator badge
 * Only renders for low, critical, or out-of-stock items
 */
export function StockIndicator({
  quantity,
  size = 'md',
  className,
}: StockIndicatorProps) {
  const level = getStockLevel(quantity);
  const message = getStockMessage(quantity);
  
  // Don't render anything for normal stock levels
  if (level === 'normal' || !message) return null;
  
  const styles = levelStyles[level];
  
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        styles.container,
        sizeStyles[size],
        className
      )}
      role="status"
      aria-label={message}
    >
      <span 
        className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', styles.dot)} 
        aria-hidden="true" 
      />
      <span>{message}</span>
    </div>
  );
}
