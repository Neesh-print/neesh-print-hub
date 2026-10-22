import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PublisherShippingPublic {
  id: string;
  ships_from_country: string | null;
  intl_min_copies: number;
  ships_internationally: boolean;
}

/**
 * Public-safe shipping fields for a publisher (country, international minimum).
 * Only queried when shipping_v2 is on, so the page keeps working before the
 * migration is applied.
 */
export function usePublisherShippingPublic(publisherId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["publisher-shipping-public", publisherId],
    queryFn: async (): Promise<PublisherShippingPublic | null> => {
      const { data, error } = await supabase
        .from("publishers")
        .select("id, ships_from_country, intl_min_copies, ships_internationally")
        .eq("id", publisherId!)
        .maybeSingle();
      if (error) throw error;
      return data as PublisherShippingPublic | null;
    },
    enabled: enabled && !!publisherId,
    staleTime: 5 * 60_000,
  });
}
