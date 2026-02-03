import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Parse request body
    const { amount } = await req.json()
    if (!amount || amount <= 0) {
        throw new Error('Invalid amount');
    }

    // Get Publisher's Stripe Account ID
    const { data: publisher, error: pubError } = await supabaseClient
      .from('publishers')
      .select('stripe_account_id')
      .eq('id', user.id)
      .single()

    if (pubError || !publisher?.stripe_account_id) {
       throw new Error('No connected Stripe account');
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY not configured')
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Create Payout
    // Note: This only works if the connected account has manual payouts enabled or sufficient balance.
    // Express accounts often have automatic payouts, so manual creation might fail with "managed by platform" or similar if not configured.
    // However, we'll attempt it. If it fails, we'll return the error.
    
    // Amount is in cents
    const payout = await stripe.payouts.create({
        amount: Math.round(amount * 100),
        currency: 'usd',
    }, {
        stripeAccount: publisher.stripe_account_id
    });

    return new Response(
      JSON.stringify(payout),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error creating payout:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
