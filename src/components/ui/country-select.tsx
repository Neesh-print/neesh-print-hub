import { COUNTRY_LIST, getCountryFlag } from "@/lib/countries";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface CountrySelectProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * A dropdown selector for choosing a country.
 * Uses ISO 3166-1 alpha-2 codes and displays flag emojis.
 */
export function CountrySelect({
  value,
  onChange,
  placeholder = "Select country",
  allowClear = false,
  disabled = false,
  className,
}: CountrySelectProps) {
  const handleValueChange = (newValue: string) => {
    if (newValue === "__clear__") {
      onChange(null);
    } else {
      onChange(newValue);
    }
  };

  return (
    <Select
      value={value || undefined}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectTrigger className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder}>
          {value && (
            <span className="flex items-center gap-2">
              <span aria-hidden="true">{getCountryFlag(value)}</span>
              <span>{COUNTRY_LIST.find(c => c.code === value)?.name || value}</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allowClear && (
          <SelectItem value="__clear__" className="text-muted-foreground">
            All Countries
          </SelectItem>
        )}
        {COUNTRY_LIST.map((country) => (
          <SelectItem key={country.code} value={country.code}>
            <span className="flex items-center gap-2">
              <span aria-hidden="true">{getCountryFlag(country.code)}</span>
              <span>{country.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
