// Translate Stripe Connect requirement field names (e.g. "individual.id_number")
// into plain labels a publisher can act on. Stripe's raw keys are jargon; the
// dashboard banner should never show them directly.
//
// Fields are grouped into families so that, say, the three date-of-birth keys
// collapse into one "Your date of birth" line rather than three.

import type { StripeRequirementsDue } from "@/hooks/usePublisherProfile";

interface RequirementRule {
  // Matches the requirement key by exact value or prefix.
  match: (key: string) => boolean;
  label: string;
}

// Order matters: the first matching rule wins.
const RULES: RequirementRule[] = [
  { match: (k) => k === "external_account" || k.startsWith("external_account"), label: "Your bank account details" },
  { match: (k) => k.includes("dob"), label: "Your date of birth" },
  { match: (k) => k.endsWith("id_number") || k.endsWith("ssn_last_4"), label: "Your Social Security number or tax ID" },
  { match: (k) => k.includes("verification.additional_document"), label: "An additional identity document" },
  { match: (k) => k.includes("verification.document"), label: "A photo of your ID" },
  { match: (k) => k.startsWith("company.tax_id") || k.endsWith("tax_id"), label: "Your business tax ID (EIN)" },
  { match: (k) => k.includes("address"), label: "Your address" },
  { match: (k) => k.endsWith("first_name") || k.endsWith("last_name") || k === "company.name" || k.endsWith("name"), label: "Your name" },
  { match: (k) => k.endsWith("phone"), label: "A phone number" },
  { match: (k) => k.endsWith("email"), label: "An email address" },
  { match: (k) => k.startsWith("business_profile.url") || k.endsWith("url"), label: "Your business website" },
  { match: (k) => k.includes("product_description") || k.includes("mcc"), label: "A short description of what you sell" },
  { match: (k) => k.startsWith("tos_acceptance"), label: "Agreement to Stripe's terms of service" },
  { match: (k) => k.startsWith("relationship") || k.includes("owners") || k.includes("directors"), label: "Details about the business owners" },
];

// Fallback: turn "individual.some_field" into "Some field".
function humanizeKey(key: string): string {
  const tail = key.split(".").pop() ?? key;
  const words = tail.replace(/_/g, " ").trim();
  if (!words) return "Additional information";
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Given the persisted requirements object, return a de-duplicated list of plain
 * labels describing what the publisher still needs to provide. Past-due items
 * come first. Returns an empty array when nothing is outstanding.
 */
export function humanizeRequirements(requirements: StripeRequirementsDue | null | undefined): string[] {
  if (!requirements) return [];

  // Past-due first, then currently-due, skipping anything already listed.
  const orderedKeys = [
    ...(requirements.past_due ?? []),
    ...(requirements.currently_due ?? []),
  ];

  const labels: string[] = [];
  const seen = new Set<string>();

  for (const key of orderedKeys) {
    const rule = RULES.find((r) => r.match(key));
    const label = rule ? rule.label : humanizeKey(key);
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }

  return labels;
}
