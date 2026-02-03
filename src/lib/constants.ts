// =============================================================
// Shared Constants for Neesh Marketplace
// =============================================================

// Country options - standardized across all forms
export const COUNTRIES = [
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "CA", label: "Canada" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "AU", label: "Australia" },
  { value: "NL", label: "Netherlands" },
  { value: "JP", label: "Japan" },
  { value: "IT", label: "Italy" },
  { value: "ES", label: "Spain" },
  { value: "SE", label: "Sweden" },
  { value: "DK", label: "Denmark" },
  { value: "NO", label: "Norway" },
  { value: "BE", label: "Belgium" },
  { value: "CH", label: "Switzerland" },
  { value: "AT", label: "Austria" },
  { value: "IE", label: "Ireland" },
  { value: "NZ", label: "New Zealand" },
  { value: "OTHER", label: "Other" },
] as const;

export type CountryCode = typeof COUNTRIES[number]['value'];

// Publication frequencies
export const PUBLICATION_FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "bimonthly", label: "Bimonthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "biannual", label: "Biannual" },
  { value: "annual", label: "Annual" },
  { value: "irregular", label: "Irregular" },
] as const;

export type PublicationFrequency = typeof PUBLICATION_FREQUENCIES[number]['value'];

// Distribution regions
export const DISTRIBUTION_REGIONS = [
  { id: "north_america", label: "North America" },
  { id: "eu", label: "EU" },
  { id: "uk", label: "UK Only" },
  { id: "asia_pacific", label: "Asia Pacific" },
  { id: "africa", label: "Africa" },
  { id: "south_america", label: "South America" },
  { id: "worldwide", label: "Worldwide" },
  { id: "na", label: "N/A (Not yet selling)" },
] as const;

export type DistributionRegion = typeof DISTRIBUTION_REGIONS[number]['id'];

// Fulfillment methods
export const FULFILLMENT_OPTIONS = [
  {
    value: "neesh",
    label: "Neesh Fulfillment",
    description: "Send us inventory, we handle shipping",
  },
  {
    value: "self",
    label: "Self Fulfillment",
    description: "You ship directly to retailers",
  },
  {
    value: "third_party",
    label: "Third Party Fulfillment",
    description: "You use a distributor or 3PL",
  },
  {
    value: "not_sure",
    label: "Not sure yet",
    description: "We'll figure it out together",
  },
] as const;

export type FulfillmentMethod = typeof FULFILLMENT_OPTIONS[number]['value'];

// Store categories for retailers
export const STORE_CATEGORIES = [
  { id: "independent_bookstore", label: "Independent Bookstore" },
  { id: "museum_shop", label: "Museum Shop" },
  { id: "art_gallery", label: "Art Gallery" },
  { id: "gift_shop", label: "Gift Shop" },
  { id: "university_bookstore", label: "University Bookstore" },
  { id: "boutique_fashion", label: "Boutique/Fashion" },
  { id: "coffee_shop_cafe", label: "Coffee Shop/Café" },
  { id: "hotel_lobby", label: "Hotel/Lobby Shop" },
  { id: "lifestyle_store", label: "Lifestyle Store" },
  { id: "other", label: "Other" },
] as const;

export type StoreCategory = typeof STORE_CATEGORIES[number]['id'];

// Store types for retailers
export const STORE_TYPES = [
  { value: "independent", label: "Independent" },
  { value: "small_chain", label: "Small Chain (2-5)" },
  { value: "regional_chain", label: "Regional Chain (6-20)" },
  { value: "national_chain", label: "National Chain (20+)" },
] as const;

// Store sizes
export const STORE_SIZES = [
  { value: "small", label: "Small (<1,000 sq ft)" },
  { value: "medium", label: "Medium (1,000-3,000 sq ft)" },
  { value: "large", label: "Large (>3,000 sq ft)" },
] as const;

// Years in business
export const YEARS_IN_BUSINESS = [
  { value: "less_than_1", label: "Less than 1 year" },
  { value: "1_to_3", label: "1-3 years" },
  { value: "3_to_10", label: "3-10 years" },
  { value: "10_plus", label: "10+ years" },
] as const;

// Application status
export const APPLICATION_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type ApplicationStatus = typeof APPLICATION_STATUS[keyof typeof APPLICATION_STATUS];

// Publisher application total steps
export const PUBLISHER_APPLICATION_STEPS = 13;

// Retailer application total steps
export const RETAILER_APPLICATION_STEPS = 9;
