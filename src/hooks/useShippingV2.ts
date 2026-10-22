import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * The shipping_v2 feature flag.
 *
 * Source of truth: shipping_config.shipping_v2_enabled (one row), which the
 * edge functions read too, so client and server always agree. For preview
 * deploys, VITE_SHIPPING_V2=true forces the UI on (the server still follows
 * the database flag, so checkout only charges shipping once the row is on).
 */
export function useShippingV2(): { enabled: boolean; isLoading: boolean } {
  const forced = import.meta.env.VITE_SHIPPING_V2 === "true";
  const query = useQuery({
    queryKey: ["shipping-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_config")
        .select("shipping_v2_enabled")
        .maybeSingle();
      if (error) return false;
      return !!data?.shipping_v2_enabled;
    },
    staleTime: 5 * 60_000,
    enabled: !forced,
  });
  return { enabled: forced || !!query.data, isLoading: !forced && query.isLoading };
}
