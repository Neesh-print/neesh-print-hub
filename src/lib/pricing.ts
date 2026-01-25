/**
 * Neesh Pricing Utilities
 * 
 * All calculations account for Neesh's 20% markup (10% platform fee + 10% shipping buffer).
 * Prices are expected in dollars (not cents).
 */

/**
 * Neesh markup multiplier: 10% platform fee + 10% shipping buffer
 */
export const NEESH_MARKUP_MULTIPLIER = 1.20;

/**
 * Currency formatter - created once for performance
 */
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format dollars to display string
 */
export function formatPrice(dollars: number): string {
  return currencyFormatter.format(dollars);
}

/**
 * Calculate the retailer's effective cost (what they actually pay)
 * WSP × 1.20 accounts for Neesh markup and shipping
 */
export function calculateEffectiveCost(
  wholesalePrice: number,
  quantity: number = 1
): number {
  if (!wholesalePrice || wholesalePrice <= 0) return 0;
  return wholesalePrice * NEESH_MARKUP_MULTIPLIER * quantity;
}

/**
 * Calculate the retailer's true margin per unit
 * MSRP - (WSP × 1.20)
 */
export function calculateMarginPerUnit(
  wholesalePrice: number,
  retailPrice: number
): number {
  if (!wholesalePrice || !retailPrice) return 0;
  const effectiveCost = wholesalePrice * NEESH_MARKUP_MULTIPLIER;
  return retailPrice - effectiveCost;
}

/**
 * Calculate margin percentage
 * (Margin / MSRP) × 100
 */
export function calculateMarginPercentage(
  wholesalePrice: number,
  retailPrice: number
): number {
  if (!retailPrice || retailPrice === 0) return 0;
  const margin = calculateMarginPerUnit(wholesalePrice, retailPrice);
  return (margin / retailPrice) * 100;
}

/**
 * Calculate total margin for a quantity
 */
export function calculateTotalMargin(
  wholesalePrice: number,
  retailPrice: number,
  quantity: number
): number {
  return calculateMarginPerUnit(wholesalePrice, retailPrice) * quantity;
}

/**
 * Calculate line item total (WSP × quantity - what retailer pays at checkout)
 * Note: This is the displayed total, not including the markup which is handled by Neesh
 */
export function calculateLineTotal(
  wholesalePrice: number,
  quantity: number
): number {
  if (!wholesalePrice || wholesalePrice <= 0) return 0;
  if (!quantity || quantity <= 0) return 0;
  // Round to 2 decimal places to avoid floating point issues
  return Math.round(wholesalePrice * quantity * 100) / 100;
}

/**
 * Check if stock is low (threshold: 5 or less)
 */
export function isLowStock(stockQuantity: number | null | undefined): boolean {
  if (stockQuantity === null || stockQuantity === undefined) return false;
  return stockQuantity > 0 && stockQuantity <= 5;
}

/**
 * Check if item is out of stock
 */
export function isOutOfStock(stockQuantity: number | null | undefined): boolean {
  return stockQuantity !== null && stockQuantity !== undefined && stockQuantity <= 0;
}
