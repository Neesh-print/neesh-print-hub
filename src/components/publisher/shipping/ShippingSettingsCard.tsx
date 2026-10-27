import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ButtonPrimary, FormInput, FormSelect } from "@/components/neesh";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ShipsFromFields } from "./ShipsFromFields";
import {
  usePublisherShipping,
  useSavePublisherShipping,
  type PublisherShippingSettings,
} from "@/hooks/usePublisherShipping";
import { useShippingPreview } from "@/hooks/useShippingQuote";
import { useMagazines } from "@/hooks/useMagazines";
import {
  LABEL_VERIFIED_COUNTRIES,
  PACKAGING_OPTIONS,
  REFERENCE_DOMESTIC_ADDRESSES,
  REFERENCE_US_ADDRESS,
  countryName,
  flatShipping,
  isEU,
  isQuotableAddress,
  zoneFor,
  type PackagingPreset,
} from "@/lib/shipping";
import { money } from "@/lib/shippingCopy";

const DEFAULT_WEIGHT = 350;

const toNum = (v: string): number | null => (v.trim() === "" ? null : Number(v));

interface ShippingSettingsCardProps {
  publisherId: string;
  /** shipping_v2 flag is off: spaces don't pay shipping yet. */
  prelaunch?: boolean;
}

/** Settings > Shipping (T4, T18). */
export const ShippingSettingsCard = ({ publisherId, prelaunch = false }: ShippingSettingsCardProps) => {
  const { data, isLoading } = usePublisherShipping(publisherId);
  const save = useSavePublisherShipping(publisherId);
  const { magazines } = useMagazines({ publisherId, status: "active", enabled: !!publisherId });
  const [form, setForm] = useState<PublisherShippingSettings | null>(null);
  const [flat, setFlat] = useState({ df: "", da: "", inf: "", ia: "" });
  const [intlMin, setIntlMin] = useState("5");

  useEffect(() => {
    if (!data) return;
    setForm(data);
    const s = (n: number | null) => (n === null ? "" : String(n));
    setFlat({
      df: s(data.domestic_first_copy_usd),
      da: s(data.domestic_additional_copy_usd),
      inf: s(data.intl_first_copy_usd),
      ia: s(data.intl_additional_copy_usd),
    });
    setIntlMin(String(data.intl_min_copies));
  }, [data]);

  // Preview weight: the average of active titles with a weight, else 350 g.
  const weights = magazines.map((m) => m.weight_grams ?? 0).filter((w) => w > 0);
  const weight = weights.length ? Math.round(weights.reduce((a, b) => a + b, 0) / weights.length) : DEFAULT_WEIGHT;

  const address = form?.ships_from_address ?? {};
  const country = address.country || "";
  const quotable = isQuotableAddress({ ...address, name: address.name || "Publisher" });
  const isFlat = form?.shipping_rate_mode === "flat";
  const domestic = REFERENCE_DOMESTIC_ADDRESSES[country] ?? null;

  const lines = useMemo(
    () => [5, 10].map((q) => ({ key: `q${q}`, copies: q, weight_grams: weight })),
    [weight],
  );
  const originForPreview = quotable ? { ...address, name: address.name || "Publisher" } : null;
  const usPreview = useShippingPreview({
    lines,
    destination: "us",
    origin: originForPreview,
    packaging: form?.packaging_preset,
    enabled: !!form && !isFlat && quotable,
  });
  const domesticPreview = useShippingPreview({
    lines: lines.slice(0, 1),
    destination: "domestic",
    origin: originForPreview,
    packaging: form?.packaging_preset,
    enabled: !!form && !isFlat && quotable && !!domestic && country !== "US",
  });

  if (isLoading || !form) {
    return (
      <div className="card-neesh flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const set = (patch: Partial<PublisherShippingSettings>) => setForm({ ...form, ...patch });

  const flatFor = (destCountry: string, copies: number) => {
    const zone = zoneFor(country, destCountry);
    return flatShipping(
      zone === "domestic"
        ? { firstCopyUsd: toNum(flat.df), additionalCopyUsd: toNum(flat.da) }
        : { firstCopyUsd: toNum(flat.inf), additionalCopyUsd: toNum(flat.ia) },
      copies,
    );
  };
  const previewAmount = (which: "us" | "domestic", copies: number): string => {
    if (isFlat) {
      const v = flatFor(which === "us" ? REFERENCE_US_ADDRESS.country : country, copies);
      return v === null ? "Not set" : money(v);
    }
    if (!quotable) return "Add address";
    const q = which === "us" ? usPreview : domesticPreview;
    if (q.isLoading) return "...";
    const r = q.data?.results.find((x) => x.copies === copies);
    return r?.shipping_usd != null ? money(r.shipping_usd) : "No live rate";
  };

  const handleSave = async () => {
    const min = parseInt(intlMin, 10);
    if (!(min >= 1)) {
      toast.error("The international minimum must be at least 1 copy.");
      return;
    }
    const rates = [flat.df, flat.da, flat.inf, flat.ia].map(toNum);
    if (isFlat) {
      if (rates.some((r) => r !== null && (isNaN(r) || r < 0 || r > 100))) {
        toast.error("Flat rates must be between 0 and 100 USD.");
        return;
      }
      if (rates[0] === null || (form.ships_internationally && rates[2] === null)) {
        toast.error("Add a first-copy rate for each zone you ship to.");
        return;
      }
    }
    try {
      await save.mutateAsync({
        ...form,
        intl_min_copies: min,
        domestic_first_copy_usd: rates[0],
        domestic_additional_copy_usd: rates[1],
        intl_first_copy_usd: rates[2],
        intl_additional_copy_usd: rates[3],
      });
      toast.success("Shipping settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save shipping settings");
    }
  };

  const outsideLabel = isEU(country) ? "Ship outside the EU" : "Ship internationally";
  const labelVerified = LABEL_VERIFIED_COUNTRIES.includes(country);
  const noLiveRate = !isFlat && quotable && usPreview.data?.results.every((r) => r.shipping_usd === null);

  return (
    <div className="card-neesh">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-lg text-foreground">Shipping</h3>
        <ButtonPrimary onClick={handleSave} disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </ButtonPrimary>
      </div>

      {prelaunch && (
        <p className="text-sm text-muted-foreground mb-4">
          Spaces will soon pay shipping at checkout, quoted from this address. Add it now so spaces can keep ordering your titles.
        </p>
      )}

      <p className="text-caption uppercase tracking-wide text-muted-foreground mb-3">Ships From</p>
      <ShipsFromFields value={address} onChange={(a) => set({ ships_from_address: a })} />

      <p className="text-caption uppercase tracking-wide text-muted-foreground mt-6 mb-3">Rates</p>
      <div className="space-y-2">
        {([
          ["live", "Live carrier rates", "Quoted to each space's address."],
          ["flat", "My own flat rates", "First copy plus each extra, by zone."],
        ] as const).map(([value, title, help]) => (
          <label key={value} className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-secondary transition-colors">
            <input
              type="radio"
              name="shipping_rate_mode"
              value={value}
              checked={form.shipping_rate_mode === value}
              onChange={() => set({ shipping_rate_mode: value })}
              className="mt-1 w-4 h-4"
            />
            <span>
              <span className="font-medium block text-foreground">{title}</span>
              <span className="text-caption text-muted-foreground">{help}</span>
            </span>
          </label>
        ))}
      </div>
      {noLiveRate && (
        <p className="text-caption text-status-pending-text mt-2">
          No live carrier rate from {countryName(country)} right now. Use your own flat rates so spaces can check out.
        </p>
      )}

      {isFlat && (
        <div className="grid grid-cols-2 gap-3 mt-4">
          <FormInput label="Domestic, first copy (USD)" type="number" min={0} max={100} step="0.5" value={flat.df} onChange={(v) => setFlat({ ...flat, df: v })} />
          <FormInput label="Domestic, each extra" type="number" min={0} max={100} step="0.5" value={flat.da} onChange={(v) => setFlat({ ...flat, da: v })} />
          <FormInput label="International, first copy" type="number" min={0} max={100} step="0.5" value={flat.inf} onChange={(v) => setFlat({ ...flat, inf: v })} />
          <FormInput label="International, each extra" type="number" min={0} max={100} step="0.5" value={flat.ia} onChange={(v) => setFlat({ ...flat, ia: v })} />
        </div>
      )}

      <div className="flex items-center justify-between py-2 mt-4">
        <Label htmlFor="ships_internationally" className="cursor-pointer font-medium">{outsideLabel}</Label>
        <Switch
          id="ships_internationally"
          checked={form.ships_internationally}
          onCheckedChange={(v) => set({ ships_internationally: v })}
        />
      </div>

      <FormInput
        label="International minimum (copies)"
        type="number"
        min={1}
        value={intlMin}
        onChange={setIntlMin}
        helperText="Applies on top of each title's own minimum."
        className="mt-2"
      />

      <div className="flex items-start justify-between py-2 mt-4 gap-4">
        <div>
          <Label htmlFor="uses_neesh_labels" className="cursor-pointer font-medium">Buy labels through Neesh</Label>
          <p className="text-caption text-muted-foreground mt-0.5">
            Customs forms included. Neesh buys your postage and the cost comes out of the shipping the space paid. You print the label and drop off the parcel.
          </p>
          {!labelVerified && country && (
            <p className="text-caption text-status-pending-text mt-1">
              Labels are verified from the US, Canada, the UK and France. From {countryName(country)} they may not be available.
            </p>
          )}
        </div>
        <Switch
          id="uses_neesh_labels"
          checked={form.uses_neesh_labels}
          onCheckedChange={(v) => set({ uses_neesh_labels: v })}
        />
      </div>

      <FormSelect
        label="Packaging"
        className="mt-3"
        options={PACKAGING_OPTIONS}
        value={form.packaging_preset}
        onChange={(v) => set({ packaging_preset: v as PackagingPreset })}
      />

      <div className="mt-4 p-4 rounded-lg bg-secondary/50">
        <p className="text-caption uppercase tracking-wide text-muted-foreground mb-2">Preview</p>
        {domestic && country !== "US" && (
          <div className="flex justify-between py-1"><span>{domestic.city}, 5 copies</span><span>{previewAmount("domestic", 5)}</span></div>
        )}
        <div className="flex justify-between py-1"><span>New York, 5 copies</span><span>{previewAmount("us", 5)}</span></div>
        <div className="flex justify-between py-1"><span>New York, 10 copies</span><span>{previewAmount("us", 10)}</span></div>
        <p className="text-caption text-muted-foreground mt-1">For a {weight} g title. Spaces pay this shipping; it passes to you in full.</p>
      </div>
    </div>
  );
};
