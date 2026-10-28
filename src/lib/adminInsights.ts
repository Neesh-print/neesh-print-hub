import { eachDayOfInterval, eachWeekOfInterval, format, startOfDay, startOfWeek, subDays } from "date-fns";
import { SALE_STATUSES } from "@/lib/orderStatus";
import type { OverviewOrder } from "@/lib/adminOverview";

/**
 * Admin v2 Insights: sales, Neesh's take and who is buying and selling, over
 * a period, from the same orders the Today and Orders screens use.
 */

/** Neesh keeps 10% from the space and 10% from the publisher: 0.2 / 1.1 of what the space paid. */
export const FEE_SHARE = 0.2 / 1.1;

export interface Period {
  from: Date;
  to: Date;
}

export interface Totals {
  sales: number;
  fees: number;
  orders: number;
  units: number;
  avgOrder: number;
  spaces: number;
  publishers: number;
}

export interface Ranked {
  name: string;
  sales: number;
  orders: number;
  units: number;
}

export interface Insights {
  totals: Totals;
  previous: Totals;
  series: { label: string; sales: number; orders: number }[];
  topPublishers: Ranked[];
  topSpaces: Ranked[];
  topTitles: (Ranked & { publisher: string })[];
}

const isSale = (o: OverviewOrder) => SALE_STATUSES.includes(o.status);

/** The recorded platform fee when the order has a payout, else the standard share. */
export const feeOf = (o: OverviewOrder) => o.transfer?.fee ?? o.total * FEE_SHARE;

const within = (o: OverviewOrder, p: Period) => {
  const at = new Date(o.createdAt);
  return at >= p.from && at <= p.to;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function totalsOf(orders: OverviewOrder[]): Totals {
  const sales = orders.reduce((s, o) => s + o.total, 0);
  return {
    sales: round2(sales),
    fees: round2(orders.reduce((s, o) => s + feeOf(o), 0)),
    orders: orders.length,
    units: orders.reduce((s, o) => s + o.quantity, 0),
    avgOrder: orders.length ? round2(sales / orders.length) : 0,
    spaces: new Set(orders.map((o) => o.spaceId).filter(Boolean)).size,
    publishers: new Set(orders.map((o) => o.publisherId).filter(Boolean)).size,
  };
}

function rank<T extends Ranked>(orders: OverviewOrder[], keyOf: (o: OverviewOrder) => string, extra?: (o: OverviewOrder) => Partial<T>, limit = 8): T[] {
  const by = new Map<string, T>();
  for (const o of orders) {
    const name = keyOf(o);
    const r = by.get(name) ?? ({ name, sales: 0, orders: 0, units: 0, ...(extra?.(o) ?? {}) } as T);
    r.sales = round2(r.sales + o.total);
    r.orders += 1;
    r.units += o.quantity;
    by.set(name, r);
  }
  return [...by.values()].sort((a, b) => b.sales - a.sales || a.name.localeCompare(b.name)).slice(0, limit);
}

/** Days per bar: daily up to five weeks, weekly beyond. */
const isWeekly = (p: Period) => p.to.getTime() - p.from.getTime() > 35 * 24 * 3600 * 1000;

export function summarizeInsights(all: OverviewOrder[], period: Period, opts: { excludeInternal?: boolean } = {}): Insights {
  const sales = all.filter((o) => isSale(o) && (!opts.excludeInternal || !o.spaceIsInternal));
  const current = sales.filter((o) => within(o, period));
  const length = period.to.getTime() - period.from.getTime();
  const previousPeriod = { from: new Date(period.from.getTime() - length), to: new Date(period.from.getTime() - 1) };

  const weekly = isWeekly(period);
  const buckets = weekly
    ? eachWeekOfInterval({ start: period.from, end: period.to }, { weekStartsOn: 1 })
    : eachDayOfInterval({ start: period.from, end: period.to });
  const keyOf = (d: Date) => (weekly ? startOfWeek(d, { weekStartsOn: 1 }) : startOfDay(d)).getTime();
  const series = new Map(buckets.map((d) => [keyOf(d), { label: format(d, weekly ? "MMM d" : "EEE d"), sales: 0, orders: 0 }]));
  for (const o of current) {
    const b = series.get(keyOf(new Date(o.createdAt)));
    if (b) {
      b.sales = round2(b.sales + o.total);
      b.orders += 1;
    }
  }

  return {
    totals: totalsOf(current),
    previous: totalsOf(sales.filter((o) => within(o, previousPeriod))),
    series: [...series.values()],
    topPublishers: rank(current, (o) => o.publisherName),
    topSpaces: rank(current, (o) => o.spaceName),
    topTitles: rank<Ranked & { publisher: string }>(
      current,
      (o) => (o.issue ? `${o.title} · ${o.issue}` : o.title),
      (o) => ({ publisher: o.publisherName }),
    ),
  };
}

/** A period ending now: the last `days` days, or since the first order for "all". */
export function periodFor(range: "7d" | "30d" | "90d" | "all", now: Date, firstOrderAt?: string): Period {
  if (range === "all") return { from: startOfDay(firstOrderAt ? new Date(firstOrderAt) : subDays(now, 365)), to: now };
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return { from: startOfDay(subDays(now, days - 1)), to: now };
}

/** Percent change from the previous period, or null when there was nothing before. */
export const change = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);
