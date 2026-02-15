/**
 * Inventory Scarcity Utilities
 * 
 * Stock thresholds and helper functions for displaying inventory scarcity indicators.
 * Publisher-provided inventory is already discounted 20% internally to avoid overpromising.
 */

export const STOCK_THRESHOLDS = {
  CRITICAL: 5,    // "Only X left" - red/urgent
  LOW: 15,        // "Low stock" - amber/warning  
  NORMAL: 9999,   // Regular display - no urgency
} as const;

export type StockLevel = 'out' | 'critical' | 'low' | 'normal';

/**
 * Determine stock level based on quantity
 */
export function getStockLevel(quantity: number | null | undefined): StockLevel {
  if (quantity === null || quantity === undefined) return 'normal'; // Not tracked = available
  if (quantity <= 0) return 'out';
  if (quantity <= STOCK_THRESHOLDS.CRITICAL) return 'critical';
  if (quantity <= STOCK_THRESHOLDS.LOW) return 'low';
  return 'normal';
}

/**
 * Get human-readable stock message
 * Returns null for normal stock levels (no message needed)
 */
export function getStockMessage(quantity: number | null | undefined): string | null {
  const level = getStockLevel(quantity);
  
  switch (level) {
    case 'out':
      return 'Out of stock';
    case 'critical':
      return `Only ${quantity} left`;
    case 'low':
      return `${quantity} in stock`;
    case 'normal':
      return null; // Don't show message for normal stock
  }
}

/**
 * Check if stock level requires urgent attention
 */
export function isUrgentStock(quantity: number | null | undefined): boolean {
  const level = getStockLevel(quantity);
  return level === 'critical' || level === 'out';
}

/**
 * Check if stock is available for purchase
 */
export function isInStock(quantity: number | null | undefined): boolean {
  return getStockLevel(quantity) !== 'out';
}
