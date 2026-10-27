import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  isLabelReadyAddress,
  normalizeCountry,
  type FlatRatesByRegion,
  type PackagingPreset,
  type ShipAddress,
} from "@/lib/shipping";

export interface PublisherShippingSettings {
  ships_from_address: Partial<ShipAddress>;
  ships_from_country: string | null;
  shipping_rate_mode: "live" | "flat";
  flat_rates: FlatRatesByRegion;
  ships_internationally: boolean;
  uses_neesh_labels: boolean;
  packaging_preset: PackagingPreset;
  intl_min_copies: number;
  shipping_rates_set_at: string | null;
}

/** A publisher's shipping settings: public fields on publishers plus the private ships-from address. */
export function usePublisherShipping(publisherId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["publisher-shipping", publisherId],
    queryFn: async (): Promise<PublisherShippingSettings> => {
      const [{ data: pub, error }, { data: priv }] = await Promise.all([
        supabase
          .from("publishers")
          .select("company_name, ships_from_country, shipping_rate_mode, flat_rates, ships_internationally, uses_neesh_labels, packaging_preset, intl_min_copies, shipping_rates_set_at")
          .eq("id", publisherId!)
          .single(),
        supabase
          .from("publisher_shipping_settings")
          .select("ships_from_address")
          .eq("publisher_id", publisherId!)
          .maybeSingle(),
      ]);
      if (error) throw error;
      const address = ((priv?.ships_from_address ?? {}) as Partial<ShipAddress>) || {};
      return {
        ships_from_address: {
          name: address.name || pub.company_name || "",
          ...address,
          country: normalizeCountry(address.country ?? pub.ships_from_country ?? null) ?? "",
        },
        ships_from_country: pub.ships_from_country,
        shipping_rate_mode: (pub.shipping_rate_mode as "live" | "flat") ?? "live",
        flat_rates: (pub.flat_rates ?? {}) as FlatRatesByRegion,
        ships_internationally: pub.ships_internationally ?? true,
        uses_neesh_labels: !!pub.uses_neesh_labels,
        packaging_preset: (pub.packaging_preset as PackagingPreset) ?? "auto",
        intl_min_copies: pub.intl_min_copies ?? 5,
        shipping_rates_set_at: pub.shipping_rates_set_at,
      };
    },
    enabled: enabled && !!publisherId,
  });
}

/** Problems that stop a publisher turning on Neesh labels (T4). Empty when OK. */
export async function labelReadinessProblems(publisherId: string, address: Partial<ShipAddress>): Promise<string[]> {
  const problems: string[] = [];
  if (!isLabelReadyAddress(address)) problems.push("Add your full ships-from address and a phone number.");
  const { data: titles } = await supabase
    .from("magazines")
    .select("title, weight_grams")
    .eq("publisher_id", publisherId)
    .eq("is_active", true);
  const missing = (titles ?? []).filter((t) => !t.weight_grams || Number(t.weight_grams) <= 0).map((t) => t.title);
  if (missing.length) problems.push(`Add a weight to ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ` and ${missing.length - 3} more` : ""}.`);
  return problems;
}

export function useSavePublisherShipping(publisherId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (s: Partial<PublisherShippingSettings>) => {
      if (!publisherId) throw new Error("No publisher");
      if (s.uses_neesh_labels && s.ships_from_address) {
        const problems = await labelReadinessProblems(publisherId, s.ships_from_address);
        if (problems.length) throw new Error(problems.join(" "));
      }
      const country = s.ships_from_address ? normalizeCountry(s.ships_from_address.country ?? null) : undefined;
      const update: Record<string, unknown> = {};
      for (const k of [
        "shipping_rate_mode", "flat_rates", "ships_internationally", "uses_neesh_labels", "packaging_preset", "intl_min_copies",
      ] as const) {
        if (s[k] !== undefined) update[k] = s[k];
      }
      if (country) update.ships_from_country = country;
      if (s.shipping_rate_mode === "flat") update.shipping_rates_set_at = new Date().toISOString();
      if (Object.keys(update).length) {
        const { error } = await supabase.from("publishers").update(update).eq("id", publisherId);
        if (error) throw error;
      }
      if (s.ships_from_address) {
        const { error } = await supabase
          .from("publisher_shipping_settings")
          .upsert({ publisher_id: publisherId, ships_from_address: { ...s.ships_from_address, country } });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["publisher-shipping", publisherId] });
      queryClient.invalidateQueries({ queryKey: ["shipping-preview"] });
    },
  });
}
