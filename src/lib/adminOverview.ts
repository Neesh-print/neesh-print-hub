import { differenceInCalendarDays, isSameDay, startOfDay, subDays } from "date-fns";
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
  | "needs_tracking"
  | "ready"
  | "blocked"
  | "held"
  | "sending"
  | "paid_out"
  | "failed"
  | "cancelled";

export type OrderProblem = "no_address" | "late" | "stuck_packed" | "payout_failed" | "payment_issue";

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
  /** orders.payment_status: paid, refunded, disputed, invoiced, overdue, written_off... */
  paymentStatus: string | null;
  quantity: number;
  total: number;
  title: string;
  issue: string | null;
  publisherId: string | null;
  publisherName: string;
  /** The publisher's login, for messages. */
  publisherUserId: string | null;
  /** Stripe payouts enabled on the publisher's connected account. */
  publisherCanBePaid: boolean;
  spaceId: string | null;
  spaceName: string;
  /** Neesh's own buying account (retailers.is_internal, e.g. NWM Collections). */
  spaceIsInternal: boolean;
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
  needs_tracking: "Needs tracking",
  ready: "Ready",
  blocked: "Blocked",
  held: "On hold",
  sending: "Sending",
  paid_out: "Paid out",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const money = (n: number) => `$${n.toFixed(2)}`;

export const stageOf = (status: string | null | undefined): OrderStage =>
  STAGE_BY_STATUS[status ?? ""] ?? "unpaid";

/** Payment problems that undo or put a sale in doubt. */
const PAYMENT_ISSUES = ["refunded", "disputed", "overdue", "written_off"];
/** Payments that mean the money is gone, so the order isn't a sale. */
const NOT_A_SALE = ["refunded", "written_off"];

/** A sale: paid for, not cancelled or returned, and not refunded or written off. */
export const isCountedSale = (o: OverviewOrder) =>
  SALE_STATUSES.includes(o.status) && !NOT_A_SALE.includes(o.paymentStatus ?? "");

/** Neesh keeps 10% from the space and 10% from the publisher: 0.2 / 1.1 of what the space paid. */
export const FEE_SHARE = 0.2 / 1.1;

/** The recorded platform fee when the order has a payout, else the standard share. */
export const feeOf = (o: OverviewOrder) => o.transfer?.fee ?? o.total * FEE_SHARE;

/**
 * Whether the parcel is on its way: shipped or delivered, or packed with a
 * tracking number. Packed by hand without tracking doesn't count, so an
 * admin's "Mark packed" alone never makes a payout releasable.
 */
const isOnItsWay = (o: OverviewOrder) => {
  const stage = stageOf(o.status);
  return stage === "shipped" || stage === "delivered" || (stage === "packed" && !!o.trackingNumber?.trim());
};

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
  const stage = stageOf(order.status);
  // Not shipped yet (or never will be): nothing is owed right now.
  if (stage !== "packed" && stage !== "shipped" && stage !== "delivered") return "waiting";
  if (!order.publisherCanBePaid) return "blocked";
  return isOnItsWay(order) ? "ready" : "needs_tracking";
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
  if (PAYMENT_ISSUES.includes(order.paymentStatus ?? "") && stage !== "cancelled") problems.push("payment_issue");
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

const isSale = isCountedSale;
const sum =(values: number[]) => values.reduce((a, b) => a + b, 0);

export interface BlockedPublisher {
  publisherId: string | null;
  publisherUserId: string | null;
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

export interface SummaryOptions {
  /**
   * Leave internal orders out of the 7-day numbers. They still need shipping
   * and paying out, so the To ship and Payouts lists always include them.
   */
  excludeInternal?: boolean;
}

export function summarizeToday(orders: OverviewOrder[], now: Date, options: SummaryOptions = {}): TodaySummary {
  const reporting = options.excludeInternal ? orders.filter((o) => !o.spaceIsInternal) : orders;

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
      publisherUserId: o.publisherUserId,
      publisherName: o.publisherName,
      amount: 0,
      orderCount: 0,
    };
    entry.amount += o.transfer.net;
    entry.orderCount += 1;
    blockedByPublisher.set(key, entry);
  }

  // Today plus the 6 days before it, the same window as Insights' "7 days".
  const weekAgo = startOfDay(subDays(now, 6));
  const quarterAgo = subDays(now, 90);
  const recentSales = reporting.filter((o) => isSale(o) && new Date(o.createdAt) >= weekAgo);
  const paidOutThisWeek = reporting.filter(
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
      fees7d: sum(recentSales.map(feeOf)),
      paidOut7d: sum(paidOutThisWeek.map((o) => o.transfer!.net)),
      paidOutTo: [...new Set(paidOutThisWeek.map((o) => o.publisherName))],
      spacesOrdering90d: new Set(
        reporting.filter((o) => isSale(o) && o.spaceId && new Date(o.createdAt) >= quarterAgo).map((o) => o.spaceId),
      ).size,
    },
    activity,
  };
}
