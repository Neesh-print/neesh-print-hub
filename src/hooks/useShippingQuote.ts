import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";
import type { PackagingPreset, ShipAddress, TitleShortfall, Zone } from "@/lib/shipping";

/** One publisher group from quote-shipping (mirrors supabase/functions/_shared/shipping-quote.ts). */
export interface QuoteGroup {
  publisher_id: string;
  publisher_name: string;
  origin_country: string | null;
  origin_city: string | null;
  destination_country: string;
  zone: Zone;
  copies: number;
  items: { magazine_id: string; quantity: number }[];
  intl_minimum: number | null;
  intl_short: number;
  title_shortfalls: TitleShortfall[];
  can_ship: boolean;
  blocked_reason: "no_international" | "not_shipped" | "no_origin" | "missing_weight" | "no_rate" | "minimum" | "unavailable" | null;
  shipping_usd: number | null;
  rate_source: "shippo" | "flat" | null;
  carrier: string | null;
  service: string | null;
  estimated_days: number | null;
  duties_paid: boolean;
  /** US customs handling for this parcel; 0 when off or not US-bound from abroad. */
  customs_usd: number;
  customs_route: "publisher" | "neesh" | null;
  uses_neesh_labels: boolean;
  quote_id: string | null;
  quote_expires_at: string | null;
}

export interface CartQuote {
  status: "ok" | "needs_address";
  destination: { city: string; state: string | null; country: string; postal_code: string } | null;
  destination_is_reference: boolean;
  groups: QuoteGroup[];
}

export interface QuoteItem {
  magazine_id: string;
  quantity: number;
}

async function invokeQuote<T>(body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke("quote-shipping", { body });
  if (error) {
    let message = error.message || "Could not quote shipping";
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const b = await ctx.json();
        if (b?.error) message = b.error;
      } catch {
        // keep generic message
      }
    }
    throw new Error(message);
  }
  return data as T;
}

/**
 * Live shipping quote for a cart (or a hypothetical cart on a title page).
 * Re-quotes when items or the address change; quantity changes are debounced.
 */
export function useShippingQuote(
  items: QuoteItem[],
  opts: { enabled: boolean; persist?: boolean; allowReference?: boolean; addressKey?: string | null },
) {
  const key = JSON.stringify(
    [...items].filter((i) => i.quantity > 0).sort((a, b) => a.magazine_id.localeCompare(b.magazine_id)),
  );
  const debouncedKey = useDebounce(key, 400);
  return useQuery({
    queryKey: ["shipping-quote", debouncedKey, opts.persist !== false, !!opts.allowReference, opts.addressKey ?? null],
    queryFn: () =>
      invokeQuote<CartQuote>({
        items: JSON.parse(debouncedKey),
        persist: opts.persist !== false,
        allow_reference: !!opts.allowReference,
      }),
    enabled: opts.enabled && debouncedKey !== "[]",
    staleTime: 60_000,
    retry: 1,
  });
}

export interface PreviewLine {
  key: string;
  copies: number;
  weight_grams: number;
  wsp?: number;
  width_mm?: number | null;
  height_mm?: number | null;
}

export interface PreviewResult {
  key: string;
  copies: number;
  shipping_usd: number | null;
  amount_local: number | null;
  currency_local: string | null;
  carrier: string | null;
  service: string | null;
  estimated_days: number | null;
  duties_paid: boolean;
}

export interface PreviewResponse {
  status: "ok" | "needs_origin" | "no_reference";
  origin_country?: string;
  destination?: { city: string; country: string; postal_code: string };
  results: PreviewResult[];
}

/**
 * Publisher-side live rates to a reference space ("us" = New York 10030, or
 * a domestic city). Pass origin to quote an address that is still being typed.
 */
export function useShippingPreview(opts: {
  lines: PreviewLine[];
  destination: "us" | "domestic";
  origin?: Partial<ShipAddress> | null;
  packaging?: PackagingPreset;
  enabled: boolean;
}) {
  const body = {
    mode: "preview",
    destination: opts.destination,
    lines: opts.lines,
    ...(opts.origin ? { origin: opts.origin } : {}),
    ...(opts.packaging ? { packaging: opts.packaging } : {}),
  };
  const key = JSON.stringify(body);
  const debouncedKey = useDebounce(key, 600);
  return useQuery({
    queryKey: ["shipping-preview", debouncedKey],
    queryFn: () => invokeQuote<PreviewResponse>(JSON.parse(debouncedKey)),
    enabled: opts.enabled && opts.lines.length > 0,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}
