import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ButtonPrimary, ButtonSecondary, DataTable, FormInput, type DataTableColumn } from "@/components/neesh";
import { ShipsFromFields } from "./ShipsFromFields";
import { usePublisherShipping, useSavePublisherShipping } from "@/hooks/usePublisherShipping";
import { useShippingPreview } from "@/hooks/useShippingQuote";
import { IntlMinimumNote } from "./IntlMinimumNote";
import { countryName, isEU, isQuotableAddress, type ShipAddress } from "@/lib/shipping";
import { money } from "@/lib/shippingCopy";

const QUANTITIES = [1, 5, 10, 20];

interface Row extends Record<string, unknown> {
  id: string;
  copies: number;
  shipping: string;
  perCopy: string;
}

/** Onboarding step "Where do you ship from?" (P1, T4, T18). */
export const StepShipping = ({
  publisherId,
  companyName,
  weightGrams,
  wholesalePrice,
  onNext,
  onBack,
}: {
  publisherId: string | undefined;
  companyName: string | null;
  weightGrams: number | null;
  wholesalePrice: number | null;
  onNext: () => void;
  onBack: () => void;
}) => {
  const { data: existing } = usePublisherShipping(publisherId);
  const save = useSavePublisherShipping(publisherId);
  const [address, setAddress] = useState<Partial<ShipAddress>>({});
  const [intlMin, setIntlMin] = useState("5");

  useEffect(() => {
    if (existing) {
      setAddress(existing.ships_from_address);
      setIntlMin(String(existing.intl_min_copies));
    }
  }, [existing]);

  const weight = weightGrams && weightGrams > 0 ? weightGrams : 350;
  const origin = { ...address, name: address.name || companyName || "Publisher" };
  const quotable = isQuotableAddress(origin);
  const preview = useShippingPreview({
    lines: QUANTITIES.map((q) => ({ key: `q${q}`, copies: q, weight_grams: weight, wsp: wholesalePrice ?? undefined })),
    destination: "us",
    origin,
    enabled: quotable,
  });
  const country = address.country || "";
  const rateFor = (q: number) => preview.data?.results.find((r) => r.copies === q)?.shipping_usd ?? null;

  const rows: Row[] = QUANTITIES.flatMap((q) => {
    const v = rateFor(q);
    return v === null ? [] : [{ id: String(q), copies: q, shipping: money(v), perCopy: money(v / q) }];
  });
  const columns: DataTableColumn<Row>[] = [
    { key: "copies", header: "Copies" },
    { key: "shipping", header: "Shipping", align: "right" },
    { key: "perCopy", header: "Per copy", align: "right" },
  ];

  const handleContinue = async () => {
    const min = parseInt(intlMin, 10);
    if (!(min >= 1)) {
      toast.error("The international minimum must be at least 1 copy.");
      return;
    }
    if (!publisherId) {
      onNext();
      return;
    }
    try {
      await save.mutateAsync({ ships_from_address: origin, intl_min_copies: min });
      onNext();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your shipping address");
    }
  };

  return (
    <div className="py-8">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="font-display font-bold text-display-sm text-foreground mb-2">Where do you ship from?</h1>
      <p className="text-body text-muted-foreground mb-8">Spaces see live shipping rates from here.</p>

      <ShipsFromFields value={address} onChange={setAddress} required />

      {quotable && (
        <div className="card-neesh mt-6 p-0 overflow-hidden">
          <div className="px-4 pt-4 pb-1 font-display font-semibold">Shipping to New York</div>
          {preview.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
              <Loader2 className="w-4 h-4 animate-spin" />Getting live rates...
            </div>
          ) : rows.length > 0 ? (
            <DataTable columns={columns} data={rows} />
          ) : (
            <p className="text-sm text-muted-foreground p-4">
              No live carrier rate from {countryName(country)} yet. You can set your own flat rates in Settings later.
            </p>
          )}
        </div>
      )}

      {country && country !== "US" && (
        <IntlMinimumNote country={country} oneCopyUsd={rateFor(1)} fiveCopiesUsd={rateFor(5)} className="mt-6" />
      )}

      <FormInput
        label="International minimum (copies)"
        type="number"
        min={1}
        value={intlMin}
        onChange={setIntlMin}
        className="mt-6"
        helperText={country
          ? isEU(country) ? "EU spaces can still order 1." : `Spaces in ${countryName(country)} can still order 1.`
          : undefined}
      />

      <div className="flex justify-between mt-8">
        <ButtonSecondary onClick={onBack}>Back</ButtonSecondary>
        <ButtonPrimary onClick={handleContinue} disabled={!quotable || save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Continue
          <ChevronRight className="w-4 h-4 ml-2" />
        </ButtonPrimary>
      </div>
    </div>
  );
};
