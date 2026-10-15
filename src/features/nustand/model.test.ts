import { describe, expect, it } from "vitest";
import {
  acceptedContacts,
  bestContact,
  orderedContacts,
  type Contact,
  emptyReview,
  exportContacts,
  mergeNewRows,
  needsWebsiteConfirm,
  noWebsiteFound,
  parsePilot,
  safeUrl,
  sharedWebsite,
  suppressed,
  webSearchUrl,
  type Row,
} from "./model";
export const fixture = (): Row => ({
  source: {
    id: "fixture-a",
    name: "Example Space",
    city: "New York",
    neighborhood: "Example neighborhood",
    website: "https://example.org",
    do_not_contact: false,
    original_record: {
      notes: "Keep original",
      status_history: [{ stage: "New" }],
    },
    contacts: [
      {
        id: "email-a",
        kind: "email",
        value: "hello@example.org",
        quality_status: "observed_on_website",
        review_reasons: ["multiple_business_or_location_candidates"],
        evidence: [
          {
            source_url: "https://example.org/contact",
            excerpt_or_signal: "Contact our New York space.",
          },
        ],
      },
    ],
    job: { status: "completed" },
    fit: {
      score: null,
      segment: "Presence",
      uncertainties: ["buyer_budget_unknown"],
    },
  },
  review: emptyReview(),
  version: 0,
});
describe("Nustand review boundaries", () => {
  it("loads corrected results without silently approving proposed contacts", () => {
    const row = fixture();
    row.source.contacts[0].is_primary = true;
    expect(
      acceptedContacts(
        parsePilot({ schema_version: "0.2.2", records: [row.source] })[0],
      ),
    ).toEqual([]);
  });
  it("rejects duplicate prospect and contact identities and unsupported versions", () => {
    const r = fixture().source;
    expect(() =>
      parsePilot({ schema_version: "0.2.2", records: [r, r] }),
    ).toThrow();
    expect(() =>
      parsePilot({ schema_version: "0.2.0", records: [r] }),
    ).toThrow();
    expect(() =>
      parsePilot({
        schema_version: "0.2.2",
        records: [{ ...r, contacts: [r.contacts[0], r.contacts[0]] }],
      }),
    ).toThrow();
  });
  it("preserves source suppression even when the review is cleared", () => {
    const r = fixture();
    r.source.original_record.do_not_contact = true;
    r.review.contacts["email-a"] = "accepted";
    expect(suppressed(r)).toBe(true);
    expect(acceptedContacts(r)).toEqual([]);
  });
  it("exports only qualified manually accepted contacts and protects spreadsheet cells", () => {
    const r = fixture();
    expect(exportContacts([r])).not.toContain("hello@example.org");
    r.review.contacts["email-a"] = "accepted";
    expect(exportContacts([r])).not.toContain("hello@example.org");
    r.review.stage = "Qualified";
    r.source.name = "=BAD()";
    expect(exportContacts([r])).toContain("'=BAD()");
    expect(exportContacts([r])).toContain("hello@example.org");
    r.review.do_not_contact = true;
    expect(exportContacts([r])).not.toContain("hello@example.org");
  });
  it("reimports cannot erase manual review or original notes", () => {
    const row = fixture();
    row.review.notes = "My review";
    const imported = fixture();
    imported.source.original_record.notes = "Changed";
    expect(mergeNewRows([row], [imported])).toEqual([row]);
  });
  it("never renders active script or credential-bearing source URLs", () => {
    expect(safeUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeUrl("https://user:secret@example.org")).toBeUndefined();
    expect(safeUrl("https://example.org/contact")).toBe(
      "https://example.org/contact",
    );
  });
});

describe("contact ordering", () => {
  const c = (value: string, kind: "email" | "phone" | "instagram", relevance?: number, is_primary = false) =>
    ({ id: value, value, kind, relevance, is_primary, quality_status: "observed_on_website", review_reasons: [], evidence: [] }) as Contact;
  it("orders by kind, primary, then relevance, unranked last", () => {
    const list = [c("dev@x.org", "email", 4), c("+1", "phone", 1), c("store@x.org", "email", 0), c("old@x.org", "email"), c("x", "instagram", 1)];
    expect(orderedContacts(list).map((x) => x.value)).toEqual(["store@x.org", "dev@x.org", "old@x.org", "x", "+1"]);
  });
  it("picks a primary over a better-ranked contact, and the best rank otherwise", () => {
    expect(bestContact([c("a@x.org", "email", 0), c("b@x.org", "email", 3, true)], "email")?.value).toBe("b@x.org");
    expect(bestContact([c("a@x.org", "email", 2), c("b@x.org", "email", 1)], "email")?.value).toBe("b@x.org");
    expect(bestContact([c("a@x.org", "email", 2)], "phone")).toBeUndefined();
  });
});

describe("website states and shared sites", () => {
  const withSource = (patch: Partial<Row["source"]> & Record<string, unknown>, id = "x") => {
    const row = fixture();
    return { ...row, source: { ...row.source, id, ...patch } } as Row;
  };
  it("flags websites to confirm only when a real site is pending review", () => {
    expect(needsWebsiteConfirm(withSource({ website_identity_review: true }))).toBe(true);
    expect(needsWebsiteConfirm(withSource({ website_identity_review: "true" }))).toBe(true);
    expect(needsWebsiteConfirm(withSource({ website_identity_review: false }))).toBe(false);
    expect(needsWebsiteConfirm(withSource({ website_identity_review: true, website: null }))).toBe(false);
  });
  it("detects research that ended without a website", () => {
    expect(noWebsiteFound(withSource({ website: null, job: { status: "needs_website" } }))).toBe(true);
    expect(noWebsiteFound(withSource({ job: { status: "needs_website" } }))).toBe(false);
  });
  it("groups spaces that share a website domain, ignoring www", () => {
    const a = withSource({ name: "Iconic Bowery", website: "https://www.iconic.example/" }, "a");
    const b = withSource({ name: "Iconic Mulberry", website: "http://iconic.example/" }, "b");
    const c = withSource({ name: "Other", website: "https://other.example" }, "c");
    const map = sharedWebsite([a, b, c]);
    expect(map.get("a")?.map((r) => r.source.name)).toEqual(["Iconic Mulberry"]);
    expect(map.has("c")).toBe(false);
  });
  it("builds a web search for a space", () => {
    expect(webSearchUrl(withSource({ name: "Superlunar", neighborhood: null }))).toBe(
      "https://www.google.com/search?q=Superlunar%20New%20York",
    );
  });
  it("exports a shared email once and notes where it went", () => {
    const qualified = (id: string, name: string) => {
      const row = withSource({ name }, id);
      return { ...row, review: { ...row.review, stage: "Qualified", contacts: { "email-a": "accepted" } } } as Row;
    };
    const lines = exportContacts([qualified("a", "Iconic Bowery"), qualified("b", "Iconic Bouwerie")]).split("\r\n");
    expect(lines[0]).toContain("Note");
    expect(lines[1]).toContain("hello@example.org");
    expect(lines[2]).not.toMatch(/,hello@example\.org,/);
    expect(lines[2]).toContain("is listed under Iconic Bowery");
  });
});
