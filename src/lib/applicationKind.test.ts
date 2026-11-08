import { describe, expect, it } from "vitest";
import { publisherApplicationKind } from "./applicationStatus";

describe("publisherApplicationKind", () => {
  it("treats applications from before the selling question as selling", () => {
    expect(publisherApplicationKind({ additional_info: {} })).toBe("claim_and_sell");
  });
  it("reads the column first, then additional_info", () => {
    expect(publisherApplicationKind({ wants_to_sell: false, additional_info: { wantsToSell: true } })).toBe("claim_only");
    expect(publisherApplicationKind({ additional_info: { wantsToSell: false } })).toBe("claim_only");
  });
  it("marks a claim-only publisher's selling application", () => {
    expect(publisherApplicationKind({ wants_to_sell: true, additional_info: { sellUpgrade: true } })).toBe("start_selling");
  });
});
