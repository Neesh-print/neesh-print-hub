import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the user is authenticated
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()

    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get publisher data
    const { data: publisherData, error: publisherError } = await supabaseClient
      .from('publishers')
      .select('id, user_id, company_name, stripe_account_id')
      .eq('id', user.id)
      .single()

    if (publisherError || !publisherData) {
      console.error('Publisher error:', publisherError)
      return new Response(
        JSON.stringify({ error: 'Publisher not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if they already have a Stripe account
    if (publisherData.stripe_account_id) {
      return new Response(
        JSON.stringify({ 
          error: 'Stripe account already exists',
          stripe_account_id: publisherData.stripe_account_id 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Stripe API key from environment
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'Payment service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Create Stripe Connect Express account
    try {
      console.log(`Creating Stripe account for publisher: ${publisherData.id}`)
      
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US', // Default to US, can be made configurable
        email: user.email,
        capabilities: {
          transfers: { requested: true },
        },
        business_profile: {
          name: publisherData.company_name || 'Publisher',
        },
      })


      console.log(`Created Stripe account: ${account.id}`)

      // CRITICAL: Save stripe_account_id to database using service role
      // We need service role because RLS policies might prevent user from updating their own record
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      )

      const { error: updateError } = await supabaseAdmin
        .from('publishers')
        .update({ stripe_account_id: account.id })
        .eq('id', publisherData.id)

      if (updateError) {
        console.error('Failed to save stripe_account_id:', updateError)
        // Return error to user - this is critical
        return new Response(
          JSON.stringify({ error: `Failed to save account to database: ${updateError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        console.log(`Saved stripe_account_id ${account.id} to publisher ${publisherData.id}`)
      }

      // Get site URL for return/refresh URLs
      const siteUrl = Deno.env.get('SITE_URL') || 'http://localhost:5173'

      // Create account link for onboarding
      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: `${siteUrl}/publisher/settings/payout`,
        return_url: `${siteUrl}/publisher/settings/payout?onboarding=complete`,
        type: 'account_onboarding',
      })

      return new Response(
        JSON.stringify({
          url: accountLink.url,
          stripe_account_id: account.id,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    } catch (stripeError) {
      console.error('Stripe error:', stripeError)
      return new Response(
        JSON.stringify({ error: 'Failed to create Stripe account: ' + stripeError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Error in create-stripe-account:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
