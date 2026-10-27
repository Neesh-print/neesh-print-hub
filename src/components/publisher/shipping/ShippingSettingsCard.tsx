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
  FLAT_REGIONS,
  LABEL_VERIFIED_COUNTRIES,
  PACKAGING_OPTIONS,
  REFERENCE_DOMESTIC_ADDRESSES,
  REFERENCE_US_ADDRESS,
  countryName,
  flatRatesFor,
  flatShipping,
  isEU,
  isQuotableAddress,
  originRegion,
  regionFor,
  type FlatRatesByRegion,
  type PackagingPreset,
  type Region,
} from "@/lib/shipping";
import { money } from "@/lib/shippingCopy";

const DEFAULT_WEIGHT = 350;

const toNum = (v: string): number | null => (v.trim() === "" ? null : Number(v));

type FlatInputs = Record<Region, { first: string; extra: string }>;

const toInputs = (rates: FlatRatesByRegion): FlatInputs => {
  const s = (n: number | null | undefined) => (n == null ? "" : String(n));
  return Object.fromEntries(
    FLAT_REGIONS.map(({ key }) => [key, { first: s(rates[key]?.first), extra: s(rates[key]?.additional) }]),
  ) as FlatInputs;
};

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
  const [flat, setFlat] = useState<FlatInputs>(() => toInputs({}));
  const [intlMin, setIntlMin] = useState("5");

  useEffect(() => {
    if (!data) return;
    setForm(data);
    setFlat(toInputs(data.flat_rates));
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

  // The publisher's own country is always Domestic, so its region is hidden.
  const hiddenRegion = originRegion(country);
  const regions = FLAT_REGIONS.filter((r) => r.key !== hiddenRegion);
  const regionLabel = (key: Region, label: string) => {
    if (key !== "domestic" || !country) return label;
    return `Domestic (${isEU(country) ? "EU" : countryName(country)})`;
  };
  const setRate = (key: Region, patch: Partial<FlatInputs[Region]>) =>
    setFlat({ ...flat, [key]: { ...flat[key], ...patch } });

  const flatRates = (): FlatRatesByRegion => {
    const out: FlatRatesByRegion = {};
    for (const { key } of regions) {
      const first = toNum(flat[key].first);
      if (first === null) continue;
      out[key] = { first, additional: toNum(flat[key].extra) };
    }
    return out;
  };

  const flatFor = (destCountry: string, copies: number) =>
    flatShipping(flatRatesFor(flatRates(), regionFor(country, destCountry)), copies);
  const previewAmount = (which: "us" | "domestic", copies: number): string => {
    if (isFlat) {
      const dest = which === "us" ? REFERENCE_US_ADDRESS.country : country;
      if (!form.ships_internationally && regionFor(country, dest) !== "domestic") return "Not shipped";
      const v = flatFor(dest, copies);
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
    if (isFlat) {
      const values = regions.flatMap(({ key }) => [flat[key].first, flat[key].extra]).map(toNum);
      if (values.some((r) => r !== null && (isNaN(r) || r < 0 || r > 100))) {
        toast.error("Flat rates must be between 0 and 100 USD.");
        return;
      }
      const extraOnly = regions.find(({ key }) => toNum(flat[key].first) === null && toNum(flat[key].extra) !== null);
      if (extraOnly) {
        toast.error(`Add a first-copy rate for ${regionLabel(extraOnly.key, extraOnly.label)}, or clear it.`);
        return;
      }
      if (toNum(flat.domestic.first) === null) {
        toast.error("Add a first-copy rate for Domestic.");
        return;
      }
    }
    try {
      await save.mutateAsync({
        ...form,
        intl_min_copies: min,
        // Live-mode publishers keep whatever flat rates they had saved.
        ...(isFlat ? { flat_rates: flatRates() } : {}),
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
          ["flat", "My own flat rates", "First copy plus each extra, by region."],
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
        <div className="mt-4">
          <div className="grid grid-cols-[1fr_7rem_7rem] gap-3 text-caption text-muted-foreground pb-2">
            <span>Region</span>
            <span>First copy (USD)</span>
            <span>Each extra (USD)</span>
          </div>
          {regions.map(({ key, label }) => {
            const off = key !== "domestic" && !form.ships_internationally;
            return (
              <div key={key} className={`grid grid-cols-[1fr_7rem_7rem] gap-3 items-center py-1 ${off ? "opacity-50" : ""}`}>
                <span className="text-sm text-foreground">{regionLabel(key, label)}</span>
                <FormInput aria-label={`${regionLabel(key, label)}, first copy`} type="number" min={0} max={100} step="0.5" disabled={off} value={flat[key].first} onChange={(v) => setRate(key, { first: v })} />
                <FormInput aria-label={`${regionLabel(key, label)}, each extra`} type="number" min={0} max={100} step="0.5" disabled={off} value={flat[key].extra} onChange={(v) => setRate(key, { extra: v })} />
              </div>
            );
          })}
          <p className="text-caption text-muted-foreground mt-2">Leave a region blank and spaces there can't order from you.</p>
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
