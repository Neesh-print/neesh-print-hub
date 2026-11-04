import { describe, it, expect } from "vitest";
import { isValidSubscribeUrl, normalizeSubscribeUrl } from "./subscribe-url";

describe("normalizeSubscribeUrl", () => {
  it("keeps blank values blank", () => {
    expect(normalizeSubscribeUrl("")).toBe("");
    expect(normalizeSubscribeUrl("   ")).toBe("");
    expect(normalizeSubscribeUrl(undefined)).toBe("");
  });

  it("prefixes https:// on a bare domain", () => {
    expect(normalizeSubscribeUrl("yourmagazine.com/subscribe")).toBe("https://yourmagazine.com/subscribe");
  });

  it("leaves a full http(s) URL untouched", () => {
    expect(normalizeSubscribeUrl("https://yourmagazine.com/subscribe")).toBe("https://yourmagazine.com/subscribe");
    expect(normalizeSubscribeUrl("http://yourmagazine.com")).toBe("http://yourmagazine.com");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeSubscribeUrl("  yourmagazine.com  ")).toBe("https://yourmagazine.com");
  });
});

describe("isValidSubscribeUrl", () => {
  it("accepts blank, bare domains and http(s) URLs", () => {
    expect(isValidSubscribeUrl("")).toBe(true);
    expect(isValidSubscribeUrl("yourmagazine.com")).toBe(true);
    expect(isValidSubscribeUrl("https://shop.yourmagazine.com/subscribe?ref=neesh")).toBe(true);
  });

  it("rejects other schemes and things that are not links", () => {
    expect(isValidSubscribeUrl("ftp://yourmagazine.com")).toBe(false);
    expect(isValidSubscribeUrl("mailto:hi@yourmagazine.com")).toBe(false);
    expect(isValidSubscribeUrl("subscribe")).toBe(false);
    expect(isValidSubscribeUrl("your magazine.com")).toBe(false);
  });
});
