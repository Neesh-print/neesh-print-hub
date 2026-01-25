import { getCountryName, getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";

interface CountryDisplayProps {
  countryCode: string | null | undefined;
  showFlag?: boolean;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Displays a country with optional flag emoji and label.
 * Returns null if countryCode is null/undefined (no placeholder shown).
 */
export function CountryDisplay({
  countryCode,
  showFlag = false,
  showLabel = false,
  size = 'md',
  className,
}: CountryDisplayProps) {
  if (!countryCode) return null;

  const countryName = getCountryName(countryCode);
  const flag = showFlag ? getCountryFlag(countryCode) : null;
  
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
  };

  // Build aria-label for accessibility
  const ariaLabel = countryName 
    ? `Origin country: ${countryName}` 
    : `Origin country code: ${countryCode}`;

  return (
    <span 
      className={cn(sizeClasses[size], "text-foreground", className)}
      aria-label={ariaLabel}
    >
      {showLabel && (
        <span className="text-muted-foreground">Origin: </span>
      )}
      {flag && (
        <span aria-hidden="true" className="mr-1.5">{flag}</span>
      )}
      <span>{countryName || countryCode}</span>
    </span>
  );
}
