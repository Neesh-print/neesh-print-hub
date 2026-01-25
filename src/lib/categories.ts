/**
 * Magazine Category Taxonomy
 * 
 * This defines the official category list for the Neesh marketplace.
 * Categories are ordered alphabetically by default, with displayOrder
 * allowing custom sorting if needed.
 */

export interface Category {
  slug: string;
  name: string;
  displayOrder: number;
}

/**
 * Official category taxonomy
 * Updated to address retailer feedback:
 * - Removed overly broad categories (Culture, Arts & Culture)
 * - Split Design into specific subcategories
 * - Renamed Literature → Literary
 * - Added Queer
 */
export const CATEGORIES: readonly Category[] = [
  { slug: 'architecture', name: 'Architecture', displayOrder: 1 },
  { slug: 'art', name: 'Art', displayOrder: 2 },
  { slug: 'craft', name: 'Craft', displayOrder: 3 },
  { slug: 'fashion', name: 'Fashion', displayOrder: 4 },
  { slug: 'food', name: 'Food', displayOrder: 5 },
  { slug: 'gaming', name: 'Gaming', displayOrder: 6 },
  { slug: 'graphic-design', name: 'Graphic Design', displayOrder: 7 },
  { slug: 'interior-design', name: 'Interior Design', displayOrder: 8 },
  { slug: 'literary', name: 'Literary', displayOrder: 9 },
  { slug: 'music', name: 'Music', displayOrder: 10 },
  { slug: 'nature', name: 'Nature', displayOrder: 11 },
  { slug: 'nightlife', name: 'Nightlife', displayOrder: 12 },
  { slug: 'photography', name: 'Photography', displayOrder: 13 },
  { slug: 'product-design', name: 'Product Design', displayOrder: 14 },
  { slug: 'queer', name: 'Queer', displayOrder: 15 },
  { slug: 'sports', name: 'Sports', displayOrder: 16 },
  { slug: 'technology', name: 'Technology', displayOrder: 17 },
  { slug: 'travel', name: 'Travel', displayOrder: 18 },
  { slug: 'typography', name: 'Typography', displayOrder: 19 },
] as const;

export type CategorySlug = typeof CATEGORIES[number]['slug'];

/**
 * Legacy categories that have been removed or renamed.
 * Maps old category names to their replacements (or null if removed).
 */
export const LEGACY_CATEGORY_MAPPINGS: Record<string, string | null> = {
  // Renamed
  'Literature': 'Literary',
  'literature': 'Literary',
  
  // Removed - too broad
  'Culture': null,
  'culture': null,
  'Arts & Culture': null,
  'arts-and-culture': null,
  
  // Split into specific categories - removed generic
  'Design': null,
  'design': null,
  
  // Lifestyle was too vague
  'Lifestyle': null,
  'lifestyle': null,
  
  // Food & Drink simplified to Food
  'Food & Drink': 'Food',
  'food-and-drink': 'Food',
};

/**
 * Get all active categories sorted by display order
 */
export function getCategories(): Category[] {
  return [...CATEGORIES].sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Get category names as an array (for select dropdowns)
 */
export function getCategoryNames(): string[] {
  return getCategories().map(c => c.name);
}

/**
 * Get category options for form selects
 */
export function getCategoryOptions(): { value: string; label: string }[] {
  return getCategories().map(c => ({ value: c.name, label: c.name }));
}

/**
 * Get category name from slug
 */
export function getCategoryName(slug: string): string | null {
  const category = CATEGORIES.find(c => c.slug === slug);
  return category?.name || null;
}

/**
 * Get category slug from name
 */
export function getCategorySlug(name: string): string | null {
  const category = CATEGORIES.find(c => c.name.toLowerCase() === name.toLowerCase());
  return category?.slug || null;
}

/**
 * Check if a category name is valid (exists in current taxonomy)
 */
export function isValidCategory(name: string): boolean {
  return CATEGORIES.some(c => c.name.toLowerCase() === name.toLowerCase());
}

/**
 * Normalize a category name - handles legacy mappings and case variations
 * Returns null if the category is deprecated with no replacement
 */
export function normalizeCategory(input: string | null): string | null {
  if (!input || !input.trim()) return null;
  
  const trimmed = input.trim();
  
  // Check legacy mappings first
  if (trimmed in LEGACY_CATEGORY_MAPPINGS) {
    return LEGACY_CATEGORY_MAPPINGS[trimmed];
  }
  
  // Check if it's a valid current category (case-insensitive match)
  const match = CATEGORIES.find(c => c.name.toLowerCase() === trimmed.toLowerCase());
  if (match) {
    return match.name; // Return properly cased name
  }
  
  // Return as-is if no match found (for backwards compatibility)
  return trimmed;
}

/**
 * Check if a category needs review (is deprecated or legacy)
 */
export function categoryNeedsReview(name: string | null): boolean {
  if (!name) return false;
  
  // Check if it's a legacy category
  if (name in LEGACY_CATEGORY_MAPPINGS) return true;
  
  // Check if it's not in the current taxonomy
  return !isValidCategory(name);
}

/**
 * Get suggested replacement for a deprecated category
 */
export function getSuggestedReplacement(name: string): string[] | null {
  if (!name) return null;
  
  const trimmed = name.trim();
  
  // Check legacy mappings
  if (trimmed in LEGACY_CATEGORY_MAPPINGS) {
    const replacement = LEGACY_CATEGORY_MAPPINGS[trimmed];
    if (replacement) return [replacement];
    
    // For removed categories, suggest related categories
    if (trimmed.toLowerCase() === 'design') {
      return ['Graphic Design', 'Interior Design', 'Product Design', 'Typography'];
    }
    if (trimmed.toLowerCase() === 'culture' || trimmed.toLowerCase() === 'arts & culture') {
      return ['Art', 'Literary', 'Music'];
    }
    if (trimmed.toLowerCase() === 'lifestyle') {
      return ['Food', 'Travel', 'Fashion'];
    }
  }
  
  return null;
}
