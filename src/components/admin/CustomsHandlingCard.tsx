import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ButtonPrimary, FormInput } from "@/components/neesh";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CustomsConfig {
  customs_handling_enabled: boolean;
  customs_fee_postal_usd: number;
  customs_fee_courier_usd: number;
}

const toFee = (v: string): number | null => {
  if (v.trim() === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};

/**
 * Admin > Settings: US customs handling (shipping_config). Spaces pay these
 * per US-bound parcel from abroad, as their own line at checkout. Postal goes
 * back to the publisher in their shipping payout; courier stays with Neesh to
 * cover the courier's bill.
 */
export const CustomsHandlingCard = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["shipping-config-customs"],
    queryFn: async (): Promise<CustomsConfig> => {
      const { data, error } = await supabase
        .from("shipping_config")
        .select("customs_handling_enabled, customs_fee_postal_usd, customs_fee_courier_usd")
        .single();
      if (error) throw error;
      return {
        customs_handling_enabled: !!data.customs_handling_enabled,
        customs_fee_postal_usd: Number(data.customs_fee_postal_usd ?? 0),
        customs_fee_courier_usd: Number(data.customs_fee_courier_usd ?? 0),
      };
    },
  });

  const [enabled, setEnabled] = useState(false);
  const [postal, setPostal] = useState("0");
  const [courier, setCourier] = useState("0");

  useEffect(() => {
    if (!data) return;
    setEnabled(data.customs_handling_enabled);
    setPostal(data.customs_fee_postal_usd.toFixed(2));
    setCourier(data.customs_fee_courier_usd.toFixed(2));
  }, [data]);

  const save = useMutation({
    mutationFn: async (next: CustomsConfig) => {
      const { error } = await supabase
        .from("shipping_config")
        .update({ ...next, updated_at: new Date().toISOString() })
        .eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-config-customs"] });
      toast({ title: "Customs handling saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    const postalFee = toFee(postal);
    const courierFee = toFee(courier);
    if (postalFee === null || courierFee === null) {
      toast({ title: "Fees must be 0 or more", variant: "destructive" });
      return;
    }
    save.mutate({
      customs_handling_enabled: enabled,
      customs_fee_postal_usd: postalFee,
      customs_fee_courier_usd: courierFee,
    });
  };

  if (isLoading) {
    return (
      <div className="card-neesh flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="card-neesh">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-lg text-foreground">US customs handling</h3>
        <ButtonPrimary onClick={handleSave} disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </ButtonPrimary>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        What a space pays per parcel shipped into the US from abroad, as its own line at checkout. Duty stays at $0
        under the informational-materials exemption; this covers the entry fees.
      </p>

      <div className="flex items-center justify-between py-2">
        <Label htmlFor="customs-enabled" className="cursor-pointer">
          Charge customs handling at checkout
        </Label>
        <Switch id="customs-enabled" checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 mt-2">
        <FormInput
          label="Postal or own postage (USD)"
          type="number"
          min={0}
          step="0.01"
          value={postal}
          onChange={setPostal}
          helperText="The publisher prepays Zonos. Paid back to them in their shipping payout."
        />
        <FormInput
          label="Courier, duties paid (USD)"
          type="number"
          min={0}
          step="0.01"
          value={courier}
          onChange={setCourier}
          helperText="UPS, FedEx or DHL Express clears customs. Kept by Neesh for the courier's bill."
        />
      </div>
    </div>
  );
};
