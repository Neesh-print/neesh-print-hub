import { differenceInCalendarDays, isSameDay, subDays } from "date-fns";
import { SALE_STATUSES } from "@/lib/orderStatus";

/**
 * Admin v2: one place that turns orders, payouts and publishers into what the
 * Today and Orders screens show. Every count on those screens comes from here,
 * so two screens can't disagree about the same order.
 *
 * Order lifecycle: To ship (paid) → Packed (tracking added, stored as
 * `processing`) → Shipped (first carrier scan) → Delivered. A publisher's
 * payout is ready from Packed on.
 */

export type OrderStage =
  | "unpaid"
  | "to_ship"
  | "packed"
  | "shipped"
  | "delivered"
  | "returned"
  | "cancelled";

export type PayoutState =
  | "none"
  | "waiting"
  | "ready"
  | "blocked"
  | "held"
  | "sending"
  | "paid_out"
  | "failed"
  | "cancelled";

export type OrderProblem = "no_address" | "late" | "stuck_packed" | "payout_failed";

/** Days an order can sit in To ship or Packed before it counts as a problem. */
export const LATE_AFTER_DAYS = 3;

export interface OverviewTransfer {
  id: string;
  status: string;
  net: number;
  fee: number;
  holdReason: string | null;
  failureReason: string | null;
  transferredAt: string | null;
}

export interface OverviewOrder {
  id: string;
  ref: string;
  createdAt: string;
  updatedAt: string | null;
  status: string;
  quantity: number;
  total: number;
  title: string;
  issue: string | null;
  publisherId: string | null;
  publisherName: string;
  /** Stripe payouts enabled on the publisher's connected account. */
  publisherCanBePaid: boolean;
  spaceId: string | null;
  spaceName: string;
  hasAddress: boolean;
  carrier: string | null;
  trackingNumber: string | null;
  transfer: OverviewTransfer | null;
}

const STAGE_BY_STATUS: Record<string, OrderStage> = {
  pending: "unpaid",
  paid: "to_ship",
  processing: "packed",
  shipped: "shipped",
  delivered: "delivered",
  returned: "returned",
  cancelled: "cancelled",
};

export const STAGE_LABEL: Record<OrderStage, string> = {
  unpaid: "Awaiting payment",
  to_ship: "To ship",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  returned: "Returned",
  cancelled: "Cancelled",
};

