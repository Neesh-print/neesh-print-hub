import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { QuantityInput } from "@/components/ui/quantity-input";
import { 
  formatPrice, 
  calculateMarginPerUnit, 
  calculateMarginPercentage,
  calculateLineTotal,
  isLowStock,
  isOutOfStock 
} from "@/lib/pricing";

export interface DynamicPricingProps {
  /** Wholesale price per unit in dollars */
  wholesalePrice: number;
  /** Suggested retail price per unit in dollars (optional) */
  retailPrice: number | null;
  /** Current quantity */
  quantity: number;
  /** Callback when quantity changes */
  onQuantityChange: (quantity: number) => void;
  /** Maximum available stock */
  maxQuantity: number;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Callback when max is exceeded (for toast notifications) */
  onMaxExceeded?: (max: number) => void;
}

export const DynamicPricing = ({
  wholesalePrice,
  retailPrice,
  quantity,
  onQuantityChange,
  maxQuantity,
  disabled = false,
  className,
  onMaxExceeded,
}: DynamicPricingProps) => {
  const outOfStock = isOutOfStock(maxQuantity);
  const lowStock = isLowStock(maxQuantity);
  const isDisabled = disabled || outOfStock;

  // Calculate margin (per unit, doesn't change with quantity)
  const margin = useMemo(() => {
    if (!retailPrice || retailPrice <= 0 || !wholesalePrice) return null;
    return {
      amount: calculateMarginPerUnit(wholesalePrice, retailPrice),
      percentage: Math.round(calculateMarginPercentage(wholesalePrice, retailPrice)),
    };
  }, [wholesalePrice, retailPrice]);

  // Calculate total (changes with quantity)
  const total = useMemo(() => {
    return calculateLineTotal(wholesalePrice, quantity);
  }, [wholesalePrice, quantity]);

  // Handle invalid wholesale price
  if (!wholesalePrice || wholesalePrice <= 0) {
    return (
      <div className={cn("space-y-4", className)}>
        <p className="text-muted-foreground">Price unavailable</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Pricing Info */}
      <div className="space-y-2">
        <p className="text-caption text-muted-foreground uppercase tracking-wide">Pricing</p>
        
        {/* WSP */}
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-display text-accent">
            {formatPrice(wholesalePrice)}
          </span>
          <span className="text-sm text-muted-foreground">WSP</span>
        </div>

        {/* MSRP */}
        {retailPrice && retailPrice > 0 && (
          <div className="flex items-baseline gap-2">
            <span className="text-base text-muted-foreground">
              {formatPrice(retailPrice)}
            </span>
            <span className="text-xs text-muted-foreground">MSRP</span>
          </div>
        )}

        {/* Margin */}
        {margin && margin.amount > 0 && (
          <div className="flex items-baseline gap-2">
            <span className="text-base text-status-success-text font-medium">
              {formatPrice(margin.amount)}
            </span>
            <span className="text-xs text-muted-foreground">MY MARGIN</span>
            <span className="text-xs text-status-success-text">
              ({margin.percentage}%)
            </span>
          </div>
        )}
      </div>

      {/* Quantity Controls */}
      <div className="pt-4 border-t border-border">
        <label className="text-caption text-muted-foreground block mb-2 uppercase tracking-wide">
          Quantity
        </label>
        
        <QuantityInput
          value={quantity}
          onChange={onQuantityChange}
          min={1}
          max={maxQuantity}
          disabled={isDisabled}
          size="md"
          onMaxExceeded={onMaxExceeded}
        />

        {/* Low stock warning */}
        {lowStock && !outOfStock && (
          <p className="text-sm text-status-warning-text mt-2">
            Only {maxQuantity} left in stock
          </p>
        )}

        {/* Out of stock message */}
        {outOfStock && (
          <p className="text-sm text-destructive mt-2 font-medium">
            Out of stock
          </p>
        )}
      </div>

      {/* Dynamic Total */}
      <div className="pt-4 border-t border-border">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground uppercase tracking-wide">
            Total
          </span>
          <span className="text-xl font-bold font-display text-foreground">
            {formatPrice(total)}
          </span>
        </div>
        {quantity > 1 && (
          <p className="text-xs text-muted-foreground text-right mt-1">
            {quantity} × {formatPrice(wholesalePrice)}
          </p>
        )}
      </div>
    </div>
  );
};
