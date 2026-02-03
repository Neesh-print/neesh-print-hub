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

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY not configured')
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16', // Using a stable version, matching others if possible
      httpClient: Stripe.createFetchHttpClient(),
    })

    // 1. Search for accounts with this email
    console.log(`Searching for Stripe accounts for email: ${user.email}`)
    const accounts = await stripe.accounts.list({
      email: user.email,
      limit: 10,
    })

    // Filter for accounts connected to this platform (Express)
    // In Express, the platform controls the account, so listing them with our SK returns them.
    const validAccounts = accounts.data.filter(acc => acc.type === 'express')

    if (validAccounts.length === 0) {
      console.log('No Stripe accounts found for this email')
      return new Response(
        JSON.stringify({ found: false, message: 'No accounts found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use the most recently created one?
    // Sort by created desc
    validAccounts.sort((a, b) => b.created - a.created)
    const matchedAccount = validAccounts[0]

    console.log(`Found account ${matchedAccount.id}, syncing to DB...`)

    // Update DB
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { error: updateError } = await supabaseAdmin
      .from('publishers')
      .update({ stripe_account_id: matchedAccount.id })
      .eq('user_id', user.id)

    if (updateError) {
      throw updateError
    }

    return new Response(
      JSON.stringify({ 
        found: true, 
        stripe_account_id: matchedAccount.id,
        restored: true 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in sync-stripe-account:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
