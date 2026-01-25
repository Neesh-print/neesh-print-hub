/**
 * Publication Date Utilities
 * 
 * Handles month/year publication dates stored as DATE type (first of month).
 * Example: December 2025 is stored as "2025-12-01"
 */

/**
 * Format a publication date for display
 * Input: "2025-12-01" (ISO date string) or Date object
 * Output: "December 2025" or "Dec 2025" based on format param
 */
export function formatPublicationDate(
  date: string | Date | null | undefined,
  format: 'long' | 'short' = 'long'
): string | null {
  if (!date) return null;
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Validate date
  if (isNaN(dateObj.getTime())) return null;
  
  const options: Intl.DateTimeFormatOptions = {
    month: format === 'long' ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'UTC' // Prevent timezone shifts
  };
  
  return new Intl.DateTimeFormat('en-US', options).format(dateObj);
}

/**
 * Create a publication date from month and year inputs
 * Used in forms where month and year are selected separately
 */
export function createPublicationDate(
  month: number,
  year: number
): string {
  // Validate inputs
  if (month < 1 || month > 12) throw new Error('Invalid month');
  if (year < 1900 || year > 2100) throw new Error('Invalid year');
  
  // Return ISO date string for first of month
  const monthStr = month.toString().padStart(2, '0');
  return `${year}-${monthStr}-01`;
}

/**
 * Extract month and year from a publication date
 * Used to populate form fields when editing
 */
export function parsePublicationDate(
  date: string | null | undefined
): { month: number | null; year: number | null } {
  if (!date) return { month: null, year: null };
  
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return { month: null, year: null };
  
  return {
    month: dateObj.getUTCMonth() + 1, // getUTCMonth is 0-indexed
    year: dateObj.getUTCFullYear()
  };
}

/**
 * Check if a publication is from the current month
 * Useful for "New This Month" badges
 */
export function isCurrentMonth(date: string | null | undefined): boolean {
  if (!date) return false;
  
  const pubDate = new Date(date);
  if (isNaN(pubDate.getTime())) return false;
  
  const now = new Date();
  
  return (
    pubDate.getUTCMonth() === now.getUTCMonth() &&
    pubDate.getUTCFullYear() === now.getUTCFullYear()
  );
}

/**
 * Check if a publication is from the last N months
 * Useful for "Recent" filtering
 */
export function isWithinMonths(date: string | null | undefined, months: number): boolean {
  if (!date) return false;
  
  const pubDate = new Date(date);
  if (isNaN(pubDate.getTime())) return false;
  
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  
  return pubDate >= cutoff;
}

/**
 * Get month options for dropdown
 */
export const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
] as const;

/**
 * Generate year options for dropdown
 */
export function getYearOptions(
  minYear: number = 2000,
  maxYear: number = new Date().getFullYear() + 1
): number[] {
  const years: number[] = [];
  for (let year = maxYear; year >= minYear; year--) {
    years.push(year);
  }
  return years;
}
