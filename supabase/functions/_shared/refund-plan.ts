/**
 * Decide how much of a Stripe charge to refund for one order.
 *
 * A checkout can pay for several orders with one payment intent. When the
 * order is the only one left unrefunded on its charge, the whole remaining
 * charge is refunded (shipping included), so stripe-webhook's full-refund path
 * marks it refunded and cancels its payouts. When other orders share the
 * charge, only this order's total is refunded and the rest stays with them.
 */

export interface RefundOrder {
  payment_method: string | null
  payment_status: string | null
  total_price: number | string
}

export interface RefundCharge {
  status?: string | null
  amount: number
  amount_refunded: number
  disputed?: boolean | null
}

export type RefundPlan =
  | { ok: true; amountCents: number; full: boolean }
  | { ok: false; error: string }

export function planRefund(
  order: RefundOrder,
  charge: RefundCharge | null,
  otherUnrefundedOrders: number,
): RefundPlan {
  if (order.payment_status === 'refunded') return { ok: false, error: 'This order has already been refunded.' }
  if (order.payment_status === 'disputed') {
    return { ok: false, error: 'This payment is disputed. Resolve it through the dispute in Stripe.' }
  }
  if (order.payment_method !== 'pay_now') {
    return { ok: false, error: 'This order is on invoice terms, so there is no card payment to refund here.' }
  }
  if (order.payment_status !== 'paid') return { ok: false, error: 'This order has not been paid, so there is nothing to refund.' }
  if (!charge || charge.status !== 'succeeded') return { ok: false, error: 'No successful Stripe charge was found for this order.' }
  if (charge.disputed) return { ok: false, error: 'This payment is disputed. Resolve it through the dispute in Stripe.' }

  const remaining = charge.amount - charge.amount_refunded
  if (remaining <= 0) return { ok: false, error: 'This payment has already been fully refunded in Stripe.' }

  if (otherUnrefundedOrders === 0) return { ok: true, amountCents: remaining, full: true }

  const orderCents = Math.round(Number(order.total_price) * 100)
  if (!(orderCents > 0)) return { ok: false, error: 'This order has no amount to refund.' }
  if (orderCents > remaining) {
    return { ok: false, error: 'Less is left on this payment than the order total. Refund it from Stripe instead.' }
  }
  return { ok: true, amountCents: orderCents, full: orderCents === remaining }
}
