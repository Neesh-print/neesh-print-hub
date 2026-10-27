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
import { landedMargin, spaceUnitPrice } from "@/lib/shipping";
import { StatusBadge } from "@/components/neesh/StatusBadge";
import { MARGIN_BADGE_STATUS, marginBandLabel, marginText, marginTextClass } from "@/lib/shippingCopy";

/** shipping_v2: landed pricing with the live shipping quote. */
export interface LandedPricing {
  /** Shipping for this order in USD, or null when not quoted (yet). */
  shippingUsd: number | null;
  /** e.g. "Shipping to New York" */
  shippingLabel: string;
  /** Shown instead of (or under) the amount: loading, blocked, or marginal-shipping note. */
  shippingNote?: string | null;
  loading?: boolean;
}

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
  /** shipping_v2: space prices (WSP x 1.10), shipping and landed margin */
  landed?: LandedPricing;
  /** Lowest selectable quantity (title and international minimums). Default 1. */
  minQuantity?: number;
  /** Note under the quantity, e.g. "US minimum 5 copies." */
  minimumNote?: string | null;
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
  landed,
  minQuantity = 1,
  minimumNote,
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

  if (landed) {
    const goods = spaceUnitPrice(wholesalePrice) * quantity;
    const msrpTotal = retailPrice && retailPrice > 0 ? retailPrice * quantity : null;
    const m = landed.shippingUsd !== null && retailPrice && retailPrice > 0
      ? landedMargin({ wsp: wholesalePrice, srp: retailPrice, quantity, shippingUsd: landed.shippingUsd })
      : null;

    return (
      <div className={cn("space-y-4", className)}>
        <div className="space-y-1">
          <p className="text-caption text-muted-foreground uppercase tracking-wide mb-2">Pricing</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-display text-accent">{formatPrice(goods)}</span>
            <span className="text-sm text-muted-foreground">WSP</span>
          </div>
          {msrpTotal && (
            <div className="flex items-baseline gap-2">
              <span className="text-base text-muted-foreground">{formatPrice(msrpTotal)}</span>
              <span className="text-xs text-muted-foreground">MSRP</span>
            </div>
          )}
          <div className="flex items-baseline gap-2">
            <span className="text-base text-muted-foreground">
              {landed.loading ? "Quoting..." : landed.shippingUsd !== null ? formatPrice(landed.shippingUsd) : "Not available"}
            </span>
            <span className="text-xs text-muted-foreground uppercase">{landed.shippingLabel}</span>
          </div>
          {landed.shippingNote && (
            <p className="text-xs text-muted-foreground">{landed.shippingNote}</p>
          )}
          {m && (
            <div className="flex items-center gap-2 pt-0.5">
              <span className={cn("text-base font-medium", marginTextClass(m.band))}>{marginText(m)}</span>
              <span className="text-xs text-muted-foreground">MY MARGIN</span>
              <StatusBadge status={MARGIN_BADGE_STATUS[m.band]} label={marginBandLabel(m.band)} />
            </div>
          )}
          {m && m.margin < 0 && (
            <p className="text-xs text-status-error-text">You'd lose {formatPrice(Math.abs(m.margin))} at this quantity.</p>
          )}
        </div>

        <div className="pt-4 border-t border-border">
          <label className="text-caption text-muted-foreground block mb-2 uppercase tracking-wide">
            Quantity
          </label>
          <QuantityInput
            value={quantity}
            onChange={onQuantityChange}
            min={minQuantity}
            max={maxQuantity}
            disabled={isDisabled}
            size="md"
            onMaxExceeded={onMaxExceeded}
          />
          {minimumNote && <p className="text-xs text-muted-foreground mt-2">{minimumNote}</p>}
          {lowStock && !outOfStock && (
            <p className="text-sm text-status-warning-text mt-2">Only {maxQuantity} left in stock</p>
          )}
          {outOfStock && <p className="text-sm text-destructive mt-2 font-medium">Out of stock</p>}
        </div>
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
          min={minQuantity}
          max={maxQuantity}
          disabled={isDisabled}
          size="md"
          onMaxExceeded={onMaxExceeded}
        />

        {minimumNote && <p className="text-xs text-muted-foreground mt-2">{minimumNote}</p>}

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
