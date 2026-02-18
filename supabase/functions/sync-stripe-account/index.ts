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
      // @ts-ignore: User specified version
      apiVersion: '2026-01-28.clover',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Search for connected Express accounts and try to match by email
    // Note: accounts.list doesn't support email filtering, so we paginate through accounts
    console.log(`Searching for Stripe accounts for email: ${user.email}`)

    try {
      let matchedAccount = null
      let hasMore = true
      let startingAfter: string | undefined = undefined

      // Paginate through connected accounts (limit search to avoid excessive API calls)
      let pages = 0
      const maxPages = 5

      while (hasMore && pages < maxPages) {
        const listParams: Record<string, unknown> = { limit: 100 }
        if (startingAfter) {
          listParams.starting_after = startingAfter
        }

        const accounts = await stripe.accounts.list(listParams)

        // Find express accounts matching this user's email
        const match = accounts.data.find(
          (acc: { type: string; email: string | null }) =>
            acc.type === 'express' && acc.email === user.email
        )

        if (match) {
          // Verify the account is still valid by trying to retrieve it
          try {
            const retrieved = await stripe.accounts.retrieve(match.id)
            if (retrieved && !retrieved.deleted) {
              matchedAccount = retrieved
            }
          } catch (retrieveErr) {
            console.log(`Account ${match.id} exists but is invalid:`, retrieveErr.message)
          }
          break
        }

        hasMore = accounts.has_more
        if (accounts.data.length > 0) {
          startingAfter = accounts.data[accounts.data.length - 1].id
        } else {
          hasMore = false
        }
        pages++
      }

      if (!matchedAccount) {
        console.log('No valid Stripe accounts found for this email')
        return new Response(
          JSON.stringify({ found: false, message: 'No accounts found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

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
        console.error('Failed to update publisher with stripe account:', updateError)
        return new Response(
          JSON.stringify({ found: false, message: 'Failed to save to database' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          found: true,
          stripe_account_id: matchedAccount.id,
          restored: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (stripeError) {
      // Sync is best-effort — don't crash with 500, just report not found
      console.error('Stripe search failed (non-fatal):', stripeError.message)
      return new Response(
        JSON.stringify({ found: false, message: 'Search failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Error in sync-stripe-account:', error)
    // Return a graceful "not found" instead of 500 — sync is best-effort
    return new Response(
      JSON.stringify({ found: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
