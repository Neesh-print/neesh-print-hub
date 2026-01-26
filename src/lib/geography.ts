/**
 * Geography data for location selection.
 * Re-exports US states and adds country data with provinces.
 */

// Re-export existing US states
export { US_STATES, getStateLabel, isValidState } from './us-states';
export type { USStateValue } from './us-states';

export const CANADIAN_PROVINCES = [
  { value: 'AB', label: 'Alberta' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NL', label: 'Newfoundland and Labrador' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'NT', label: 'Northwest Territories' },
  { value: 'NU', label: 'Nunavut' },
  { value: 'ON', label: 'Ontario' },
  { value: 'PE', label: 'Prince Edward Island' },
  { value: 'QC', label: 'Quebec' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'YT', label: 'Yukon' },
] as const;

export type CanadianProvinceValue = typeof CANADIAN_PROVINCES[number]['value'];

export const COUNTRIES = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
] as const;

export type CountryValue = typeof COUNTRIES[number]['value'];

/**
 * Get states/provinces for a given country code.
 */
export function getRegionsForCountry(countryCode: string): readonly { value: string; label: string }[] {
  const { US_STATES } = require('./us-states');
  switch (countryCode) {
    case 'US':
      return US_STATES;
    case 'CA':
      return CANADIAN_PROVINCES;
    default:
      return US_STATES;
  }
}

/**
 * Get the label for state/province based on country.
 */
export function getRegionLabel(countryCode: string): string {
  return countryCode === 'CA' ? 'Province' : 'State';
}

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
