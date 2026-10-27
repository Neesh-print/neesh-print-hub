import { describe, it, expect } from "vitest";
import { blockedText } from "./shippingCopy";
import type { QuoteGroup } from "@/hooks/useShippingQuote";

const group = (patch: Partial<QuoteGroup>): QuoteGroup => ({
  publisher_id: "p1",
  publisher_name: "Orbital Studies",
  origin_country: "CA",
  origin_city: "Toronto",
  destination_country: "AU",
  zone: "international",
  copies: 5,
  items: [],
  intl_minimum: 5,
  intl_short: 0,
  title_shortfalls: [],
  can_ship: false,
  blocked_reason: null,
  shipping_usd: null,
  rate_source: null,
  carrier: null,
  service: null,
  estimated_days: null,
  duties_paid: false,
  uses_neesh_labels: false,
  quote_id: null,
  quote_expires_at: null,
  ...patch,
});

describe("blockedText", () => {
  it("says a blank flat-rate region is not shipped to, not a temporary fault", () => {
    const text = blockedText(group({ blocked_reason: "not_shipped" }));
    expect(text).toBe("This publisher doesn't ship to Australia yet. Remove their titles to check out.");
    expect(text).not.toMatch(/try again/i);
  });

  it("keeps the retry wording for a failed live rate", () => {
    expect(blockedText(group({ blocked_reason: "no_rate" }))).toMatch(/Try again shortly/);
  });
});
