import { describe, it, expect } from "vitest";
import { humanizeRequirements } from "./stripeRequirements";

describe("humanizeRequirements", () => {
  it("returns an empty array when there are no requirements", () => {
    expect(humanizeRequirements(null)).toEqual([]);
    expect(humanizeRequirements(undefined)).toEqual([]);
    expect(humanizeRequirements({ currently_due: [], past_due: [] })).toEqual([]);
  });

  it("maps raw Stripe keys to plain labels", () => {
    const labels = humanizeRequirements({
      currently_due: ["individual.id_number", "external_account"],
    });
    expect(labels).toContain("Your Social Security number or tax ID");
    expect(labels).toContain("Your bank account details");
    // Never leaks the raw Stripe field name.
    expect(labels.join(" ")).not.toContain("individual.id_number");
  });

  it("collapses a field family into a single label", () => {
    const labels = humanizeRequirements({
      currently_due: ["individual.dob.day", "individual.dob.month", "individual.dob.year"],
    });
    expect(labels).toEqual(["Your date of birth"]);
  });

  it("lists past-due items before currently-due items", () => {
    const labels = humanizeRequirements({
      past_due: ["external_account"],
      currently_due: ["individual.verification.document"],
    });
    expect(labels[0]).toBe("Your bank account details");
    expect(labels[1]).toBe("A photo of your ID");
  });

  it("falls back to a humanized label for unknown keys", () => {
    const labels = humanizeRequirements({ currently_due: ["individual.some_new_field"] });
    expect(labels).toEqual(["Some new field"]);
  });
});
