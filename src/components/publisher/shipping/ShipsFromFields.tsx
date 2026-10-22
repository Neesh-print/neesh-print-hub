import { FormInput, FormSelect } from "@/components/neesh";
import { COUNTRY_LIST } from "@/lib/countries";
import type { ShipAddress } from "@/lib/shipping";

const COUNTRY_OPTIONS = [...COUNTRY_LIST]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((c) => ({ value: c.code, label: c.name }));

const needsState = (country: string | undefined) => country === "US" || country === "CA";

interface ShipsFromFieldsProps {
  value: Partial<ShipAddress>;
  onChange: (next: Partial<ShipAddress>) => void;
  /** Mark street, city, postal code and country as required. */
  required?: boolean;
  /** Show the phone field (needed for labels and customs). */
  showPhone?: boolean;
}

/** Ships-from address inputs, shared by Settings and the onboarding Shipping step. */
export const ShipsFromFields = ({ value, onChange, required = false, showPhone = true }: ShipsFromFieldsProps) => {
  const set = (field: keyof ShipAddress) => (v: string) => onChange({ ...value, [field]: v });
  return (
    <div className="space-y-4">
      <FormInput label="Street Address" required={required} value={value.line1 ?? ""} onChange={set("line1")} autoComplete="address-line1" />
      <FormInput label="Apt / Suite (optional)" value={value.line2 ?? ""} onChange={set("line2")} autoComplete="address-line2" />
      <div className="grid grid-cols-2 gap-3">
        <FormInput label="City" required={required} value={value.city ?? ""} onChange={set("city")} autoComplete="address-level2" />
        <FormInput label="Postal Code" required={required} value={value.postal_code ?? ""} onChange={set("postal_code")} autoComplete="postal-code" />
      </div>
      <div className={needsState(value.country) ? "grid grid-cols-2 gap-3" : ""}>
        <FormSelect
          label="Country"
          required={required}
          placeholder="Select a country"
          options={COUNTRY_OPTIONS}
          value={value.country ?? ""}
          onChange={set("country")}
        />
        {needsState(value.country) && (
          <FormInput label={value.country === "CA" ? "Province" : "State"} required={required} value={value.state ?? ""} onChange={set("state")} placeholder={value.country === "CA" ? "ON" : "NY"} />
        )}
      </div>
      {showPhone && (
        <FormInput
          label="Phone"
          value={value.phone ?? ""}
          onChange={set("phone")}
          type="tel"
          helperText="Carriers need it for labels and customs."
        />
      )}
    </div>
  );
};
