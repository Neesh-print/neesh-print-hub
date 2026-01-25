import { describe, it, expect } from "vitest";
import {
  getInstagramUrl,
  normalizeInstagramHandle,
  normalizeWebsiteUrl,
  getDisplayDomain,
  formatInstagramHandle,
} from "./social-links";

describe("getInstagramUrl", () => {
  it("constructs full URL from handle", () => {
    expect(getInstagramUrl("apartamentomagazine")).toBe("https://instagram.com/apartamentomagazine");
  });

  it("strips @ prefix from handle", () => {
    expect(getInstagramUrl("@apartamentomagazine")).toBe("https://instagram.com/apartamentomagazine");
  });

  it("returns null for null input", () => {
    expect(getInstagramUrl(null)).toBeNull();
  });
});

describe("normalizeInstagramHandle", () => {
  it("returns plain handle as-is", () => {
    expect(normalizeInstagramHandle("apartamentomagazine")).toBe("apartamentomagazine");
  });

  it("strips @ prefix", () => {
    expect(normalizeInstagramHandle("@apartamentomagazine")).toBe("apartamentomagazine");
  });

  it("extracts handle from full instagram.com URL", () => {
    expect(normalizeInstagramHandle("https://instagram.com/apartamentomagazine")).toBe("apartamentomagazine");
    expect(normalizeInstagramHandle("https://www.instagram.com/apartamentomagazine")).toBe("apartamentomagazine");
  });

  it("extracts handle from instagr.am URL", () => {
    expect(normalizeInstagramHandle("https://instagr.am/apartamentomagazine")).toBe("apartamentomagazine");
  });

  it("removes trailing slash and query params", () => {
    expect(normalizeInstagramHandle("instagram.com/apartamentomagazine/")).toBe("apartamentomagazine");
    expect(normalizeInstagramHandle("instagram.com/apartamentomagazine?hl=en")).toBe("apartamentomagazine");
  });

  it("handles handles with underscores and periods", () => {
    expect(normalizeInstagramHandle("example_magazine.co")).toBe("example_magazine.co");
  });

  it("returns null for empty input", () => {
    expect(normalizeInstagramHandle("")).toBeNull();
    expect(normalizeInstagramHandle("   ")).toBeNull();
  });

  it("returns null for invalid characters", () => {
    expect(normalizeInstagramHandle("invalid!handle")).toBeNull();
    expect(normalizeInstagramHandle("has spaces")).toBeNull();
  });

  it("returns null for handle over 30 chars", () => {
    const longHandle = "a".repeat(31);
    expect(normalizeInstagramHandle(longHandle)).toBeNull();
  });
});

describe("normalizeWebsiteUrl", () => {
  it("returns valid URL as-is", () => {
    expect(normalizeWebsiteUrl("https://example.com")).toBe("https://example.com");
    expect(normalizeWebsiteUrl("http://example.com")).toBe("http://example.com");
  });

  it("adds https:// if missing protocol", () => {
    expect(normalizeWebsiteUrl("example.com")).toBe("https://example.com");
    expect(normalizeWebsiteUrl("www.example.com")).toBe("https://www.example.com");
  });

  it("returns null for empty input", () => {
    expect(normalizeWebsiteUrl("")).toBeNull();
    expect(normalizeWebsiteUrl("   ")).toBeNull();
  });

  it("returns null for invalid URL", () => {
    expect(normalizeWebsiteUrl("not a url at all")).toBeNull();
  });
});

describe("getDisplayDomain", () => {
  it("extracts domain from URL", () => {
    expect(getDisplayDomain("https://example.com/page")).toBe("example.com");
  });

  it("removes www. prefix", () => {
    expect(getDisplayDomain("https://www.example.com")).toBe("example.com");
  });

  it("returns null for null input", () => {
    expect(getDisplayDomain(null)).toBeNull();
  });

  it("returns null for invalid URL", () => {
    expect(getDisplayDomain("not a url")).toBeNull();
  });
});

describe("formatInstagramHandle", () => {
  it("adds @ prefix to handle", () => {
    expect(formatInstagramHandle("apartamentomagazine")).toBe("@apartamentomagazine");
  });

  it("does not double @ prefix", () => {
    expect(formatInstagramHandle("@apartamentomagazine")).toBe("@apartamentomagazine");
  });

  it("returns null for null input", () => {
    expect(formatInstagramHandle(null)).toBeNull();
  });
});
