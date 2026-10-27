import { SIGNUP_ESTIMATES_TO_NY, countryName, isEU } from "@/lib/shipping";
import { money } from "@/lib/shippingCopy";

/**
 * T18 note for publishers outside the US, shown at sign-up and onboarding.
 * Uses live rates when the caller has them, else the Oct 22, 2026 Shippo
 * estimates; countries without one show "often 40 USD or more".
 */
export const IntlMinimumNote = ({
  country,
  oneCopyUsd = null,
  fiveCopiesUsd = null,
  className = "",
}: {
  country: string;
  oneCopyUsd?: number | null;
  fiveCopiesUsd?: number | null;
  className?: string;
}) => {
  if (!country || country === "US") return null;
  const estimate = SIGNUP_ESTIMATES_TO_NY[country];
  const one = oneCopyUsd ?? estimate?.one ?? null;
  const five = fiveCopiesUsd ?? estimate?.five ?? null;
  const name = countryName(country);
  const home = isEU(country) ? "the EU" : name;
  const costs = one !== null && five !== null
    ? `shipping one copy to New York costs about ${money(one)}; five cost about ${money(five)}.`
    : "shipping one copy to New York often costs 40 USD or more.";

  return (
    <div className={`p-4 rounded-lg bg-accent/5 border border-accent/30 text-sm text-foreground ${className}`}>
      Most Neesh spaces are in the US. From {name}, {costs} To keep it worth it for spaces, orders from outside {home} start at 5 copies. You can change this later.
    </div>
  );
};
