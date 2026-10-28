import { describe, expect, it } from "vitest";
import {
  inView,
  payoutStateOf,
  problemsOf,
  stageOf,
  summarizeToday,
  type OverviewOrder,
} from "./adminOverview";

const NOW = new Date("2026-10-27T22:00:00Z");

const order = (overrides: Partial<OverviewOrder> = {}): OverviewOrder => ({
  id: "c8112e4a-0000-0000-0000-000000000000",
  ref: "#C8112E4A",
  createdAt: "2026-10-26T14:00:00Z",
  updatedAt: "2026-10-26T14:00:00Z",
  status: "paid",
  quantity: 5,
  total: 22,
  title: "No. 136, Fall 2026",
  issue: null,
  publisherId: "pub-1",
  publisherName: "Filmmaker",
  publisherUserId: "user-1",
  publisherCanBePaid: true,
  spaceId: "space-1",
  spaceName: "Ink-ish",
  spaceIsInternal: false,
  hasAddress: true,
  carrier: null,
  trackingNumber: null,
  transfer: { id: "t-1", status: "pending", net: 18, fee: 4, holdReason: null, failureReason: null, transferredAt: null },
  ...overrides,
});

describe("stageOf", () => {
  it("maps stored statuses to stages, with processing as Packed", () => {
    expect(stageOf("paid")).toBe("to_ship");
    expect(stageOf("processing")).toBe("packed");
    expect(stageOf("shipped")).toBe("shipped");
    expect(stageOf("delivered")).toBe("delivered");
  });
});

describe("payoutStateOf", () => {
  it("waits until the order is packed", () => {
    expect(payoutStateOf(order({ status: "paid" }))).toBe("waiting");
  });

  it("is ready from Packed on", () => {
    expect(payoutStateOf(order({ status: "processing" }))).toBe("ready");
    expect(payoutStateOf(order({ status: "shipped" }))).toBe("ready");
    expect(payoutStateOf(order({ status: "delivered" }))).toBe("ready");
  });

  it("is blocked when the publisher can't be paid, even before packing", () => {
    expect(payoutStateOf(order({ publisherCanBePaid: false }))).toBe("blocked");
    expect(payoutStateOf(order({ status: "shipped", publisherCanBePaid: false }))).toBe("blocked");
  });

  it("puts holds ahead of readiness", () => {
    const held = order({ status: "shipped", transfer: { ...order().transfer!, holdReason: "dispute" } });
    expect(payoutStateOf(held)).toBe("held");
  });

  it("reports finished and failed transfers", () => {
    expect(payoutStateOf(order({ transfer: { ...order().transfer!, status: "transferred" } }))).toBe("paid_out");
    expect(payoutStateOf(order({ transfer: { ...order().transfer!, status: "failed" } }))).toBe("failed");
    expect(payoutStateOf(order({ transfer: null }))).toBe("none");
  });
});

describe("problemsOf", () => {
  it("flags an unshipped order with no address", () => {
    expect(problemsOf(order({ hasAddress: false, createdAt: "2026-02-15T00:00:00Z" }), NOW)).toEqual(["no_address"]);
  });

  it("flags To ship orders 3 or more days old", () => {
    expect(problemsOf(order({ createdAt: "2026-10-22T03:00:00Z" }), NOW)).toEqual(["late"]);
    expect(problemsOf(order({ createdAt: "2026-10-26T14:00:00Z" }), NOW)).toEqual([]);
  });

  it("flags orders sitting in Packed with no carrier scan", () => {
    expect(problemsOf(order({ status: "processing", updatedAt: "2026-10-23T00:00:00Z" }), NOW)).toEqual(["stuck_packed"]);
    expect(problemsOf(order({ status: "processing", updatedAt: "2026-10-27T00:00:00Z" }), NOW)).toEqual([]);
  });

  it("flags failed payouts", () => {
    const failed = order({ status: "delivered", transfer: { ...order().transfer!, status: "failed" } });
    expect(problemsOf(failed, NOW)).toEqual(["payout_failed"]);
  });
});

describe("inView", () => {
  it("puts ready payouts in the Payout ready tab", () => {
    expect(inView(order({ status: "shipped" }), "payout_ready", NOW)).toBe(true);
    expect(inView(order({ status: "paid" }), "payout_ready", NOW)).toBe(false);
  });
});

describe("summarizeToday", () => {
  const orders = [
    order({ id: "a", ref: "#A", createdAt: "2026-10-26T14:00:00Z" }),
    order({ id: "b", ref: "#B", createdAt: "2026-10-22T03:00:00Z", publisherCanBePaid: false }),
    order({ id: "c", ref: "#C", createdAt: "2026-02-15T00:00:00Z", hasAddress: false, transfer: null, spaceId: "space-2" }),
    order({
      id: "d",
      ref: "#D",
      status: "shipped",
      publisherName: "The Drift",
      carrier: "USPS",
      updatedAt: "2026-10-27T21:12:00Z",
      createdAt: "2026-10-22T03:00:00Z",
      total: 52.8,
      transfer: { id: "t-d", status: "transferred", net: 43.2, fee: 9.6, holdReason: null, failureReason: null, transferredAt: "2026-10-27T21:13:00Z" },
    }),
    order({ id: "e", ref: "#E", status: "shipped", publisherName: "Good Sport", publisherId: "pub-2" }),
  ];
  const today = summarizeToday(orders, NOW);

  it("orders the To ship list late, then fresh, then no address", () => {
    expect(today.toShip.map((o) => o.id)).toEqual(["b", "a", "c"]);
  });

  it("lists ready payouts and groups blocked ones by publisher", () => {
    expect(today.ready.map((o) => o.id)).toEqual(["e"]);
    expect(today.blocked).toEqual([{ publisherId: "pub-1", publisherUserId: "user-1", publisherName: "Filmmaker", amount: 18, orderCount: 1 }]);
  });

  it("sums the last 7 days and counts spaces ordering", () => {
    expect(today.pulse.orders7d).toBe(4);
    expect(today.pulse.sales7d).toBeCloseTo(22 * 3 + 52.8);
    expect(today.pulse.paidOut7d).toBeCloseTo(43.2);
    expect(today.pulse.paidOutTo).toEqual(["The Drift"]);
    expect(today.pulse.spacesOrdering90d).toBe(1);
  });

  it("lists today's shipments and payouts, newest first", () => {
    // Good Sport's order last changed yesterday, so it isn't in today's list.
    expect(today.activity.map((a) => a.text)).toEqual([
      "The Drift paid out $43.20",
      "The Drift: No. 136, Fall 2026 shipped (USPS)",
    ]);
  });

  it("can leave internal orders out of the numbers but never out of the work", () => {
    const withInternal = [...orders, order({ id: "n", ref: "#N", total: 100, spaceIsInternal: true, spaceId: "nwm" })];
    const all = summarizeToday(withInternal, NOW);
    const external = summarizeToday(withInternal, NOW, { excludeInternal: true });
    expect(all.pulse.orders7d).toBe(5);
    expect(external.pulse.orders7d).toBe(4);
    expect(external.pulse.sales7d).toBeCloseTo(all.pulse.sales7d - 100);
    expect(external.toShip.map((o) => o.id)).toContain("n");
  });
});
