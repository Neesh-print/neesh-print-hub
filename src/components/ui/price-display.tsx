import { useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * PriceDisplay Component
 * 
 * Displays wholesale and retail prices with optional margin and total calculations.
 * 
 * IMPORTANT: All prices are expected in DOLLARS (number with decimals), 
 * not cents. The component handles formatting to 2 decimal places.
 */

export interface PriceDisplayProps {
  /** Wholesale price in dollars */
  wholesalePrice: number | null | undefined;
  /** Suggested retail price in dollars */
  retailPrice: number | null | undefined;
  /** Quantity for total calculation (defaults to 1) */
  quantity?: number;
  /** Show total (wholesalePrice × quantity) */
  showTotal?: boolean;
  /** Show margin (retailPrice - wholesalePrice) with percentage */
  showMargin?: boolean;
  /** Layout style: 'inline' for horizontal, 'stacked' for vertical */
  layout?: 'inline' | 'stacked';
  /** Size variant for text sizing */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const sizeStyles = {
  sm: {
    wsp: 'text-sm font-semibold',
    msrp: 'text-xs',
    margin: 'text-xs',
    total: 'text-sm font-semibold',
    label: 'text-xs',
  },
  md: {
    wsp: 'text-base font-semibold',
    msrp: 'text-sm',
    margin: 'text-sm',
    total: 'text-base font-semibold',
    label: 'text-xs',
  },
  lg: {
    wsp: 'text-2xl font-bold font-display',
    msrp: 'text-base',
    margin: 'text-base',
    total: 'text-xl font-bold font-display',
    label: 'text-sm',
  },
};

export const PriceDisplay = ({
  wholesalePrice,
  retailPrice,
  quantity = 1,
  showTotal = false,
  showMargin = false,
  layout = 'inline',
  size = 'md',
  className,
}: PriceDisplayProps) => {
  // Normalize quantity to at least 1
  const normalizedQuantity = useMemo(() => {
    if (!quantity || quantity <= 0 || isNaN(quantity)) return 1;
    return Math.floor(quantity);
  }, [quantity]);

  // Check if prices are valid
  const hasWholesale = wholesalePrice !== null && wholesalePrice !== undefined && !isNaN(wholesalePrice);
  const hasRetail = retailPrice !== null && retailPrice !== undefined && !isNaN(retailPrice);

  // Calculate margin: MSRP - (WSP × 1.20) to account for 20% markup
  const margin = useMemo(() => {
    if (!hasWholesale || !hasRetail) return null;
    const wspWithMarkup = wholesalePrice! * 1.20;
    const dollarAmount = retailPrice! - wspWithMarkup;
    const percentage = retailPrice! > 0 ? (dollarAmount / retailPrice!) * 100 : 0;
    return {
      dollarAmount,
      percentage: Math.round(percentage),
    };
  }, [wholesalePrice, retailPrice, hasWholesale, hasRetail]);

  // Calculate total
  const total = useMemo(() => {
    if (!hasWholesale) return null;
    return wholesalePrice! * normalizedQuantity;
  }, [wholesalePrice, normalizedQuantity, hasWholesale]);

  const styles = sizeStyles[size];

  // Build aria-label for accessibility
  const ariaLabel = useMemo(() => {
    const parts: string[] = [];
    if (hasWholesale) {
      parts.push(`Wholesale price: ${formatCurrency(wholesalePrice!)}`);
    }
    if (hasRetail) {
      parts.push(`Suggested retail price: ${formatCurrency(retailPrice!)}`);
    }
    if (showMargin && margin) {
      parts.push(`Margin: ${formatCurrency(margin.dollarAmount)} (${margin.percentage}%)`);
    }
    if (showTotal && total !== null) {
      parts.push(`Total: ${formatCurrency(total)}`);
    }
    return parts.join(', ') || 'Pricing information unavailable';
  }, [hasWholesale, hasRetail, wholesalePrice, retailPrice, showMargin, margin, showTotal, total]);

  // Handle no prices available
  if (!hasWholesale && !hasRetail) {
    return (
      <div className={cn("text-muted-foreground", styles.wsp, className)} aria-label="Contact for pricing">
        Contact for pricing
      </div>
    );
  }

  // Handle only wholesale missing
  if (!hasWholesale) {
    return (
      <div className={cn("text-muted-foreground", styles.wsp, className)} aria-label="Price unavailable">
        Price unavailable
      </div>
    );
  }

  const isInline = layout === 'inline';

  return (
    <div
      className={cn(
        isInline ? 'flex items-baseline gap-2 flex-wrap' : 'flex flex-col gap-1',
        className
      )}
      aria-label={ariaLabel}
      role="group"
    >
      {/* Wholesale Price */}
      <p className={cn(styles.wsp, 'text-accent')}>
        {formatCurrency(wholesalePrice!)}
        <span className={cn(styles.label, 'text-muted-foreground font-normal ml-1')}>WSP</span>
      </p>

      {/* MSRP */}
      {hasRetail && (
        <p className={cn(styles.msrp, 'text-muted-foreground')}>
          {isInline && <span className="mr-1">/</span>}
          {formatCurrency(retailPrice!)}
          <span className={cn(styles.label, 'ml-1')}>MSRP</span>
        </p>
      )}

      {/* Margin */}
      {showMargin && margin && (
        <p className={cn(styles.margin, 'text-status-success-text')}>
          {formatCurrency(margin.dollarAmount)}
          <span className={cn(styles.label, 'font-normal ml-1')}>MY MARGIN</span>
        </p>
      )}

      {/* Total */}
      {showTotal && (
        <p className={cn(styles.total, 'text-foreground')}>
          Total: {total !== null ? formatCurrency(total) : '--'}
        </p>
      )}
    </div>
  );
};
