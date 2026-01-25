import { describe, it, expect } from "vitest";
import {
  CATEGORIES,
  LEGACY_CATEGORY_MAPPINGS,
  getCategories,
  getCategoryNames,
  getCategoryOptions,
  getCategoryName,
  getCategorySlug,
  isValidCategory,
  normalizeCategory,
  categoryNeedsReview,
  getSuggestedReplacement,
} from "./categories";

describe("CATEGORIES", () => {
  it("has expected number of categories", () => {
    expect(CATEGORIES.length).toBeGreaterThanOrEqual(14);
  });

  it("includes new design subcategories", () => {
    const names = CATEGORIES.map(c => c.name);
    expect(names).toContain("Graphic Design");
    expect(names).toContain("Interior Design");
    expect(names).toContain("Product Design");
    expect(names).toContain("Typography");
  });

  it("includes renamed Literary category", () => {
    const names = CATEGORIES.map(c => c.name);
    expect(names).toContain("Literary");
    expect(names).not.toContain("Literature");
  });

  it("includes Queer category", () => {
    const names = CATEGORIES.map(c => c.name);
    expect(names).toContain("Queer");
  });

  it("does not include deprecated categories", () => {
    const names = CATEGORIES.map(c => c.name);
    expect(names).not.toContain("Culture");
    expect(names).not.toContain("Arts & Culture");
    expect(names).not.toContain("Design");
    expect(names).not.toContain("Lifestyle");
  });
});

describe("LEGACY_CATEGORY_MAPPINGS", () => {
  it("maps Literature to Literary", () => {
    expect(LEGACY_CATEGORY_MAPPINGS["Literature"]).toBe("Literary");
    expect(LEGACY_CATEGORY_MAPPINGS["literature"]).toBe("Literary");
  });

  it("removes Culture categories", () => {
    expect(LEGACY_CATEGORY_MAPPINGS["Culture"]).toBeNull();
    expect(LEGACY_CATEGORY_MAPPINGS["Arts & Culture"]).toBeNull();
  });

  it("removes generic Design", () => {
    expect(LEGACY_CATEGORY_MAPPINGS["Design"]).toBeNull();
  });
});

describe("getCategories", () => {
  it("returns categories sorted by displayOrder", () => {
    const categories = getCategories();
    for (let i = 1; i < categories.length; i++) {
      expect(categories[i].displayOrder).toBeGreaterThanOrEqual(categories[i-1].displayOrder);
    }
  });
});

describe("getCategoryNames", () => {
  it("returns array of category names", () => {
    const names = getCategoryNames();
    expect(names).toContain("Art");
    expect(names).toContain("Fashion");
    expect(names).toContain("Graphic Design");
  });
});

describe("getCategoryOptions", () => {
  it("returns options for form selects", () => {
    const options = getCategoryOptions();
    expect(options[0]).toHaveProperty("value");
    expect(options[0]).toHaveProperty("label");
    expect(options.some(o => o.label === "Photography")).toBe(true);
  });
});

describe("getCategoryName", () => {
  it("returns name for valid slug", () => {
    expect(getCategoryName("graphic-design")).toBe("Graphic Design");
    expect(getCategoryName("literary")).toBe("Literary");
  });

  it("returns null for invalid slug", () => {
    expect(getCategoryName("invalid-slug")).toBeNull();
  });
});

describe("getCategorySlug", () => {
  it("returns slug for valid name", () => {
    expect(getCategorySlug("Graphic Design")).toBe("graphic-design");
    expect(getCategorySlug("Literary")).toBe("literary");
  });

  it("is case-insensitive", () => {
    expect(getCategorySlug("FASHION")).toBe("fashion");
    expect(getCategorySlug("photography")).toBe("photography");
  });

  it("returns null for invalid name", () => {
    expect(getCategorySlug("Invalid Category")).toBeNull();
  });
});

describe("isValidCategory", () => {
  it("returns true for valid categories", () => {
    expect(isValidCategory("Art")).toBe(true);
    expect(isValidCategory("Graphic Design")).toBe(true);
    expect(isValidCategory("literary")).toBe(true); // case-insensitive
  });

  it("returns false for deprecated categories", () => {
    expect(isValidCategory("Culture")).toBe(false);
    expect(isValidCategory("Design")).toBe(false);
    expect(isValidCategory("Literature")).toBe(false);
  });
});

describe("normalizeCategory", () => {
  it("returns null for empty input", () => {
    expect(normalizeCategory(null)).toBeNull();
    expect(normalizeCategory("")).toBeNull();
    expect(normalizeCategory("   ")).toBeNull();
  });

  it("maps Literature to Literary", () => {
    expect(normalizeCategory("Literature")).toBe("Literary");
  });

  it("returns null for removed categories", () => {
    expect(normalizeCategory("Culture")).toBeNull();
    expect(normalizeCategory("Design")).toBeNull();
  });

  it("normalizes case for valid categories", () => {
    expect(normalizeCategory("fashion")).toBe("Fashion");
    expect(normalizeCategory("PHOTOGRAPHY")).toBe("Photography");
    expect(normalizeCategory("graphic design")).toBe("Graphic Design");
  });

  it("preserves unknown categories for backwards compatibility", () => {
    expect(normalizeCategory("Unknown Category")).toBe("Unknown Category");
  });
});

describe("categoryNeedsReview", () => {
  it("returns false for null", () => {
    expect(categoryNeedsReview(null)).toBe(false);
  });

  it("returns true for legacy categories", () => {
    expect(categoryNeedsReview("Literature")).toBe(true);
    expect(categoryNeedsReview("Culture")).toBe(true);
    expect(categoryNeedsReview("Design")).toBe(true);
  });

  it("returns false for valid categories", () => {
    expect(categoryNeedsReview("Art")).toBe(false);
    expect(categoryNeedsReview("Fashion")).toBe(false);
  });
});

describe("getSuggestedReplacement", () => {
  it("suggests Literary for Literature", () => {
    expect(getSuggestedReplacement("Literature")).toEqual(["Literary"]);
  });

  it("suggests design subcategories for Design", () => {
    const suggestions = getSuggestedReplacement("Design");
    expect(suggestions).toContain("Graphic Design");
    expect(suggestions).toContain("Interior Design");
  });

  it("suggests alternatives for Culture", () => {
    const suggestions = getSuggestedReplacement("Culture");
    expect(suggestions).toContain("Art");
    expect(suggestions).toContain("Literary");
  });

  it("returns null for valid categories", () => {
    expect(getSuggestedReplacement("Art")).toBeNull();
  });
});
