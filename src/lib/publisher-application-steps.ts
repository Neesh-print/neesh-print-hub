// Claiming and selling are separate. Everyone answers the page questions,
// then "Do you want to sell on Neesh?". Only a yes adds the selling steps; a
// "not right now" goes straight to a short claim confirmation.
export type StepKey =
  | "contact"
  | "title"
  | "business"
  | "cover"
  | "description"
  | "online"
  | "sell"
  | "shipping"
  | "details"
  | "pricing"
  | "fulfillment"
  | "additional"
  | "confirm"
  | "claimConfirm";

export const SELL_STEPS: StepKey[] = ["shipping", "details", "pricing", "fulfillment", "additional", "confirm"];

// Fields only the selling steps collect. Dropped from a claim-only submission.
export const SELL_FIELDS = [
  "shippingCountry", "shipFromLine1", "shipFromLine2", "shippingCity", "shippingState",
  "shipFromPostalCode", "shipFromPhone", "issueFrequency", "publicationType",
  "regionsCurrentlySold", "wholesalePrice", "suggestedRetailPrice", "availableQuantity",
  "weightGrams", "fulfillmentMethod", "cloudLink", "acceptTerms",
] as const;

// A claim from the Index already knows the title, so it skips that step.
// Before the selling question is answered the count assumes the shorter claim
// path, so nobody is told up front they're in a 13-step selling form.
export const buildPublisherSteps = (opts: { skipTitle: boolean; wantsToSell: boolean | null }): StepKey[] => [
  "contact",
  ...(opts.skipTitle ? [] : (["title"] as StepKey[])),
  "business",
  "cover",
  "description",
  "online",
  "sell",
  ...(opts.wantsToSell === true ? SELL_STEPS : (["claimConfirm"] as StepKey[])),
];
