/**
 * Store type definitions for retailer profiles.
 * Retailers can select multiple store types to describe their business.
 */

export const STORE_TYPES = [
  { value: 'independent-bookstore', label: 'Independent Bookstore' },
  { value: 'magazine-retailer', label: 'Magazine Retailer' },
  { value: 'museum-shop', label: 'Museum Shop' },
  { value: 'gallery', label: 'Gallery' },
  { value: 'gift-shop', label: 'Gift Shop' },
  { value: 'concept-store', label: 'Concept Store' },
  { value: 'record-store', label: 'Record Store' },
  { value: 'coffee-shop', label: 'Coffee Shop' },
  { value: 'design-studio', label: 'Design Studio' },
  { value: 'lifestyle-store', label: 'Lifestyle Store' },
  { value: 'newsstand', label: 'Newsstand' },
  { value: 'pop-up', label: 'Pop-Up Shop' },
  { value: 'online-only', label: 'Online Only' },
  { value: 'other', label: 'Other' },
] as const;

export type StoreTypeValue = typeof STORE_TYPES[number]['value'];

/**
 * Get the display label for a store type value.
 * Returns null if the value doesn't match any known type.
 */
export function getStoreTypeLabel(value: string): string | null {
  const type = STORE_TYPES.find(t => t.value === value);
  return type?.label || null;
}

/**
 * Get labels for multiple store type values.
 * Filters out any invalid values.
 */
export function getStoreTypeLabels(values: string[]): string[] {
  return values
    .map(v => getStoreTypeLabel(v))
    .filter((label): label is string => label !== null);
}
