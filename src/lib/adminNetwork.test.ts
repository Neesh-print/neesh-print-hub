import { describe, expect, it } from "vitest";
import {
  activityByPublisher,
  activityBySpace,
  activityOf,
  missingSetup,
  publisherStageOf,
  spaceStageOf,
} from "./adminNetwork";
import type { OverviewOrder } from "./adminOverview";

const NOW = new Date("2026-10-27T22:00:00Z");

const order = (overrides: Partial<OverviewOrder> = {}): OverviewOrder => ({
  id: "o",
  ref: "#O",
  createdAt: "2026-10-26T14:00:00Z",
  updatedAt: null,
  status: "paid",
  quantity: 1,
  total: 22,
  title: "Title",
  issue: null,
  publisherId: "pub-1",
  publisherName: "Filmmaker",
  publisherCanBePaid: false,
  spaceId: "space-1",
  spaceName: "Ink-ish",
  hasAddress: true,
  carrier: null,
  trackingNumber: null,
  transfer: { id: "t", status: "pending", net: 18, fee: 4, holdReason: null, failureReason: null, transferredAt: null },
  ...overrides,
});

const setUp = { payoutsEnabled: true, hasAddress: true, liveTitles: 1 };

describe("activity", () => {
  const orders = [
    order({ id: "a", total: 22 }),
    order({ id: "b", total: 17.6, createdAt: "2026-10-22T00:00:00Z", transfer: { ...order().transfer!, status: "transferred" } }),
    order({ id: "c", total: 99, status: "cancelled" }),
  ];

  it("sums sales, counts orders and adds up what is still owed", () => {
    const a = activityOf(activityByPublisher(orders), "pub-1");
    expect(a.sales).toBeCloseTo(39.6);
    expect(a.orders).toBe(2);
    expect(a.lastOrderAt).toBe("2026-10-26T14:00:00Z");
    expect(a.owed).toBe(18);
  });

  it("tallies spaces by their user id", () => {
    expect(activityOf(activityBySpace(orders), "space-1").orders).toBe(2);
    expect(activityOf(activityBySpace(orders), "nobody").orders).toBe(0);
  });
});

describe("publisherStageOf", () => {
  const none = { sales: 0, orders: 0, lastOrderAt: null, owed: 0 };

  it("is selling with an order in the last 90 days, whatever the setup", () => {
    expect(publisherStageOf({ ...setUp, payoutsEnabled: false }, { ...none, lastOrderAt: "2026-10-26T00:00:00Z" }, NOW)).toBe("selling");
  });

  it("is lapsed when the last order is older than 90 days", () => {
    expect(publisherStageOf(setUp, { ...none, lastOrderAt: "2026-02-15T00:00:00Z" }, NOW)).toBe("lapsed");
  });

  it("is ready when set up with no orders, else setting up", () => {
    expect(publisherStageOf(setUp, none, NOW)).toBe("ready");
    expect(publisherStageOf({ ...setUp, hasAddress: false }, none, NOW)).toBe("setting_up");
  });
});

describe("spaceStageOf", () => {
  it("splits spaces into ordering, lapsed and never ordered", () => {
    expect(spaceStageOf({ sales: 1, orders: 1, lastOrderAt: "2026-10-22T00:00:00Z", owed: 0 }, NOW)).toBe("ordering");
    expect(spaceStageOf({ sales: 1, orders: 1, lastOrderAt: "2026-02-01T00:00:00Z", owed: 0 }, NOW)).toBe("lapsed");
    expect(spaceStageOf({ sales: 0, orders: 0, lastOrderAt: null, owed: 0 }, NOW)).toBe("never");
  });
});

describe("missingSetup", () => {
  it("lists what a publisher still has to do", () => {
    expect(missingSetup({ payoutsEnabled: false, hasAddress: false, liveTitles: 0 })).toEqual([
      "Stripe payouts",
      "Ships-from address",
      "A live title",
    ]);
    expect(missingSetup(setUp)).toEqual([]);
  });
});
