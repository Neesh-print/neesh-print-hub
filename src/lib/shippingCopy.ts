/**
 * UI copy and formatting for shipping_v2. No em dashes in copy (house rule).
 */
import { MARGIN_BAND_LABEL, countryName, countryShortName, type LandedMargin, type MarginBand } from "@/lib/shipping";
import type { StatusType } from "@/components/neesh/StatusBadge";
import type { QuoteGroup } from "@/hooks/useShippingQuote";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** $12.34, or −$12.34 with a real minus sign. */
export function money(n: number): string {
  const s = usd.format(Math.abs(n));
  return n < 0 ? `−${s}` : s;
}

/** +$35.04 / −$32.41 */
export function signedMoney(n: number): string {
  return n < 0 ? money(n) : `+${money(n)}`;
}

export function percent(fraction: number): string {
  const p = Math.round(fraction * 100);
  return p < 0 ? `−${Math.abs(p)}%` : `${p}%`;
}

/** "+$35.04 (35%)" */
export function marginText(m: Pick<LandedMargin, "margin" | "marginPct">): string {
  return `${signedMoney(m.margin)} (${percent(m.marginPct)})`;
}

export const MARGIN_BADGE_STATUS: Record<MarginBand, StatusType> = {
  loss: "margin-loss",
  thin: "margin-thin",
  healthy: "margin-healthy",
};

export const marginBandLabel = (band: MarginBand) => MARGIN_BAND_LABEL[band];

/** Text colour for a margin amount. */
export const marginTextClass = (band: MarginBand) =>
  band === "loss" ? "text-status-error-text" : band === "thin" ? "text-status-pending-text" : "text-status-success-text";

/** "Colissimo, duties paid" */
export function carrierLine(g: Pick<QuoteGroup, "carrier" | "service" | "duties_paid" | "rate_source">): string {
  if (g.rate_source === "flat") return "Publisher's flat rate";
  const name = g.carrier || "Carrier";
  return g.duties_paid ? `${name}, duties paid` : name;
}

/** Why a publisher group cannot be checked out (mirrors create-checkout). */
export function blockedText(g: QuoteGroup): string {
  switch (g.blocked_reason) {
    case "minimum":
      if (g.intl_short > 0) {
        return `${countryShortName(g.destination_country)} minimum ${g.intl_minimum} copies. Add ${g.intl_short} more.`;
      }
      if (g.title_shortfalls.length > 0) {
        const t = g.title_shortfalls[0];
        return `${t.title} has a minimum of ${t.minimum} copies. Add ${t.short} more.`;
      }
      return "Below this publisher's minimum.";
    case "no_international":
      return `This publisher doesn't ship to ${countryName(g.destination_country)} yet. Remove their titles to check out.`;
    case "no_origin":
      return "This publisher hasn't set where they ship from yet, so shipping can't be quoted. Remove their titles to check out.";
    case "missing_weight":
      return "A title from this publisher is missing its weight, so shipping can't be quoted. Remove it to check out.";
    case "no_rate":
      return "We couldn't get a shipping rate from this publisher to your address. Try again shortly, or remove their titles.";
    case "unavailable":
      return "A title from this publisher isn't available right now. Remove it to check out.";
    default:
      return "";
  }
}

/** "Ships from Paris, France" */
export function shipsFromText(city: string | null | undefined, country: string | null | undefined): string {
  const parts = [city, country ? countryName(country) : null].filter(Boolean);
  return parts.length ? `Ships from ${parts.join(", ")}` : "";
}
