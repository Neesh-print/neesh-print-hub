import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno'

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

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!stripeKey || !supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const stripe = new Stripe(stripeKey, {
      // @ts-ignore: User specified version
      apiVersion: '2026-01-28.clover',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Verify admin auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify admin role
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // `force` lets an admin release a payout still held for an unpaid
    // net-terms invoice. It never overrides a refund or dispute hold.
    const { transferIds, force = false } = await req.json()

    // Holds that block release. NOT IN is false for NULL, so "no hold" is
    // listed separately.
    const blockingHolds = force
      ? 'refund_review,dispute'
      : 'refund_review,dispute,awaiting_invoice_payment'
    const releasableHoldFilter = `hold_reason.is.null,hold_reason.not.in.(${blockingHolds})`

    if (!Array.isArray(transferIds) || transferIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'transferIds must be a non-empty array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results: { id: string; success: boolean; stripe_transfer_id?: string; error?: string }[] = []

    // Dedupe so one request can't pay the same row twice.
    for (const transferId of new Set<string>(transferIds)) {
      // Set once this request owns the row (status = 'processing').
      let claimed = false

      try {
        // Claim the row: one conditional UPDATE moves it pending -> processing.
        // Postgres row locking means only one concurrent request can win; any
        // other request (double click, second admin, retry) matches 0 rows.
        // Rows held for refund review or a dispute are never claimable;
        // rows held for an unpaid invoice only with `force`.
        const { data: transfer, error: claimError } = await supabaseAdmin
          .from('publisher_transfers')
          .update({
            status: 'processing',
            released_by: user.id,
            released_at: new Date().toISOString(),
          })
          .eq('id', transferId)
          .eq('status', 'pending')
          .or(releasableHoldFilter)
          .select(`
            id, order_id, net_amount,
            publishers (
              id, stripe_account_id, company_name
            )
          `)
          .maybeSingle()

        if (claimError) {
          throw claimError
        }

        if (!transfer) {
          // Explain why the claim matched nothing.
          const { data: current } = await supabaseAdmin
            .from('publisher_transfers')
            .select('status, hold_reason')
            .eq('id', transferId)
            .maybeSingle()

          const reason = !current
            ? 'Transfer not found'
            : current.status !== 'pending'
              ? `Transfer already ${current.status}`
              : current.hold_reason === 'awaiting_invoice_payment'
                ? 'Held until the retailer pays the linked invoice. Use force to override.'
                : `Transfer is on hold (${current.hold_reason})`
          results.push({ id: transferId, success: false, error: reason })
          continue
        }
        claimed = true

        const publisher = transfer.publishers as any
        if (!publisher?.stripe_account_id) {
          // Mark as failed - publisher hasn't completed Stripe onboarding
          await supabaseAdmin
            .from('publisher_transfers')
            .update({
              status: 'failed',
              failure_reason: 'Publisher has no connected Stripe account',
            })
            .eq('id', transferId)

          results.push({ id: transferId, success: false, error: 'Publisher has no connected Stripe account' })
          continue
        }

        // Execute the Stripe transfer. The idempotency key is tied to this
        // ledger row, so if this request is retried (or a stuck 'processing'
        // row is retried by hand) Stripe returns the original transfer
        // instead of paying again.
        const amountInCents = Math.round(transfer.net_amount * 100)

        const stripeTransfer = await stripe.transfers.create({
          amount: amountInCents,
          currency: 'usd',
          destination: publisher.stripe_account_id,
          transfer_group: transfer.order_id,
          description: `Neesh payout for order ${transfer.order_id}`,
          metadata: { publisher_transfer_id: transfer.id, order_id: transfer.order_id },
        }, { idempotencyKey: `publisher-transfer-${transfer.id}` })

        // Mark as transferred
        await supabaseAdmin
          .from('publisher_transfers')
          .update({
            status: 'transferred',
            stripe_transfer_id: stripeTransfer.id,
            hold_reason: null,
            transferred_at: new Date().toISOString(),
          })
          .eq('id', transferId)

        console.log(`Transfer ${transferId} completed: ${stripeTransfer.id} → ${publisher.company_name}`)
        results.push({ id: transferId, success: true, stripe_transfer_id: stripeTransfer.id })

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        console.error(`Transfer ${transferId} failed:`, errorMessage)

        if (claimed) {
          // A Stripe API error (it answered with an error status) means no
          // money moved, so 'failed' is accurate. A network error or timeout
          // means we can't tell whether Stripe made the transfer, so leave
          // the row in 'processing' for an admin to check in Stripe rather
          // than marking it failed.
          const stripeAnswered = typeof (err as { statusCode?: number })?.statusCode === 'number'
          await supabaseAdmin
            .from('publisher_transfers')
            .update(
              stripeAnswered
                ? { status: 'failed', failure_reason: errorMessage }
                : { failure_reason: `Outcome unknown, check Stripe for transfer metadata publisher_transfer_id=${transferId}: ${errorMessage}` }
            )
            .eq('id', transferId)
        }

        results.push({ id: transferId, success: false, error: errorMessage })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return new Response(
      JSON.stringify({
        message: `${successCount} transferred, ${failCount} failed`,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in release-publisher-transfer:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
