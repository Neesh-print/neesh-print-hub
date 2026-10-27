/**
 * Find the charge a publisher payout came from, so the Stripe transfer can
 * pass it as `source_transaction`.
 *
 * With a source_transaction, Stripe accepts the transfer right away even while
 * the order's funds are still pending in the platform balance. The publisher
 * sees the transfer immediately, and the money becomes available to them when
 * the charge settles. Without it, the transfer draws on the platform's
 * available balance and fails (or needs a top-up) until the order funds settle.
 *
 * Returns null when there is no usable charge, for example a net-terms order
 * paid by invoice, a session with no payment, or a charge that has not
 * succeeded. Callers then fall back to a plain transfer from the balance.
 */

type Expandable<T> = string | T | null | undefined

interface ChargeLike {
  id: string
  status?: string | null
  currency?: string | null
}

interface PaymentIntentLike {
  id: string
  latest_charge?: Expandable<ChargeLike>
}

interface SessionLike {
  payment_intent?: Expandable<PaymentIntentLike>
}

export interface SourceChargeStripe {
  checkout: {
    sessions: {
      retrieve(id: string, params: { expand: string[] }): Promise<SessionLike>
    }
  }
}

export interface SourceCharge {
  chargeId: string
}

/** Pull a usable charge out of an expanded Checkout Session. */
export function chargeFromSession(session: SessionLike | null | undefined, currency = 'usd'): SourceCharge | null {
  const pi = session?.payment_intent
  if (!pi || typeof pi === 'string') return null
  const charge = pi.latest_charge
  if (!charge || typeof charge === 'string') return null
  // A transfer can only be tied to a charge that succeeded (card charges
  // succeed at checkout; ACH debits stay pending for days).
  if (charge.status !== 'succeeded') return null
  if (charge.currency && charge.currency.toLowerCase() !== currency.toLowerCase()) return null
  return { chargeId: charge.id }
}

/**
 * Look up the source charge for a checkout session. Never throws: any Stripe
 * error is logged and treated as "no source charge", so a payout is never
 * blocked by this lookup.
 */
export async function findSourceCharge(
  stripe: SourceChargeStripe,
  sessionId: string | null | undefined,
  currency = 'usd',
): Promise<SourceCharge | null> {
  if (!sessionId) return null
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent.latest_charge'],
    })
    return chargeFromSession(session, currency)
  } catch (err) {
    console.warn(`source charge lookup failed for session ${sessionId}:`, err instanceof Error ? err.message : err)
    return null
  }
}
