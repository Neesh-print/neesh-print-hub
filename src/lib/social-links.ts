/**
 * Construct full Instagram URL from handle
 */
export function getInstagramUrl(handle: string | null): string | null {
  if (!handle) return null;
  // Strip @ if someone included it
  const cleanHandle = handle.replace(/^@/, '');
  return `https://instagram.com/${cleanHandle}`;
}

/**
 * Extract Instagram handle from various input formats
 * Handles: "username", "@username", "instagram.com/username", full URLs
 */
export function normalizeInstagramHandle(input: string): string | null {
  if (!input || !input.trim()) return null;
  
  let handle = input.trim();
  
  // Remove @ prefix
  handle = handle.replace(/^@/, '');
  
  // Extract from full URL
  const urlMatch = handle.match(/(?:instagram\.com|instagr\.am)\/([a-zA-Z0-9_.]+)/i);
  if (urlMatch) {
    handle = urlMatch[1];
  }
  
  // Remove trailing slash or query params
  handle = handle.split('/')[0].split('?')[0];
  
  // Validate: Instagram handles are alphanumeric + underscore + period, max 30 chars
  if (!/^[a-zA-Z0-9_.]+$/.test(handle) || handle.length > 30) {
    return null;
  }
  
  return handle;
}

/**
 * Normalize website URL - ensure it has protocol
 */
export function normalizeWebsiteUrl(input: string): string | null {
  if (!input || !input.trim()) return null;
  
  let url = input.trim();
  
  // Add https:// if no protocol
  if (!url.match(/^https?:\/\//i)) {
    url = `https://${url}`;
  }
  
  // Basic URL validation
  try {
    new URL(url);
    return url;
  } catch {
    return null;
  }
}

/**
 * Extract display domain from URL (for showing "example.com" instead of full URL)
 */
export function getDisplayDomain(url: string | null): string | null {
  if (!url) return null;
  
  try {
    const parsed = new URL(url);
    // Remove www. prefix for cleaner display
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Format Instagram handle for display (with @ prefix)
 */
export function formatInstagramHandle(handle: string | null): string | null {
  if (!handle) return null;
  const cleanHandle = handle.replace(/^@/, '');
  return `@${cleanHandle}`;
}
