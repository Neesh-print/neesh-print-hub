import { describe, expect, it } from "vitest";
import {
  acceptedContacts,
  emptyReview,
  exportContacts,
  mergeNewRows,
  parsePilot,
  safeUrl,
  suppressed,
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
