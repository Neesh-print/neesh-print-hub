import { subDays } from "date-fns";
import { SALE_STATUSES } from "@/lib/orderStatus";
import type { OverviewOrder } from "@/lib/adminOverview";

/**
 * Admin v2 Network: where each publisher and space is in its life on Neesh,
 * worked out from what it has done rather than an "active" flag.
 *
 * Publishers: Setting up → Ready (payouts, ships-from address and a live
 * title) → Selling (an order in the last 90 days) → Lapsed (sold before, not
 * in 90 days). Spaces: Never ordered → Ordering → Lapsed.
 */

export const ACTIVE_WINDOW_DAYS = 90;

export type PublisherStage = "setting_up" | "ready" | "selling" | "lapsed";
export type SpaceStage = "never" | "ordering" | "lapsed";

export const PUBLISHER_STAGE_LABEL: Record<PublisherStage, string> = {
  setting_up: "Setting up",
  ready: "Ready",
  selling: "Selling",
  lapsed: "Lapsed",
};

export const SPACE_STAGE_LABEL: Record<SpaceStage, string> = {
  never: "Never ordered",
  ordering: "Ordering",
  lapsed: "Lapsed",
};

export interface Activity {
  sales: number;
  orders: number;
  lastOrderAt: string | null;
  /** Payouts not yet sent: pending goods transfers. */
  owed: number;
  /** How many orders those pending payouts come from. */
  owedOrders: number;
}

const EMPTY: Activity = { sales: 0, orders: 0, lastOrderAt: null, owed: 0, owedOrders: 0 };

const isSale = (o: OverviewOrder) => SALE_STATUSES.includes(o.status);

function tally(orders: OverviewOrder[], keyOf: (o: OverviewOrder) => string | null): Map<string, Activity> {
  const out = new Map<string, Activity>();
  for (const o of orders) {
    const key = keyOf(o);
    if (!key || !isSale(o)) continue;
    const a = out.get(key) ?? { ...EMPTY };
    a.sales += o.total;
    a.orders += 1;
    if (!a.lastOrderAt || o.createdAt > a.lastOrderAt) a.lastOrderAt = o.createdAt;
    if (o.transfer && o.transfer.status === "pending") {
      a.owed += o.transfer.net;
      a.owedOrders += 1;
    }
    out.set(key, a);
  }
  return out;
}

/** Sales, order count, last order and money owed, by publisher id. */
export const activityByPublisher = (orders: OverviewOrder[]) => tally(orders, (o) => o.publisherId);

/** Spend, order count and last order, by the space's user id (orders.retailer_id). */
export const activityBySpace = (orders: OverviewOrder[]) => tally(orders, (o) => o.spaceId);

export const activityOf = (map: Map<string, Activity>, key: string | null | undefined): Activity =>
  (key && map.get(key)) || EMPTY;

const recent = (lastOrderAt: string | null, now: Date) =>
  !!lastOrderAt && new Date(lastOrderAt) >= subDays(now, ACTIVE_WINDOW_DAYS);

export interface PublisherSetup {
  payoutsEnabled: boolean;
  hasAddress: boolean;
  liveTitles: number;
}

export const isSetUp = (s: PublisherSetup) => s.payoutsEnabled && s.hasAddress && s.liveTitles > 0;

export function publisherStageOf(setup: PublisherSetup, activity: Activity, now: Date): PublisherStage {
  if (recent(activity.lastOrderAt, now)) return "selling";
  if (activity.lastOrderAt) return "lapsed";
  return isSetUp(setup) ? "ready" : "setting_up";
}

export function spaceStageOf(activity: Activity, now: Date): SpaceStage {
  if (recent(activity.lastOrderAt, now)) return "ordering";
  return activity.lastOrderAt ? "lapsed" : "never";
}

/** The setup steps a publisher still has to finish, in the order they matter. */
export function missingSetup(s: PublisherSetup): string[] {
  const missing: string[] = [];
  if (!s.payoutsEnabled) missing.push("Stripe payouts");
  if (!s.hasAddress) missing.push("Ships-from address");
  if (s.liveTitles === 0) missing.push("A live title");
  return missing;
}
