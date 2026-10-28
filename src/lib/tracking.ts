/**
 * A carrier's public tracking page for a tracking number, or null when the
 * carrier isn't one we can link to ("other", Amazon Logistics, blank).
 * Carriers come in as publishers type them: "usps", "USPS", "fedex", "UPS
 * Ground" (a Neesh label's provider plus service).
 */
export function trackingUrl(carrier: string | null | undefined, trackingNumber: string | null | undefined): string | null {
  const number = trackingNumber?.trim();
  if (!number) return null;
  const c = (carrier ?? "").trim().toLowerCase();
  const n = encodeURIComponent(number);
  if (c.startsWith("usps")) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
  if (c.startsWith("ups")) return `https://www.ups.com/track?tracknum=${n}`;
  if (c.startsWith("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
  if (c.startsWith("dhl")) return `https://www.dhl.com/global-en/home/tracking/tracking-express.html?tracking-id=${n}`;
  if (c.startsWith("canada post") || c.startsWith("canada_post")) {
    return `https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor=${n}`;
  }
  if (c.startsWith("royal mail") || c.startsWith("royal_mail")) return `https://www.royalmail.com/track-your-item#/tracking-results/${n}`;
  return null;
}
