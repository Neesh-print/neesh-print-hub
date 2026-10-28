import { describe, expect, it } from "vitest";
import { trackingUrl } from "./tracking";

describe("trackingUrl", () => {
  it("links the carriers publishers use, whatever the case or service name", () => {
    expect(trackingUrl("USPS", "9400 1")).toBe("https://tools.usps.com/go/TrackConfirmAction?tLabels=9400%201");
    expect(trackingUrl("fedex", "7731")).toBe("https://www.fedex.com/fedextrack/?trknbr=7731");
    expect(trackingUrl("UPS Ground", "1Z9")).toBe("https://www.ups.com/track?tracknum=1Z9");
    expect(trackingUrl("dhl", "123")).toContain("tracking-id=123");
  });

  it("has no link for unknown carriers or a missing number", () => {
    expect(trackingUrl("other", "123")).toBeNull();
    expect(trackingUrl("amazon", "TBA1")).toBeNull();
    expect(trackingUrl("usps", "  ")).toBeNull();
    expect(trackingUrl(null, null)).toBeNull();
  });
});
