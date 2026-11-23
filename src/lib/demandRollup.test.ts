import { describe, expect, it } from "vitest";
import { areaFor, buildRollup, type RollupInput } from "../../supabase/functions/_shared/demand-rollup";

const now = new Date("2026-11-30T14:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
const zero = { signals: 0, publishersContacted: 0, claims: 0, nowSelling: 0, stockistsAdded: 0, requestersNotified: 0 };
const empty: RollupInput = {
  now,
  suggestionsToReview: [],
  draftsWaiting: [],
  needsContact: [],
  requests: [],
  suggestions: [],
  conversion: zero,
};

describe("areaFor", () => {
  it("uses NYC boroughs, then the space's city, then a ZIP prefix", () => {
    expect(areaFor("11211")).toBe("Brooklyn");
    expect(areaFor("10022")).toBe("Manhattan");
    expect(areaFor("11375")).toBe("Queens");
    expect(areaFor("87501", "Santa Fe")).toBe("Santa Fe");
    expect(areaFor("87501")).toBe("ZIP 875xx");
    expect(areaFor(null)).toBe("Unknown");
  });
});

describe("buildRollup", () => {
  it("is empty when sections 1 to 4 have nothing", () => {
    const r = buildRollup(empty);
    expect(r.empty).toBe(true);
  });

  it("counts a week with only old requests as empty", () => {
    const r = buildRollup({
      ...empty,
      requests: [{ title_id: "t", title_name: "Old", title_state: "unclaimed", role: "reader", postcode: "11211", created_at: daysAgo(45) }],
    });
    expect(r.empty).toBe(true);
  });

  it("ranks titles and areas and writes shareable lines", () => {
    const req = (title: string, role: string, postcode: string, d: number) => ({
      title_id: title,
      title_name: title,
      title_state: "unclaimed",
      role,
      postcode,
      created_at: daysAgo(d),
    });
    const r = buildRollup({
      ...empty,
      requests: [
        req("Slanted", "reader", "11211", 2),
        req("Slanted", "reader", "11222", 10),
        req("Slanted", "space", "11201", 20),
        req("Anchoa", "space", "87501", 3),
      ],
      suggestions: [{ city: "Brussels", created_at: daysAgo(5) }],
      conversion: { ...zero, signals: 5, stockistsAdded: 2 },
    });
    expect(r.empty).toBe(false);
    expect(r.text).toContain("- Slanted: 2 readers, 1 space in 30 days (1 this week), Not claimed");
    expect(r.text).toContain("- Brooklyn: 3");
    expect(r.text).toContain("- Brussels: 1");
    expect(r.text).toContain("- ZIP 875xx: 1");
    expect(r.shareable).toContain("Slanted was the most requested magazine on the Neesh Index this month.");
    expect(r.shareable).toContain("Most requested in Brooklyn this month: Slanted.");
    expect(r.shareable).toContain("4 readers and spaces asked Neesh where to find a magazine this month.");
  });

  it("never shows postcodes or emails, and has no em dashes", () => {
    const r = buildRollup({
      ...empty,
      suggestionsToReview: [{ shop: "Paradis Superstore", city: "Brussels", title: "MacGuffin", confidence: "confirmed" }],
      draftsWaiting: [{ template: "E", title: "Dirty Magazine", recipient_type: "reader" }],
      needsContact: ["The Metrograph"],
      requests: [
        { title_id: "t", title_name: "Anchoa", title_state: "claimed", role: "space", postcode: "87501", created_at: daysAgo(1), space_city: "Santa Fe" },
      ],
    });
    for (const out of [r.html, r.text, r.subject]) {
      expect(out).not.toContain("87501");
      expect(out).not.toMatch(/[\w.+-]+@(?!neesh\.art)[\w-]+\.[a-z]{2,}/i);
      expect(out).not.toMatch(/—/);
    }
    expect(r.subject).toBe("Demand rollup: 3 things waiting on you");
    expect(r.text).toContain("- Santa Fe: 1");
    expect(r.html).toContain("1 to review, 1 confirmed");
  });

  it("skips shareable lines for single requests", () => {
    const r = buildRollup({
      ...empty,
      requests: [{ title_id: "t", title_name: "Solo", title_state: "unclaimed", role: "reader", postcode: "11211", created_at: daysAgo(1) }],
    });
    expect(r.shareable).toEqual([]);
  });
});
