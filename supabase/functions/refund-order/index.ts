import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno'
import { missingPaymentMessage, planRefund } from '../_shared/refund-plan.ts'

// Refunds one order's card payment in Stripe (Admin > Orders > Issue Refund).
//
// POST { orderId, preview? }. With preview: true nothing is refunded; the
// response says how much would be, for the confirmation dialog.
//
// The order is updated here as well as by stripe-webhook's charge.refunded
// handler, so the admin sees the result straight away and a payout can't be
// released in the gap before the webhook lands. Both updates are idempotent.

const ALLOWED_ORIGINS = [
  'https://neesh.art',
  'https://www.neesh.art',
  'https://app.neesh.art',
  'https://neesh-experimental.vercel.app',
  'http://localhost:8081',
];

function getCorsHeaders(origin: string | null) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin || '') ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!stripeKey || !supabaseUrl || !supabaseServiceKey) {
      return json({ error: 'Server configuration error' }, 500)
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2026-01-28.clover',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Verify admin auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role !== 'admin') return json({ error: 'Admin access required' }, 403)

    const { orderId, preview } = await req.json().catch(() => ({}))
    if (typeof orderId !== 'string' || !orderId) return json({ error: 'orderId is required' }, 400)

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, payment_intent_id, stripe_session_id, payment_method, payment_status, status, total_price, tracking_number, shipment_id')
      .eq('id', orderId)
      .maybeSingle()
    if (orderError) throw orderError
    if (!order) return json({ error: 'Order not found' }, 404)
    if (!order.payment_intent_id) return json({ error: 'This order has no Stripe payment to refund.' }, 400)

    const { count: others, error: othersError } = await supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('payment_intent_id', order.payment_intent_id)
      .neq('id', order.id)
      .neq('payment_status', 'refunded')
    if (othersError) throw othersError

    let pi: Stripe.PaymentIntent
    try {
      pi = await stripe.paymentIntents.retrieve(order.payment_intent_id, { expand: ['latest_charge'] })
    } catch (error) {
      if ((error as { code?: string }).code === 'resource_missing') {
        return json({ error: missingPaymentMessage(order.stripe_session_id, order.payment_intent_id) }, 409)
      }
      throw error
    }
    const charge = pi.latest_charge && typeof pi.latest_charge !== 'string' ? pi.latest_charge : null

    const plan = planRefund(order, charge, others ?? 0)
    if (!plan.ok) return json({ error: plan.error }, 409)

    const result = { amount: plan.amountCents / 100, full: plan.full, sharedPayment: (others ?? 0) > 0 }
    if (preview) return json(result)

    // The idempotency key makes a double click (or a retry after a timeout)
    // return the same refund instead of refunding twice.
    const refund = await stripe.refunds.create(
      {
        payment_intent: order.payment_intent_id,
        amount: plan.amountCents,
        reason: 'requested_by_customer',
        metadata: { neesh_order_id: order.id, refunded_by: user.id },
      },
      { idempotencyKey: `refund-order-${order.id}-${plan.amountCents}` },
    )
    if (refund.status === 'failed' || refund.status === 'canceled') {
      return json({ error: `Stripe could not refund this payment (${refund.failure_reason ?? refund.status}).` }, 502)
    }

    const now = new Date().toISOString()
    const { error: paidError } = await supabaseAdmin
      .from('orders')
      .update({ payment_status: 'refunded', updated_at: now })
      .eq('id', order.id)
    if (paidError) throw paidError

    // Same rule as stripe-webhook: cancel anything that hasn't left. Packed
    // with tracking may already be in the post, so it keeps its status.
    const unshipped = ['pending', 'paid'].includes(order.status) || (order.status === 'processing' && !order.tracking_number)
    if (unshipped) {
      const { error: cancelError } = await supabaseAdmin
        .from('orders')
        .update({ status: 'cancelled', updated_at: now })
        .eq('id', order.id)
      if (cancelError) throw cancelError
    }

    // Stop this order's payouts. A full refund also covers its shipment's
    // shipping payout; on a shared payment that shipping stays as it is.
    const payoutFilter = plan.full && order.shipment_id
      ? `order_id.eq.${order.id},shipment_id.eq.${order.shipment_id}`
      : `order_id.eq.${order.id}`
    const { data: stopped, error: stopError } = await supabaseAdmin
      .from('publisher_transfers')
      .update({ status: 'cancelled', hold_reason: null, failure_reason: 'Order refunded' })
      .or(payoutFilter)
      .eq('status', 'pending')
      .select('id')
    if (stopError) throw stopError

    const { data: flagged, error: flagError } = await supabaseAdmin
      .from('publisher_transfers')
      .update({ reversal_needed: true, reversal_reason: 'Order refunded after payout' })
      .or(payoutFilter)
      .in('status', ['processing', 'transferred'])
      .gt('net_amount', 0)
      .select('id')
    if (flagError) throw flagError

    if (plan.full) {
      await supabaseAdmin.from('payment_sessions').update({ refund_id: refund.id }).eq('payment_intent_id', order.payment_intent_id)
    }

    console.log(
      `Refunded order ${order.id}: ${refund.id} for ${plan.amountCents} cents (full: ${plan.full}); ` +
        `${stopped?.length ?? 0} payouts stopped, ${flagged?.length ?? 0} need reversal`,
    )

    return json({
      ...result,
      refundId: refund.id,
      cancelled: unshipped,
      payoutsStopped: stopped?.length ?? 0,
      payoutsNeedReversal: flagged?.length ?? 0,
    })
  } catch (error) {
    console.error('refund-order failed:', error)
    const message = error instanceof Error ? error.message : 'Refund failed'
    return json({ error: message }, 500)
  }
})
