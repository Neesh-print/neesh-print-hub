import { describe, expect, it } from "vitest";
import { lateOrderNudge, setupNudge } from "./adminNudges";
import type { OverviewOrder } from "./adminOverview";

const order = {
  ref: "#DB2135A4",
  title: "No. 136, Fall 2026",
  quantity: 4,
  spaceName: "Periodicals",
} as OverviewOrder;

describe("lateOrderNudge", () => {
  it("names the order, the space and how long it has waited", () => {
    expect(lateOrderNudge(order, 5)).toBe(
      "Hi from Neesh! No. 136, Fall 2026 × 4 for Periodicals (order #DB2135A4) came in 5 days ago and hasn't shipped yet. Could you add tracking when it goes out, or let us know if anything is holding it up?",
    );
  });

  it("asks about a missing carrier scan for packed orders", () => {
    expect(lateOrderNudge(order, 1, true)).toContain("was packed 1 day ago, but the carrier hasn't scanned it yet");
  });
});

describe("setupNudge", () => {
  it("says what is owed and what is left to do", () => {
    expect(setupNudge(["Stripe payouts", "Ships-from address"], 39.6, 3)).toBe(
      "Hi from Neesh! You have $39.60 waiting from 3 orders. Could you set up Stripe payouts and add your ships-from address on Neesh so we can pay you as soon as orders ship?",
    );
  });

  it("leaves out the money when nothing is owed", () => {
    expect(setupNudge(["A live title"], 0, 0)).toBe(
      "Hi from Neesh! Could you list a title on Neesh so spaces can start ordering from you?",
    );
  });
});
