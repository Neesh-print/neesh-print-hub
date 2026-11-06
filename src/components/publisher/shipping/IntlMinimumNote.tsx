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
    ? `shipping one copy from ${name} to New York costs about ${money(one)} (five cost about ${money(five)}).`
    : `shipping one copy from ${name} to New York often costs 40 USD or more.`;

  // Says plainly that the minimum applies to spaces ordering from the
  // publisher, not to the publisher. A UK publisher read the old wording
  // ("orders ... start at 5 copies") as Neesh asking them to buy 5 issues.
  return (
    <div className={`p-4 rounded-lg bg-accent/5 border border-accent/30 text-sm text-foreground ${className}`}>
      Most Neesh spaces are in the US, and {costs} So when a space outside {home} orders your title, their order starts at 5 copies. This only sets the smallest order spaces can place with you. You can change it anytime.
    </div>
  );
};
