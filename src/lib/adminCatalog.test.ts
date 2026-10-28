import { describe, expect, it } from "vitest";
import { inCatalogView, needsAttention, problemsOf, statusOf, type CatalogTitle } from "./adminCatalog";

const title = (overrides: Partial<CatalogTitle> = {}): CatalogTitle => ({
  id: "m",
  title: "Geezer magazine",
  issue: "No. 1",
  coverUrl: "https://example.com/c.jpg",
  publisherId: "p",
  publisherName: "Geezer magazine",
  isActive: true,
  wholesalePrice: 28,
  retailPrice: 37,
  weightGrams: 400,
  inventory: 3000,
  publisherHandled: true,
  ...overrides,
});

describe("statusOf", () => {
  it("reads is_active as live, suspended (null) or archived", () => {
    expect(statusOf(true)).toBe("live");
    expect(statusOf(null)).toBe("suspended");
    expect(statusOf(false)).toBe("archived");
  });
});

describe("problemsOf", () => {
  it("finds nothing wrong with a complete title", () => {
    expect(problemsOf(title())).toEqual([]);
  });

  it("flags missing data and stock", () => {
    expect(problemsOf(title({ title: " ", wholesalePrice: null, weightGrams: null, coverUrl: null, inventory: 0 }))).toEqual([
      "no_title",
      "no_price",
      "no_weight",
      "no_cover",
      "out_of_stock",
    ]);
    expect(problemsOf(title({ inventory: 8 }))).toEqual(["low_stock"]);
  });

  it("doesn't count stock Neesh holds", () => {
    expect(problemsOf(title({ inventory: 0, publisherHandled: false }))).toEqual([]);
  });
});

describe("needsAttention", () => {
  it("is a live title that can't sell or ship properly", () => {
    expect(needsAttention(title({ title: "" }))).toBe(true);
    expect(needsAttention(title({ weightGrams: null }))).toBe(true);
    expect(needsAttention(title({ inventory: 5 }))).toBe(false);
    expect(needsAttention(title({ coverUrl: null }))).toBe(false);
    expect(needsAttention(title({ title: "", isActive: false }))).toBe(false);
  });
});

describe("inCatalogView", () => {
  it("filters by status and stock", () => {
    expect(inCatalogView(title({ isActive: null }), "suspended")).toBe(true);
    expect(inCatalogView(title({ inventory: 4 }), "low_stock")).toBe(true);
    expect(inCatalogView(title({ inventory: 4, isActive: false }), "low_stock")).toBe(false);
  });
});
