import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno'
import { createShippoClient } from '../_shared/shippo.ts'
import { quoteCart, resolveRetailerDestination, shippingV2Enabled, type QuoteGroup } from '../_shared/shipping-quote.ts'
import { countryName, countryShortName, normalizeCountry, spaceUnitPrice } from '../_shared/shipping.ts'

const ALLOWED_ORIGINS = [
  'https://neesh.art',
  'https://www.neesh.art',
  'https://app.neesh.art',
  'https://neesh-experimental.vercel.app',
  'http://localhost:8081',
];

const COUNTRY_MAP: Record<string, string> = {
  'United States': 'US',
  'United Kingdom': 'GB',
  'Canada': 'CA',
  'Germany': 'DE',
  'France': 'FR',
  'Australia': 'AU',
  'Netherlands': 'NL',
  'New Zealand': 'NZ',
  'Ireland': 'IE',
  'Italy': 'IT',
  'Spain': 'ES',
  'Japan': 'JP',
  'Singapore': 'SG',
};

function getCorsHeaders(origin: string | null) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin || '') ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

interface CartItem {
  magazine_id: string
  quantity: number
}

interface CheckoutRequest {
  cart_items: CartItem[]
  /** Quote ids from quote-shipping. Only used to reuse a matching, unexpired quote; amounts are never taken from the client. */
  quote_ids?: string[]
  success_url?: string
  cancel_url?: string
}

/** Stripe tax code for shipping, so automatic_tax treats the line as shipping. */
const SHIPPING_TAX_CODE = 'txcd_92010001'

