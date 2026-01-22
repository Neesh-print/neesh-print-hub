import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CartItem {
  magazine_id: string
  quantity: number
}

interface CheckoutRequest {
  cart_items: CartItem[]
  success_url?: string
  cancel_url?: string
}

Deno.serve(async (req) => {
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

    console.log(`Creating checkout for user ${user.id} with ${checkoutRequest.cart_items.length} items`)

    // Fetch real magazine prices from database (SECURITY: Don't trust client prices!)
    const magazineIds = checkoutRequest.cart_items.map(item => item.magazine_id)
    const { data: magazines, error: magazinesError } = await supabaseClient
      .from('magazines')
      .select('id, title, wholesale_price, cover_image_url, publisher_id, inventory_count')
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

      // Check inventory
      if (magazine.inventory_count !== null && magazine.inventory_count < item.quantity) {
        return new Response(
          JSON.stringify({ error: `Insufficient inventory for "${magazine.title}". Available: ${magazine.inventory_count}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Build Stripe line items with REAL prices from database
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
    let totalAmount = 0

    for (const item of checkoutRequest.cart_items) {
      const magazine = magazineMap.get(item.magazine_id)!

      // Calculate retailer price: wholesale + 10%
      const wholesalePrice = magazine.wholesale_price!
      const retailerPrice = Math.round(wholesalePrice * 1.10 * 100) // Convert to cents and add 10%

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
            },
          },
          unit_amount: retailerPrice, // Price in cents
        },
        quantity: item.quantity,
      })
    }

    console.log(`Total amount: $${totalAmount / 100}, Items: ${lineItems.length}`)

    // Prepare metadata for the checkout session
    const metadata: Record<string, string> = {
      retailer_id: user.id,
      cart_items: JSON.stringify(checkoutRequest.cart_items),
      order_type: 'magazine_purchase',
    }

    // Create Stripe Checkout Session
    const origin = req.headers.get('origin') || 'http://localhost:8080'
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: checkoutRequest.success_url || `${origin}/retailer/order-confirmation/{CHECKOUT_SESSION_ID}`,
      cancel_url: checkoutRequest.cancel_url || `${origin}/retailer/cart`,
      customer_email: user.email,
      metadata,
      payment_intent_data: {
        metadata, // Also add to payment intent
      },
      // Enable automatic tax calculation if needed
      // automatic_tax: { enabled: true },
    })

    console.log(`Checkout session created: ${session.id}`)

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
