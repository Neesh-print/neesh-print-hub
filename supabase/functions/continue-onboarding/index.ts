import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno'

// Mints a brand new Stripe onboarding account link for the authenticated
// publisher and returns it. Account links expire after a short window, so this
// endpoint is the durable replacement for emailing raw Stripe URLs: the
// frontend /onboarding/continue route calls it every time and forwards the
// browser to the fresh link.
//
// - If the publisher has no connected account yet, one is created first.
// - refresh_url points back at /onboarding/continue, so an expired link
//   self-heals: Stripe bounces the browser here, the route calls this function
//   again, and a new link is minted.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Look up the publisher and any account they already have.
    const { data: publisherData, error: publisherError } = await supabaseClient
      .from('publishers')
      .select('id, company_name, stripe_account_id, website_url, description')
      .eq('user_id', user.id)
      .single()

    if (publisherError || !publisherData) {
      console.error('Publisher lookup failed:', publisherError)
      return new Response(
        JSON.stringify({ error: 'Publisher not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'Payment service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const stripe = new Stripe(stripeKey, {
      // @ts-ignore: User specified version
      apiVersion: '2026-01-28.clover',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Service-role client for writes (RLS may block the user from updating their
    // own row; this matches create-stripe-account).
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let accountId = publisherData.stripe_account_id as string | null

    // If a stored account id is stale (deleted in Stripe), clear it so we create
    // a fresh one below instead of failing.
    if (accountId) {
      try {
        const existing = await stripe.accounts.retrieve(accountId)
        if ((existing as { deleted?: boolean }).deleted) {
          console.log(`Stored account ${accountId} is deleted; clearing.`)
          accountId = null
          await supabaseAdmin.from('publishers').update({ stripe_account_id: null }).eq('id', publisherData.id)
        }
      } catch (retrieveErr) {
        if (retrieveErr.code === 'resource_missing' || retrieveErr.message?.includes('No such account')) {
          console.log(`Stored account ${accountId} no longer exists; clearing.`)
          accountId = null
          await supabaseAdmin.from('publishers').update({ stripe_account_id: null }).eq('id', publisherData.id)
        } else {
          throw retrieveErr
        }
      }
    }

    // No usable account — create one. Prefill everything we already know so the
    // publisher types as little as possible during Stripe onboarding.
    if (!accountId) {
      console.log(`Creating Stripe Express account for publisher ${publisherData.id}`)

      const url = normalizeUrl(publisherData.website_url)
      const productDescription = cleanDescription(publisherData.description)

      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: user.email ?? undefined,
        capabilities: {
          transfers: { requested: true },
        },
        business_profile: {
          name: publisherData.company_name || 'Publisher',
          ...(url ? { url } : {}),
          ...(productDescription ? { product_description: productDescription } : {}),
        },
      })
      accountId = account.id

      const { error: saveError } = await supabaseAdmin
        .from('publishers')
        .update({ stripe_account_id: accountId })
        .eq('id', publisherData.id)

      if (saveError) {
        console.error('Failed to save stripe_account_id:', saveError)
        return new Response(
          JSON.stringify({ error: `Failed to save account: ${saveError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      console.log(`Created and saved account ${accountId}`)
    }

    // Mint a fresh onboarding link. refresh_url self-heals an expired link.
    const origin = req.headers.get('origin')
    const siteUrl = origin || Deno.env.get('SITE_URL') || 'http://localhost:5173'

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${siteUrl}/onboarding/continue`,
      return_url: `${siteUrl}/publisher/settings/payout?onboarding=complete`,
      type: 'account_onboarding',
    })

    return new Response(
      JSON.stringify({ url: accountLink.url, stripe_account_id: accountId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in continue-onboarding:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Stripe's business_profile.url must be an absolute http(s) URL. Publisher
// websites are stored loosely (bare domains, missing scheme), so coerce them
// into a valid form and drop anything that still doesn't look like a URL.
function normalizeUrl(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  let value = raw.trim()
  if (!value) return undefined
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`
  }
  try {
    const parsed = new URL(value)
    // Must have a dotted host (e.g. example.com), not just "https://foo".
    if (!parsed.hostname.includes('.')) return undefined
    return parsed.toString()
  } catch {
    return undefined
  }
}

// Stripe caps product_description length; trim whitespace and cap defensively.
function cleanDescription(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  const value = raw.trim()
  if (!value) return undefined
  return value.length > 500 ? value.slice(0, 500) : value
}
