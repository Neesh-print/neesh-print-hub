import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno'

const ALLOWED_ORIGINS = [
  'https://neesh.art',
  'https://www.neesh.art',
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

    const { transferIds } = await req.json()

    if (!Array.isArray(transferIds) || transferIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'transferIds must be a non-empty array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results: { id: string; success: boolean; stripe_transfer_id?: string; error?: string }[] = []

    for (const transferId of transferIds) {
      try {
        // Fetch the transfer record with publisher info
        const { data: transfer, error: fetchError } = await supabaseAdmin
          .from('publisher_transfers')
          .select(`
            id, order_id, net_amount, status,
            publishers!inner (
              id, stripe_account_id, company_name
            )
          `)
          .eq('id', transferId)
          .single()

        if (fetchError || !transfer) {
          results.push({ id: transferId, success: false, error: 'Transfer not found' })
          continue
        }

        if (transfer.status !== 'pending') {
          results.push({ id: transferId, success: false, error: `Transfer already ${transfer.status}` })
          continue
        }

        const publisher = transfer.publishers as any
        if (!publisher?.stripe_account_id) {
          // Mark as failed - publisher hasn't completed Stripe onboarding
          await supabaseAdmin
            .from('publisher_transfers')
            .update({
              status: 'failed',
              failure_reason: 'Publisher has no connected Stripe account',
              released_by: user.id,
              released_at: new Date().toISOString(),
            })
            .eq('id', transferId)

          results.push({ id: transferId, success: false, error: 'Publisher has no connected Stripe account' })
          continue
        }

        // Execute the Stripe transfer
        const amountInCents = Math.round(transfer.net_amount * 100)

        const stripeTransfer = await stripe.transfers.create({
          amount: amountInCents,
          currency: 'usd',
          destination: publisher.stripe_account_id,
          transfer_group: transfer.order_id,
          description: `Neesh payout for order ${transfer.order_id}`,
        })

        // Mark as transferred
        await supabaseAdmin
          .from('publisher_transfers')
          .update({
            status: 'transferred',
            stripe_transfer_id: stripeTransfer.id,
            released_by: user.id,
            released_at: new Date().toISOString(),
            transferred_at: new Date().toISOString(),
          })
          .eq('id', transferId)

        console.log(`Transfer ${transferId} completed: ${stripeTransfer.id} → ${publisher.company_name}`)
        results.push({ id: transferId, success: true, stripe_transfer_id: stripeTransfer.id })

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        console.error(`Transfer ${transferId} failed:`, errorMessage)

        // Mark as failed
        await supabaseAdmin
          .from('publisher_transfers')
          .update({
            status: 'failed',
            failure_reason: errorMessage,
            released_by: user.id,
            released_at: new Date().toISOString(),
          })
          .eq('id', transferId)

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
