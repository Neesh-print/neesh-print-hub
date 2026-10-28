import { describe, expect, it } from "vitest";
import { FEE_SHARE, change, feeOf, periodFor, summarizeInsights } from "./adminInsights";
import type { OverviewOrder } from "./adminOverview";

const NOW = new Date("2026-10-27T22:00:00Z");

const order = (overrides: Partial<OverviewOrder> = {}): OverviewOrder => ({
  id: "o",
  ref: "#O",
  createdAt: "2026-10-26T14:00:00Z",
  updatedAt: null,
  status: "paid",
  paymentStatus: "paid",
  quantity: 5,
  total: 22,
  title: "No. 136, Fall 2026",
  issue: null,
  publisherId: "pub-1",
  publisherName: "Filmmaker",
  publisherUserId: null,
  publisherCanBePaid: true,
  spaceId: "space-1",
  spaceName: "Ink-ish",
  spaceIsInternal: false,
  hasAddress: true,
  carrier: null,
  trackingNumber: null,
  transfer: { id: "t", status: "pending", net: 18, fee: 4, holdReason: null, failureReason: null, transferredAt: null },
  ...overrides,
});

describe("feeOf", () => {
  it("uses the recorded fee, else 10% from each side", () => {
    expect(feeOf(order())).toBe(4);
    expect(feeOf(order({ transfer: null, total: 110 }))).toBeCloseTo(110 * FEE_SHARE);
    expect(110 * FEE_SHARE).toBeCloseTo(20);
  });
});

describe("summarizeInsights", () => {
  const orders = [
    order({ id: "a" }),
    order({ id: "b", total: 82.5, quantity: 5, publisherId: "pub-2", publisherName: "Amateurs", transfer: { ...order().transfer!, fee: 15 } }),
    order({ id: "c", total: 46.2, quantity: 2, spaceId: "nwm", spaceName: "NWM Collections", spaceIsInternal: true, createdAt: "2026-10-22T03:00:00Z", transfer: { ...order().transfer!, fee: 8.4 } }),
    order({ id: "d", total: 99, status: "cancelled" }),
    order({ id: "e", total: 50, createdAt: "2026-10-15T00:00:00Z" }),
  ];
  const week = periodFor("7d", NOW);

  it("totals sales, fees and orders in the period, skipping cancelled", () => {
    const i = summarizeInsights(orders, week);
    expect(i.totals).toEqual({ sales: 150.7, fees: 27.4, orders: 3, units: 12, avgOrder: 50.23, spaces: 2, publishers: 2 });
  });

  it("compares with the period before", () => {
    const i = summarizeInsights(orders, week);
    expect(i.previous.orders).toBe(1);
    expect(i.previous.sales).toBe(50);
    expect(change(i.totals.sales, i.previous.sales)).toBe(201);
    expect(change(10, 0)).toBeNull();
  });

  it("can leave internal orders out", () => {
    const i = summarizeInsights(orders, week, { excludeInternal: true });
    expect(i.totals.orders).toBe(2);
    expect(i.topSpaces.map((s) => s.name)).toEqual(["Ink-ish"]);
  });

  it("puts each order on its own day and ranks publishers by sales", () => {
    const i = summarizeInsights(orders, week);
    expect(i.series).toHaveLength(7);
    expect(i.series.reduce((s, b) => s + b.orders, 0)).toBe(3);
    expect(i.topPublishers[0]).toEqual({ name: "Amateurs", sales: 82.5, orders: 1, units: 5 });
  });
});
