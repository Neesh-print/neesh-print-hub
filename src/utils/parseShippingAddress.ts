/**
 * Safely parses a shipping_address value from the database.
 * The orders.shipping_address column is JSONB, but depending on how
 * the data gets returned (direct query vs. view vs. generated types),
 * it may come back as either a parsed object or a JSON string.
 *
 * Expected structure:
 * {
 *   name: string,
 *   address: {
 *     line1: string,
 *     line2?: string,
 *     city: string,
 *     state: string,
 *     postal_code: string,
 *     country: string
 *   }
 * }
 */

export interface ShippingAddress {
  name?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
}

export function parseShippingAddress(
  raw: unknown
): ShippingAddress | null {
  if (!raw) return null;

  // If it's already a proper object, return it
  if (typeof raw === 'object' && raw !== null) {
    return raw as ShippingAddress;
  }

  // If it's a string, try to JSON.parse it
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as ShippingAddress;
      }
    } catch {
      // If parsing fails, it's not valid JSON
      console.warn('Failed to parse shipping_address string:', raw);
      return null;
    }
  }

  return null;
}
