/**
 * Magazine presentation helpers.
 *
 * Companion to `inventory.ts` (which owns stock/availability). This module owns
 * "is this magazine presentable in a customer-facing grid?" — currently: does it
 * have a cover image. Keep customer-facing surfaces (retailer catalogue, New
 * Arrivals) filtering through here so they stay consistent. Publisher/admin
 * management views deliberately do NOT use this — publishers must still see their
 * own imageless titles in order to fix them.
 */

export interface MagazineImageInfo {
  cover_image_url?: string | null;
}

/**
 * True when a magazine has a usable cover image. Empty/whitespace URLs count as
 * missing (they render as the placeholder).
 */
export function hasCoverImage(mag: MagazineImageInfo): boolean {
  return typeof mag.cover_image_url === 'string' && mag.cover_image_url.trim().length > 0;
}
