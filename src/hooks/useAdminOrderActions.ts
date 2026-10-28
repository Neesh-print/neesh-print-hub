import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type ReleaseResult = { id: string; success: boolean; error?: string };

/** Actions the admin v2 screens take on orders and payouts. Each refreshes the overview. */
export function useAdminOrderActions() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-overview"] });

  /** Release publisher payouts through release-publisher-transfer. */
  const releasePayouts = async (transferIds: string[], key = "release") => {
    if (transferIds.length === 0) return;
    setBusy(key);
    try {
      const { data, error } = await supabase.functions.invoke("release-publisher-transfer", {
        body: { transferIds },
      });
      if (error) throw error;
      const results = (data?.results ?? []) as ReleaseResult[];
      const failed = results.filter((r) => !r.success);
      if (failed.length === 0) {
        toast.success(`${results.length} payout${results.length === 1 ? "" : "s"} released`);
      } else {
        toast.error(`${results.length - failed.length} released, ${failed.length} failed: ${failed[0].error ?? "unknown error"}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't release payouts");
    } finally {
      setBusy(null);
      refresh();
    }
  };

  /** Move an order to a stored status (processing = Packed). */
  const setOrderStatus = async (orderId: string, status: "processing" | "shipped" | "delivered", key = orderId) => {
    setBusy(key);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", orderId);
      if (error) throw error;
      toast.success(status === "processing" ? "Marked packed" : `Marked ${status}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the order");
    } finally {
      setBusy(null);
      refresh();
    }
  };

  return { releasePayouts, setOrderStatus, busy, refresh };
}
