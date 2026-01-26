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

  // Calculate per-unit margin
  const unitMargin = useMemo(() => {
    if (!retailPrice || retailPrice <= 0 || !wholesalePrice) return null;
    return calculateMarginPerUnit(wholesalePrice, retailPrice);
  }, [wholesalePrice, retailPrice]);

  // Calculate totals based on quantity
  const totals = useMemo(() => {
    const totalWSP = calculateLineTotal(wholesalePrice, quantity);
    const totalMSRP = retailPrice ? retailPrice * quantity : null;
    const totalMargin = unitMargin ? unitMargin * quantity : null;
    return { wsp: totalWSP, msrp: totalMSRP, margin: totalMargin };
  }, [wholesalePrice, retailPrice, quantity, unitMargin]);

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
      {/* Pricing Info - All values update with quantity */}
      <div className="space-y-2">
        <p className="text-caption text-muted-foreground uppercase tracking-wide">Pricing</p>
        
        {/* WSP Total */}
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-display text-accent">
            {formatPrice(totals.wsp)}
          </span>
          <span className="text-sm text-muted-foreground">WSP</span>
        </div>

        {/* MSRP Total */}
        {totals.msrp && totals.msrp > 0 && (
          <div className="flex items-baseline gap-2">
            <span className="text-base text-muted-foreground">
              {formatPrice(totals.msrp)}
            </span>
            <span className="text-xs text-muted-foreground">MSRP</span>
          </div>
        )}

        {/* Margin Total */}
        {totals.margin && totals.margin > 0 && (
          <div className="flex items-baseline gap-2">
            <span className="text-base text-status-success-text font-medium">
              {formatPrice(totals.margin)}
            </span>
            <span className="text-xs text-muted-foreground">MY MARGIN</span>
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

    </div>
  );
};
