import type { StatusType } from "@/components/neesh/StatusBadge";

/**
 * One place that maps what `orders.status` stores to what the admin UI shows.
 *
 * Stored values (orders_status_check): pending, paid, processing, shipped,
 * delivered, returned, cancelled. `paid` is the state a checkout leaves an
 * order in, so it is what "needs fulfillment" means. `processing` is used as
 * "packed". Payment status (`orders.payment_status`) is separate and is not
 * handled here.
 */
export type OrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "returned"
  | "cancelled";

/** Orders that still need to be packed and shipped. */
export const NEEDS_FULFILLMENT_STATUSES: readonly string[] = ["paid"];
/** Orders packed and waiting for a label / tracking. */
export const PACKED_STATUSES: readonly string[] = ["processing"];
/** Orders that have left the publisher. */
export const SHIPPED_STATUSES: readonly string[] = ["shipped", "delivered"];

export const PACKED_STATUS: OrderStatus = "processing";

export const needsFulfillment = (status: string | null | undefined) =>
  NEEDS_FULFILLMENT_STATUSES.includes(status ?? "");
export const isPacked = (status: string | null | undefined) =>
  PACKED_STATUSES.includes(status ?? "");
export const isShippedOrDelivered = (status: string | null | undefined) =>
  SHIPPED_STATUSES.includes(status ?? "");

const orderStatusDisplay: Record<OrderStatus, { badge: StatusType; label: string }> = {
  pending: { badge: "payment-pending", label: "AWAITING PAYMENT" },
  paid: { badge: "unfulfilled", label: "NEEDS FULFILLMENT" },
  processing: { badge: "pending", label: "PACKED" },
  shipped: { badge: "shipped", label: "SHIPPED" },
  delivered: { badge: "delivered", label: "DELIVERED" },
  returned: { badge: "returned", label: "RETURNED" },
  cancelled: { badge: "cancelled", label: "CANCELLED" },
};

/** Badge props for an order's fulfillment state: `<StatusBadge {...orderStatusBadge(s)} />`. */
export const orderStatusBadge = (status: string | null | undefined): { status: StatusType; label: string } => {
  const display = orderStatusDisplay[(status ?? "") as OrderStatus];
  if (!display) return { status: "pending", label: (status || "UNKNOWN").toUpperCase() };
  return { status: display.badge, label: display.label };
};

/** Options for the admin "Update Fulfillment Status" control. */
export const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "paid", label: "Needs fulfillment" },
  { value: "processing", label: "Packed" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "returned", label: "Returned" },
  { value: "cancelled", label: "Cancelled" },
];

/** Stable, human-readable reference for an order: first 8 characters of its ID. */
export const formatOrderRef = (id: string | null | undefined) =>
  id ? `#${id.slice(0, 8).toUpperCase()}` : "#—";

/** Statuses that count as a sale (paid for and not cancelled or returned). */
export const SALE_STATUSES: readonly string[] = ["paid", "processing", "shipped", "delivered"];
export const isSale = (status: string | null | undefined) => SALE_STATUSES.includes(status ?? "");
