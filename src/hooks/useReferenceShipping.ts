import { useShippingPreview, type PreviewLine } from "@/hooks/useShippingQuote";
import { usePublisherShipping } from "@/hooks/usePublisherShipping";
import { REFERENCE_US_ADDRESS, flatRatesFor, flatShipping, regionFor, zoneFor, type ShipAddress } from "@/lib/shipping";

export interface ReferenceShipping {
  /** Shipping in USD per line key; null when it can't be quoted. */
  byKey: Map<string, number | null>;
  isLoading: boolean;
  /** Why nothing could be quoted, for the empty state. */
  problem: "needs_origin" | "no_rate" | null;
  originCountry: string | null;
  zone: "domestic" | "international";
  intlMinCopies: number;
}

/**
 * Shipping to the reference New York space (10030) for a publisher, using
 * their live rates, or their own flat rates when they chose those. Used by
 * "What a space earns", the title badges and the onboarding table.
 */
export function useReferenceShipping(opts: {
  publisherId: string | null | undefined;
  lines: PreviewLine[];
  enabled: boolean;
  /** Quote from an address that is still being typed (onboarding). */
  origin?: Partial<ShipAddress> | null;
}): ReferenceShipping {
  const settings = usePublisherShipping(opts.publisherId, opts.enabled);
  const s = settings.data;
  const originCountry = opts.origin?.country || s?.ships_from_address.country || s?.ships_from_country || null;
  const zone = zoneFor(originCountry, REFERENCE_US_ADDRESS.country);
  const flat = !opts.origin && s?.shipping_rate_mode === "flat";

  const preview = useShippingPreview({
    lines: opts.lines,
    destination: "us",
    origin: opts.origin ?? null,
    enabled: opts.enabled && !!s && !flat,
  });

  const byKey = new Map<string, number | null>();
  if (flat && s) {
    const rates = flatRatesFor(s.flat_rates, regionFor(originCountry, REFERENCE_US_ADDRESS.country));
    for (const l of opts.lines) byKey.set(l.key, flatShipping(rates, l.copies));
  } else {
    for (const r of preview.data?.results ?? []) byKey.set(r.key, r.shipping_usd);
  }

  let problem: ReferenceShipping["problem"] = null;
  if (preview.data?.status === "needs_origin") problem = "needs_origin";
  else if ((preview.data || flat) && opts.lines.length > 0 && [...byKey.values()].every((v) => v === null)) problem = "no_rate";

  return {
    byKey,
    isLoading: settings.isLoading || (!flat && preview.isLoading && opts.enabled),
    problem,
    originCountry,
    zone,
    intlMinCopies: s?.intl_min_copies ?? 5,
  };
}
