import { describe, it, expect } from "vitest";
import { normalizeWeb } from "./normalize-web";

describe("normalizeWeb", () => {
  it("converts an @handle to an Instagram URL", () => {
    expect(normalizeWeb("@yourstore")).toBe("https://instagram.com/yourstore");
  });

  it("treats a bare word without a dot as an Instagram handle", () => {
    expect(normalizeWeb("yourstore")).toBe("https://instagram.com/yourstore");
  });

  it("strips leading slashes from a bare handle", () => {
    expect(normalizeWeb("//yourstore")).toBe("https://instagram.com/yourstore");
  });

  it("prefixes https:// on a bare domain", () => {
    expect(normalizeWeb("yourstore.com")).toBe("https://yourstore.com");
  });

  it("leaves a full http(s) URL untouched", () => {
    expect(normalizeWeb("https://yourstore.com")).toBe("https://yourstore.com");
    expect(normalizeWeb("http://yourstore.com")).toBe("http://yourstore.com");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeWeb("  yourstore.com  ")).toBe("https://yourstore.com");
  });
});
