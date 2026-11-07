import { describe, expect, it } from "vitest";
import { buildPublisherSteps } from "./publisher-application-steps";

describe("buildPublisherSteps", () => {
  it("assumes the claim path until the selling question is answered", () => {
    const steps = buildPublisherSteps({ skipTitle: false, wantsToSell: null });
    expect(steps).toEqual([
      "contact", "title", "business", "cover", "description", "online", "sell", "claimConfirm",
    ]);
  });

  it("puts the selling question right after the six page steps", () => {
    const steps = buildPublisherSteps({ skipTitle: false, wantsToSell: true });
    expect(steps.indexOf("sell")).toBe(6);
    expect(steps.slice(7)).toEqual(["shipping", "details", "pricing", "fulfillment", "additional", "confirm"]);
    expect(steps).toHaveLength(13);
  });

  it("never reaches a selling step on the claim-only path", () => {
    const steps = buildPublisherSteps({ skipTitle: true, wantsToSell: false });
    expect(steps).toEqual(["contact", "business", "cover", "description", "online", "sell", "claimConfirm"]);
    for (const selling of ["shipping", "details", "pricing", "fulfillment", "additional", "confirm"]) {
      expect(steps).not.toContain(selling);
    }
  });

  it("skips the title step when the claim already names the title", () => {
    expect(buildPublisherSteps({ skipTitle: true, wantsToSell: null })).not.toContain("title");
  });
});
