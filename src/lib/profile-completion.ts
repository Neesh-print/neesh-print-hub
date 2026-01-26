/**
 * Profile completion utilities for retailer profiles.
 * Determines which fields are required and tracks completion progress.
 */

export interface RetailerProfileData {
  shop_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  city: string | null;
  state: string | null;
  shop_description: string | null;
  store_types: string[] | null;
  // Optional fields not required for completion
  shop_url?: string | null;
  instagram_handle?: string | null;
  profile_image_url?: string | null;
}

export interface ProfileCompletionResult {
  isComplete: boolean;
  completedCount: number;
  totalRequired: number;
  percentage: number;
  missingFields: string[];
}

export const REQUIRED_FIELDS: { key: keyof RetailerProfileData; label: string }[] = [
  { key: 'shop_name', label: 'Store name' },
  { key: 'contact_name', label: 'Contact name' },
  { key: 'contact_email', label: 'Contact email' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'shop_description', label: 'Store description' },
  { key: 'store_types', label: 'Store type' },
];

/**
 * Check the completion status of a retailer profile.
 * Returns detailed information about which fields are complete/missing.
 */
export function checkProfileCompletion(profile: RetailerProfileData): ProfileCompletionResult {
  const missingFields: string[] = [];
  
  REQUIRED_FIELDS.forEach(({ key, label }) => {
    const value = profile[key];
    
    if (key === 'store_types') {
      // Array field - must have at least one item
      if (!Array.isArray(value) || value.length === 0) {
        missingFields.push(label);
      }
    } else if (key === 'shop_description') {
      // Description must be at least 50 characters
      if (!value || (typeof value === 'string' && value.trim().length < 50)) {
        missingFields.push(label);
      }
    } else {
      // String field - must be non-empty
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        missingFields.push(label);
      }
    }
  });
  
  const completedCount = REQUIRED_FIELDS.length - missingFields.length;
  const totalRequired = REQUIRED_FIELDS.length;
  
  return {
    isComplete: missingFields.length === 0,
    completedCount,
    totalRequired,
    percentage: Math.round((completedCount / totalRequired) * 100),
    missingFields,
  };
}

/**
 * Quick check if profile is complete (has profile_completed_at set or passes validation).
 */
export function isProfileComplete(profile: { profile_completed_at?: string | null } & RetailerProfileData): boolean {
  if (profile.profile_completed_at) return true;
  return checkProfileCompletion(profile).isComplete;
}
