/**
 * Geography data for location selection.
 * Re-exports US states and adds country data.
 */

// Re-export existing US states
export { US_STATES, getStateLabel, isValidState } from './us-states';
export type { USStateValue } from './us-states';

export const COUNTRIES = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
] as const;

export type CountryValue = typeof COUNTRIES[number]['value'];

/**
 * Get the display label for a country code.
 */
export function getCountryLabel(value: string): string | null {
  const country = COUNTRIES.find(c => c.value === value);
  return country?.label || value;
}

/**
 * Check if a value is a valid country code.
 */
export function isValidCountry(value: string): boolean {
  return COUNTRIES.some(c => c.value === value);
}
