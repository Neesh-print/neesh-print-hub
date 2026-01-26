/**
 * Country utilities for origin country display and selection.
 * Uses ISO 3166-1 alpha-2 codes for standardization.
 */

// Fallback country data for client-side rendering without an extra fetch
export const COUNTRY_MAP: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  JP: 'Japan',
  DE: 'Germany',
  FR: 'France',
  IT: 'Italy',
  ES: 'Spain',
  KR: 'South Korea',
  NL: 'Netherlands',
  AU: 'Australia',
  CA: 'Canada',
  SE: 'Sweden',
  CH: 'Switzerland',
  BE: 'Belgium',
  AT: 'Austria',
  DK: 'Denmark',
  NO: 'Norway',
  FI: 'Finland',
  PT: 'Portugal',
  IE: 'Ireland',
  NZ: 'New Zealand',
  MX: 'Mexico',
  BR: 'Brazil',
  AR: 'Argentina',
  CL: 'Chile',
  PL: 'Poland',
  CZ: 'Czech Republic',
  HU: 'Hungary',
  GR: 'Greece',
  TR: 'Turkey',
  RU: 'Russia',
  CN: 'China',
  TW: 'Taiwan',
  HK: 'Hong Kong',
  SG: 'Singapore',
  IN: 'India',
  TH: 'Thailand',
  ID: 'Indonesia',
  MY: 'Malaysia',
  PH: 'Philippines',
  ZA: 'South Africa',
  EG: 'Egypt',
  IL: 'Israel',
  AE: 'United Arab Emirates',
  SA: 'Saudi Arabia',
};

// Ordered list for dropdowns (most common first)
export const COUNTRY_LIST = Object.entries(COUNTRY_MAP).map(([code, name]) => ({
  code,
  name,
}));

/**
 * Get the display name for a country code.
 * Returns null if code is null/undefined.
 * Returns the raw code if not found in map.
 */
export function getCountryName(code: string | null | undefined): string | null {
  if (!code) return null;
  return COUNTRY_MAP[code.toUpperCase()] || code;
}

/**
 * Convert a country code to its flag emoji.
 * Uses regional indicator symbols to create flag emojis.
 * Example: 'US' -> 🇺🇸, 'GB' -> 🇬🇧
 */
export function getCountryFlag(code: string | null | undefined): string | null {
  if (!code) return null;
  
  // Regional indicator symbols start at 0x1F1E6 (A) and go up
  // To convert a letter to regional indicator: letter code point + 127397
  const codePoints = code
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  
  return String.fromCodePoint(...codePoints);
}