/** Why a publisher group cannot be checked out, in the words the cart uses. */
function blockedMessage(g: QuoteGroup): string {
  switch (g.blocked_reason) {
    case 'minimum':
      if (g.title_shortfalls.length > 0) {
        const t = g.title_shortfalls[0]
        return `"${t.title}" has a minimum of ${t.minimum} copies. Add ${t.short} more.`
      }
      return `${countryShortName(g.destination_country)} minimum ${g.intl_minimum} copies from ${g.publisher_name}. Add ${g.intl_short} more.`
    case 'no_international':
      return `${g.publisher_name} doesn't ship to ${countryName(g.destination_country)} yet. Remove their titles to check out.`
    case 'no_origin':
      return `${g.publisher_name} hasn't set where they ship from yet, so shipping can't be quoted. Remove their titles to check out.`
    case 'missing_weight':
      return `A title from ${g.publisher_name} is missing its weight, so shipping can't be quoted. Remove it to check out.`
    case 'no_rate':
      return `We couldn't get a shipping rate from ${g.publisher_name} to your address. Try again shortly, or remove their titles.`
    default:
      return `Titles from ${g.publisher_name} aren't available right now.`
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // ============================================================
    // SECURITY: Require retailer authentication
    // ============================================================
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
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is retailer
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || !userData || userData.role !== 'retailer') {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Retailer access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Instant-access signups can browse right away but must confirm their
    // email (retailers.email_verified_at) before placing their first order.
    const { data: retailerRow, error: retailerRowError } = await supabaseClient
      .from('retailers')
      .select('email_verified_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (retailerRowError || !retailerRow?.email_verified_at) {
      if (retailerRowError) console.error('Error checking email verification:', retailerRowError)
      return new Response(
        JSON.stringify({
          success: false,
          code: 'email_unverified',
          error: 'Please confirm your email address before placing your first order. Check your inbox for the confirmation link.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    // ============================================================

    // Parse request body
    const checkoutRequest: CheckoutRequest = await req.json()

    // Validate cart items
    if (!checkoutRequest.cart_items || checkoutRequest.cart_items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Cart is empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (checkoutRequest.cart_items.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Cart cannot exceed 50 items' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Input Validation
    for (const item of checkoutRequest.cart_items) {
      if (!item.magazine_id || typeof item.quantity !== 'number') {
        return new Response(
          JSON.stringify({ error: 'Invalid cart item format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      if (item.quantity <= 0 || item.quantity > 10000) {
        return new Response(
          JSON.stringify({ error: 'Invalid quantity' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      // Basic UUID validation
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.magazine_id)) {
        return new Response(
            JSON.stringify({ error: 'Invalid magazine ID' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
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
      // @ts-ignore: User specified version
      apiVersion: '2026-01-28.clover',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Fetch real magazine prices from database (SECURITY: Don't trust client prices!)
    const magazineIds = checkoutRequest.cart_items.map(item => item.magazine_id)
    const { data: magazines, error: magazinesError } = await supabaseClient
      .from('magazines')
      .select('id, title, wholesale_price, cover_image_url, publisher_id, inventory_count, minimum_order_quantity, fulfillment_method')
      .in('id', magazineIds)
      .eq('is_active', true)

    if (magazinesError) {
      console.error('Error fetching magazines:', magazinesError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch magazine data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!magazines || magazines.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid magazines found in cart' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create a map of magazine data for quick lookup
    const magazineMap = new Map(magazines.map(m => [m.id, m]))

    // Validate all cart items have valid magazines
    for (const item of checkoutRequest.cart_items) {
      if (!magazineMap.has(item.magazine_id)) {
        return new Response(
          JSON.stringify({ error: `Magazine ${item.magazine_id} not found or not available` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const magazine = magazineMap.get(item.magazine_id)!
      if (!magazine.wholesale_price) {
        return new Response(
          JSON.stringify({ error: `Magazine "${magazine.title}" does not have a wholesale price set` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check minimum order quantity
      const minOrderQty = magazine.minimum_order_quantity || 1
      if (item.quantity < minOrderQty) {
        return new Response(
          JSON.stringify({ 
            error: `"${magazine.title}" requires a minimum order of ${minOrderQty} copies. You have ${item.quantity} in your cart.` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check inventory for publisher-handled fulfillment
      if (magazine.fulfillment_method === 'publisher_handled') {
        if (magazine.inventory_count !== null && magazine.inventory_count < item.quantity) {
          return new Response(
            JSON.stringify({ error: `Insufficient inventory for "${magazine.title}". Available: ${magazine.inventory_count}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    // --- shipping_v2: server-side shipping quote per publisher (T6, T18) ---
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const shippingV2 = await shippingV2Enabled(supabaseAdmin)
    let shippingGroups: QuoteGroup[] = []

    if (shippingV2) {
      const destination = await resolveRetailerDestination(supabaseAdmin, user.id)
      if (!destination) {
        return new Response(
          JSON.stringify({ success: false, code: 'needs_address', error: 'Add your shipping address in the cart before checking out.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const shippoKey = Deno.env.get('SHIPPO_API_KEY')
      const quote = await quoteCart({
        admin: supabaseAdmin,
        shippo: shippoKey ? createShippoClient(shippoKey) : null,
        items: checkoutRequest.cart_items,
        destination,
        retailerUserId: user.id,
        persist: true,
        reuseQuoteIds: (checkoutRequest.quote_ids ?? []).filter((id) => typeof id === 'string').slice(0, 50),
      })
      const blocked = quote.groups.find((g) => !g.can_ship || g.shipping_usd === null)
      if (blocked) {
        return new Response(
          JSON.stringify({ success: false, code: 'shipping_blocked', publisher_id: blocked.publisher_id, error: blockedMessage(blocked) }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      shippingGroups = quote.groups
    }

    // Build Stripe line items with REAL prices from database
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
    let totalAmount = 0

    for (const item of checkoutRequest.cart_items) {
      const magazine = magazineMap.get(item.magazine_id)!

      // Retailer price: wholesale x 1.10, in cents (shared rule, T2)
      const wholesalePrice = magazine.wholesale_price!
      const retailerPrice = Math.round(spaceUnitPrice(wholesalePrice) * 100)

      totalAmount += retailerPrice * item.quantity

      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: magazine.title,
            images: magazine.cover_image_url ? [magazine.cover_image_url] : [],
            metadata: {
              magazine_id: magazine.id,
              publisher_id: magazine.publisher_id,
              // Removed wholesale_price from metadata to prevent exposure
            },
          },
          unit_amount: retailerPrice, // Price in cents
        },
        quantity: item.quantity,
      })
    }

    // Prepare metadata for the checkout session
    // SECURITY: Limit metadata size and only include necessary fields
    // Use minimized keys to fit more items within Stripe's 500 char metadata limit
    const minimizedCart = checkoutRequest.cart_items.map(item => ({
        id: item.magazine_id,
        qty: item.quantity
    }));

    const cartString = JSON.stringify(minimizedCart);

    // Check if metadata is too large for Stripe (limit is 500 chars per value)
    if (cartString.length > 480) {
         return new Response(
            JSON.stringify({ error: 'Cart too large for payment processing. Please reduce the number of items.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // One shipping line per publisher (T6). Shipping passes through with no Neesh fee.
    for (const g of shippingGroups) {
      const cents = Math.round((g.shipping_usd ?? 0) * 100)
      totalAmount += cents
      lineItems.push({
        price_data: {
          currency: 'usd',
          tax_behavior: 'exclusive',
          product_data: {
            name: `Shipping from ${g.publisher_name}`,
            tax_code: SHIPPING_TAX_CODE,
            metadata: { publisher_id: g.publisher_id, quote_id: g.quote_id ?? '' },
          },
          unit_amount: cents,
        },
        quantity: 1,
      })
    }

    const metadata: Record<string, string> = {
      retailer_id: user.id,
      cart_items: cartString, // Use minimized format to stay within Stripe's 500 char limit
      order_type: 'magazine_purchase',
    }
    if (shippingV2) {
      const quoteIds = shippingGroups.map((g) => g.quote_id).filter(Boolean).join(',')
      if (quoteIds.length > 480 || shippingGroups.some((g) => !g.quote_id)) {
        return new Response(
          JSON.stringify({ error: 'Could not save the shipping quote. Please try again.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      metadata.shipping_v2 = '1'
      metadata.quote_ids = quoteIds
    }

    // Create Stripe Checkout Session
    const origin = req.headers.get('origin') || 'http://localhost:8081'

    // --- Shipping Address & Customer Handling ---
    let stripeCustomerId: string | undefined
    try {
      // 1. Get existing Stripe Customer ID
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .single()

      if (profile?.stripe_customer_id) {
        stripeCustomerId = profile.stripe_customer_id
        
        // Verify customer exists in current mode (Test vs Live)
        try {
            const customer = await stripe.customers.retrieve(stripeCustomerId);
            if (customer.deleted) {
                console.warn(`Customer ${stripeCustomerId} was deleted in Stripe. Creating new one.`);
                stripeCustomerId = undefined;
            }
        } catch (error) {
            console.warn(`Customer ${stripeCustomerId} not found in Stripe (likely mode mismatch). Creating new one.`);
            stripeCustomerId = undefined;
        }
      }

      // 2. Try to sync local shipping address to Stripe Customer
      const { data: retailer } = await supabaseClient
        .from('retailers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (retailer) {
        // Use maybeSingle to avoid error if no default address exists
        const { data: shippingAddr } = await supabaseClient
          .from('shipping_addresses')
          .select('recipient_name, company_name, address_line_1, address_line_2, city, state, postal_code, country, phone')
          .eq('retailer_id', retailer.id)
          .eq('is_default', true)
          .maybeSingle()

        if (shippingAddr) {
          // Map country name to ISO code for Stripe (expanded mapping)
          const countryCode = COUNTRY_MAP[shippingAddr.country] || normalizeCountry(shippingAddr.country) || 'US'
          const shippingData = {
            name: shippingAddr.recipient_name,
            phone: shippingAddr.phone || undefined,
            address: {
              line1: shippingAddr.address_line_1,
              line2: shippingAddr.address_line_2 || undefined,
              city: shippingAddr.city,
              state: shippingAddr.state,
              postal_code: shippingAddr.postal_code,
              country: countryCode,
            },
          }

          if (stripeCustomerId) {
            // Update existing Stripe customer with latest address
            await stripe.customers.update(stripeCustomerId, {
              shipping: shippingData,
            })
          } else {
            // Create new Stripe customer and save ID to profile
            const customer = await stripe.customers.create({
              email: user.email!,
              name: shippingAddr.recipient_name,
              phone: shippingAddr.phone || undefined,
              shipping: shippingData,
            })
            stripeCustomerId = customer.id

            // Save Stripe customer ID for future checkouts
            await supabaseClient
              .from('profiles')
              .update({ stripe_customer_id: customer.id })
              .eq('user_id', user.id)
          }
        }
      }
    } catch (addrErr) {
      // Non-fatal: continue without pre-filled address
      console.warn('Address sync failed, proceeding with existing customer ID if available:', addrErr)
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      line_items: lineItems,
      success_url: checkoutRequest.success_url || `${origin}/retailer/order-confirmation/{CHECKOUT_SESSION_ID}`,
      cancel_url: checkoutRequest.cancel_url || `${origin}/retailer/cart`,
      metadata,
      payment_intent_data: {
        metadata, // Also add to payment intent
      },
      // Enable automatic tax calculation
      automatic_tax: { enabled: true },
    }

    if (shippingV2) {
      // The address is locked to the one the shipping was quoted for. The space
      // changes it in the cart, not in Stripe (T6). Tax uses the customer's
      // saved shipping address.
      if (!stripeCustomerId) {
        return new Response(
          JSON.stringify({ error: 'Could not attach your shipping address to the payment. Please try again.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      sessionParams.customer = stripeCustomerId
      // Billing address entered at payment is saved on the customer, which
      // automatic tax needs when there is no shipping address step.
      sessionParams.customer_update = { address: 'auto' }
    } else {
      // Always show shipping address form (pre-filled if customer has one on record)
      sessionParams.shipping_address_collection = {
        allowed_countries: ['US', 'CA', 'GB', 'DE', 'FR', 'AU', 'NL', 'NZ', 'IE', 'IT', 'ES', 'JP', 'SG'],
      }
      if (stripeCustomerId) {
        sessionParams.customer = stripeCustomerId
        // Save any address changes back to the customer record
        sessionParams.customer_update = { shipping: 'auto' }
      } else {
        sessionParams.customer_email = user.email!
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    // Store the checkout session in payment_sessions table
    const { error: sessionError } = await supabaseClient
      .from('payment_sessions')
      .insert({
        user_id: user.id,
        session_id: session.id,
        amount: totalAmount / 100, // Store in dollars
        status: 'pending',
        metadata: {
          cart_items: checkoutRequest.cart_items,
          checkout_url: session.url,
          ...(shippingV2 ? { shipping_v2: true, shipping_quotes: shippingGroups } : {}),
        },
      })

    if (sessionError) {
      console.error('Error storing payment session:', sessionError)
      // Non-fatal - checkout session was created successfully
    }

    return new Response(
      JSON.stringify({
        success: true,
        checkout_url: session.url,
        session_id: session.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in create-checkout:', error)
    const corsHeaders = getCorsHeaders(req.headers.get('origin'));
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
