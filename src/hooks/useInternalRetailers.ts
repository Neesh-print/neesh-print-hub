import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * User IDs of internal buying accounts (retailers.is_internal, e.g. NWM
 * Collections). orders.retailer_id holds the buyer's user ID, so this set can
 * be matched against it directly. Internal orders are real: they still go
 * through fulfillment and payouts; only reporting can choose to leave them out.
 */
export const useInternalRetailers = () => {
  const [internalUserIds, setInternalUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchInternal = async () => {
      // is_internal comes from the 20261027170000 migration; until it is
      // applied the filter errors and nothing counts as internal.
      const { data, error } = await supabase
        .from('retailers')
        .select('user_id')
        .eq('is_internal' as never, true as never);
      if (error) return;
      setInternalUserIds(new Set(((data || []) as { user_id: string }[]).map((r) => r.user_id)));
    };
    fetchInternal();
  }, []);

  return internalUserIds;
};