export const PAYOUT_LABEL: Record<PayoutState, string> = {
  none: "No payout",
  waiting: "After packing",
  ready: "Ready",
  blocked: "Blocked",
  held: "On hold",
  sending: "Sending",
  paid_out: "Paid out",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const money = (n: number) => `$${n.toFixed(2)}`;

export const stageOf =(status: string | null | undefined): OrderStage =>
  STAGE_BY_STATUS[status ?? ""] ?? "unpaid";

const PAYABLE_STAGES: OrderStage[] = ["packed", "shipped", "delivered"];

export function payoutStateOf(order: OverviewOrder): PayoutState {
  const t = order.transfer;
  if (!t) return "none";
  switch (t.status) {
    case "transferred":
      return "paid_out";
    case "failed":
      return "failed";
    case "processing":
      return "sending";
    case "cancelled":
      return "cancelled";
  }
  if (t.holdReason) return "held";
  if (!order.publisherCanBePaid) return "blocked";
  return PAYABLE_STAGES.includes(stageOf(order.status)) ? "ready" : "waiting";
}

/** Whole days since the order was placed. */
export const ageInDays = (order: OverviewOrder, now: Date) =>
  differenceInCalendarDays(now, new Date(order.createdAt));

export function problemsOf(order: OverviewOrder, now: Date): OrderProblem[] {
  const stage = stageOf(order.status);
  const problems: OrderProblem[] = [];
  if (stage === "to_ship" && !order.hasAddress) problems.push("no_address");
  else if (stage === "to_ship" && ageInDays(order, now) >= LATE_AFTER_DAYS) problems.push("late");
  if (stage === "packed") {
    const since = new Date(order.updatedAt ?? order.createdAt);
    if (differenceInCalendarDays(now, since) >= LATE_AFTER_DAYS) problems.push("stuck_packed");
  }
  if (payoutStateOf(order) === "failed") problems.push("payout_failed");
  return problems;
}

/** Order views on the Orders screen; each is a tab. */
export type OrderView = "all" | "to_ship" | "packed" | "shipped" | "delivered" | "payout_ready" | "problems";

export function inView(order: OverviewOrder, view: OrderView, now: Date): boolean {
  const stage = stageOf(order.status);
  switch (view) {
    case "all":
      return true;
    case "to_ship":
    case "packed":
    case "shipped":
    case "delivered":
      return stage === view;
    case "payout_ready":
      return payoutStateOf(order) === "ready";
    case "problems":
      return problemsOf(order, now).length > 0;
  }
}

const isSale = (order: OverviewOrder) => SALE_STATUSES.includes(order.status);
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export interface BlockedPublisher {
  publisherId: string | null;
  publisherName: string;
  amount: number;
  orderCount: number;
}

export interface TodaySummary {
  toShip: OverviewOrder[];
  ready: OverviewOrder[];
  failed: OverviewOrder[];
  blocked: BlockedPublisher[];
  stuckPacked: OverviewOrder[];
  pulse: {
    sales7d: number;
    orders7d: number;
    fees7d: number;
    paidOut7d: number;
    paidOutTo: string[];
    spacesOrdering90d: number;
  };
  activity: { at: string; text: string }[];
}

/** Items on the Today screen that wait on an admin; the nav badge shows the same number. */
export const needsYouCount = (today: TodaySummary, applicationsWaiting: number) =>
  today.toShip.length +
  today.stuckPacked.length +
  today.ready.length +
  today.failed.length +
  today.blocked.length +
  applicationsWaiting;

/** Severity order for the To ship list: late first, then fresh, then no address. */
const toShipRank = (order: OverviewOrder, now: Date) => {
  const problems = problemsOf(order, now);
  if (problems.includes("late")) return 0;
  if (problems.includes("no_address")) return 2;
  return 1;
};

export function summarizeToday(orders: OverviewOrder[], now: Date): TodaySummary {
  const toShip = orders
    .filter((o) => stageOf(o.status) === "to_ship")
    .sort((a, b) => toShipRank(a, now) - toShipRank(b, now) || a.createdAt.localeCompare(b.createdAt));

  const ready = orders.filter((o) => payoutStateOf(o) === "ready");
  const failed = orders.filter((o) => payoutStateOf(o) === "failed");
  const stuckPacked = orders.filter((o) => problemsOf(o, now).includes("stuck_packed"));

  const blockedByPublisher = new Map<string, BlockedPublisher>();
  for (const o of orders) {
    if (payoutStateOf(o) !== "blocked" || !o.transfer) continue;
    const key = o.publisherId ?? o.publisherName;
    const entry = blockedByPublisher.get(key) ?? {
      publisherId: o.publisherId,
      publisherName: o.publisherName,
      amount: 0,
      orderCount: 0,
    };
    entry.amount += o.transfer.net;
    entry.orderCount += 1;
    blockedByPublisher.set(key, entry);
  }

  const weekAgo = subDays(now, 7);
  const quarterAgo = subDays(now, 90);
  const recentSales = orders.filter((o) => isSale(o) && new Date(o.createdAt) >= weekAgo);
  const paidOutThisWeek = orders.filter(
    (o) => o.transfer?.status === "transferred" && o.transfer.transferredAt && new Date(o.transfer.transferredAt) >= weekAgo,
  );

  const activity: { at: string; text: string }[] = [];
  for (const o of orders) {
    if (o.transfer?.transferredAt && isSameDay(new Date(o.transfer.transferredAt), now)) {
      activity.push({ at: o.transfer.transferredAt, text: `${o.publisherName} paid out $${o.transfer.net.toFixed(2)}` });
    }
    const stage = stageOf(o.status);
    if (o.updatedAt && isSameDay(new Date(o.updatedAt), now) && (stage === "packed" || stage === "shipped" || stage === "delivered")) {
      const how = o.carrier ? ` (${o.carrier})` : "";
      activity.push({ at: o.updatedAt, text: `${o.publisherName}: ${o.title} ${STAGE_LABEL[stage].toLowerCase()}${how}` });
    }
  }
  activity.sort((a, b) => b.at.localeCompare(a.at));

  return {
    toShip,
    ready,
    failed,
    blocked: [...blockedByPublisher.values()].sort((a, b) => b.amount - a.amount),
    stuckPacked,
    pulse: {
      sales7d: sum(recentSales.map((o) => o.total)),
      orders7d: recentSales.length,
      fees7d: sum(recentSales.map((o) => o.transfer?.fee ?? 0)),
      paidOut7d: sum(paidOutThisWeek.map((o) => o.transfer!.net)),
      paidOutTo: [...new Set(paidOutThisWeek.map((o) => o.publisherName))],
      spacesOrdering90d: new Set(
        orders.filter((o) => isSale(o) && o.spaceId && new Date(o.createdAt) >= quarterAgo).map((o) => o.spaceId),
      ).size,
    },
    activity,
  };
}
