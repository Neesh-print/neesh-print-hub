import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno'
import {
  BRAND_URL,
  button,
  formatDate,
  html as emailHtml,
  lineItems,
  money,
  panel,
  renderEmail,
  strong,
} from '../_shared/email.ts'

const ALLOWED_ORIGINS = [
  'https://neesh.art',
  'https://www.neesh.art',
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

interface NetOrderRequest {
  cart_items: CartItem[]
  terms_days: 14 | 30
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    // ============================================================
    // SECURITY: Require retailer authentication
    // ============================================================
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json(401, { error: 'Unauthorized - Missing authorization header' })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return json(401, { error: 'Unauthorized - Invalid authentication' })
    }

    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || !userData || userData.role !== 'retailer') {
      return json(403, { error: 'Forbidden - Retailer access required' })
    }

    // ============================================================
    // Parse & validate request
    // ============================================================
    const body: NetOrderRequest = await req.json()

    if (!body.cart_items || body.cart_items.length === 0) {
      return json(400, { error: 'Cart is empty' })
    }
    if (body.cart_items.length > 50) {
      return json(400, { error: 'Cart cannot exceed 50 items' })
    }

    const termsDays = body.terms_days
    if (termsDays !== 14 && termsDays !== 30) {
      return json(400, { error: 'terms_days must be 14 or 30' })
    }

    for (const item of body.cart_items) {
      if (!item.magazine_id || typeof item.quantity !== 'number') {
        return json(400, { error: 'Invalid cart item format' })
      }
      if (item.quantity <= 0 || item.quantity > 10000) {
        return json(400, { error: 'Invalid quantity' })
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.magazine_id)) {
        return json(400, { error: 'Invalid magazine ID' })
      }
    }

    // ============================================================
    // Service config
    // ============================================================
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!stripeKey || !supabaseUrl || !supabaseServiceKey) {
      console.error('create-net-order not configured')
      return json(500, { error: 'Payment service not configured' })
    }

    const stripe = new Stripe(stripeKey, {
      // @ts-ignore: User specified version
      apiVersion: '2026-01-28.clover',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // ============================================================
    // Terms eligibility + credit gate
    // ============================================================
    const { data: retailerRow, error: retailerError } = await supabaseAdmin
      .from('retailers')
      .select('id, payment_terms_enabled, net_terms_days, terms_status, credit_limit, email_verified_at')
      .eq('user_id', user.id)
      .single()

    if (retailerError || !retailerRow) {
      return json(404, { error: 'Retailer profile not found' })
    }
    // Same gate as create-checkout: no orders until the shop email is verified.
    if (!retailerRow.email_verified_at) {
      return json(403, {
        code: 'email_unverified',
        error: 'Please confirm your email address before placing your first order. Check your inbox for the confirmation link.',
      })
    }
    if (!retailerRow.payment_terms_enabled || retailerRow.terms_status !== 'approved') {
      return json(403, { error: 'Your account is not approved for payment terms.' })
    }
    if (termsDays > (retailerRow.net_terms_days ?? 0)) {
      return json(400, { error: `Net ${termsDays} is not available on your account.` })
    }

    // ============================================================
    // Fetch magazines & compute prices (SECURITY: never trust client prices)
    // ============================================================
    const magazineIds = body.cart_items.map(i => i.magazine_id)
    const { data: magazines, error: magazinesError } = await supabaseAdmin
      .from('magazines')
      .select('id, title, wholesale_price, cover_image_url, publisher_id, inventory_count, minimum_order_quantity, fulfillment_method')
      .in('id', magazineIds)
      .eq('is_active', true)

    if (magazinesError) {
      console.error('Error fetching magazines:', magazinesError)
      return json(500, { error: 'Failed to fetch magazine data' })
    }
    if (!magazines || magazines.length === 0) {
      return json(400, { error: 'No valid magazines found in cart' })
    }

    const magazineMap = new Map(magazines.map(m => [m.id, m]))

    interface Line {
      magazine_id: string
      publisher_id: string
      title: string
      quantity: number
      wholesale_price: number
      retailer_unit_price: number   // dollars
      retailer_unit_cents: number
      line_total: number            // dollars
    }

    const lines: Line[] = []
    let subtotalDollars = 0

    for (const item of body.cart_items) {
      const magazine = magazineMap.get(item.magazine_id)
      if (!magazine) {
        return json(400, { error: `Magazine ${item.magazine_id} not found or not available` })
      }
      if (!magazine.wholesale_price) {
        return json(400, { error: `Magazine "${magazine.title}" does not have a wholesale price set` })
      }
      const minOrderQty = magazine.minimum_order_quantity || 1
      if (item.quantity < minOrderQty) {
        return json(400, {
          error: `"${magazine.title}" requires a minimum order of ${minOrderQty} copies. You have ${item.quantity} in your cart.`,
        })
      }
      if (magazine.fulfillment_method === 'publisher_handled') {
        if (magazine.inventory_count !== null && magazine.inventory_count < item.quantity) {
          return json(400, { error: `Insufficient inventory for "${magazine.title}". Available: ${magazine.inventory_count}` })
        }
      }

      const wholesalePrice = magazine.wholesale_price
      const retailerUnitCents = Math.round(wholesalePrice * 1.10 * 100)
      const retailerUnitPrice = retailerUnitCents / 100
      const lineTotal = Math.round(retailerUnitPrice * item.quantity * 100) / 100
      subtotalDollars = Math.round((subtotalDollars + lineTotal) * 100) / 100

      lines.push({
        magazine_id: magazine.id,
        publisher_id: magazine.publisher_id,
        title: magazine.title,
        quantity: item.quantity,
        wholesale_price: wholesalePrice,
        retailer_unit_price: retailerUnitPrice,
        retailer_unit_cents: retailerUnitCents,
        line_total: lineTotal,
      })
    }

    // Credit gate (tax not yet known; check against subtotal — a conservative
    // pre-tax check. Stripe Tax is added at finalize; the invoice total may be
    // slightly higher, which is acceptable for the pilot.)
    const { data: outstanding, error: balError } = await supabaseAdmin
      .rpc('retailer_outstanding_balance', { p_retailer_id: user.id })
    if (balError) {
      console.error('Balance check failed:', balError)
      return json(500, { error: 'Could not verify available credit' })
    }
    const creditLimit = Number(retailerRow.credit_limit ?? 0)
    const outstandingNum = Number(outstanding ?? 0)
    if (outstandingNum + subtotalDollars > creditLimit) {
      return json(400, {
        error: 'This order exceeds your available credit. Pay an open invoice or pay now.',
        available_credit: Math.max(0, creditLimit - outstandingNum),
      })
    }

    // ============================================================
    // Ensure a Stripe customer with an address (required for Stripe Tax)
    // ============================================================
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    let stripeCustomerId: string | undefined = profile?.stripe_customer_id || undefined

    if (stripeCustomerId) {
      try {
        const customer = await stripe.customers.retrieve(stripeCustomerId)
        if ((customer as Stripe.DeletedCustomer).deleted) stripeCustomerId = undefined
      } catch {
        stripeCustomerId = undefined
      }
    }

    const { data: shippingAddr } = await supabaseAdmin
      .from('shipping_addresses')
      .select('recipient_name, company_name, address_line_1, address_line_2, city, state, postal_code, country, phone')
      .eq('retailer_id', retailerRow.id)
      .eq('is_default', true)
      .maybeSingle()

    if (!shippingAddr) {
      return json(400, {
        error: 'Please add a default shipping address before ordering on terms (needed for invoicing and tax).',
      })
    }

    const countryCode = COUNTRY_MAP[shippingAddr.country] || shippingAddr.country || 'US'
    const addressData = {
      line1: shippingAddr.address_line_1,
      line2: shippingAddr.address_line_2 || undefined,
      city: shippingAddr.city,
      state: shippingAddr.state,
      postal_code: shippingAddr.postal_code,
      country: countryCode,
    }
    const shippingData = {
      name: shippingAddr.recipient_name,
      phone: shippingAddr.phone || undefined,
      address: addressData,
    }

    if (stripeCustomerId) {
      await stripe.customers.update(stripeCustomerId, { address: addressData, shipping: shippingData })
    } else {
      const customer = await stripe.customers.create({
        email: user.email!,
        name: shippingAddr.recipient_name,
        phone: shippingAddr.phone || undefined,
        address: addressData,
        shipping: shippingData,
      })
      stripeCustomerId = customer.id
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_customer_id: customer.id })
        .eq('user_id', user.id)
    }

    // ============================================================
    // Create local invoice header (draft) + orders + held transfers
    // ============================================================
    const dueAt = new Date(Date.now() + termsDays * 86400_000).toISOString()

    const { data: inv, error: invError } = await supabaseAdmin
      .from('invoices')
      .insert({
        retailer_id: user.id,
        stripe_customer_id: stripeCustomerId,
        terms_days: termsDays,
        subtotal: subtotalDollars,
        total: subtotalDollars,
        amount_due: subtotalDollars,
        status: 'draft',
        due_at: dueAt,
      })
      .select('id')
      .single()

    if (invError || !inv) {
      console.error('Failed to create invoice header:', invError)
      return json(500, { error: 'Failed to create invoice' })
    }

    // Rollback helper: void the local invoice + related rows if Stripe fails.
    const rollback = async (reason: string) => {
      console.error(`Rolling back invoice ${inv.id}: ${reason}`)
      await supabaseAdmin.from('publisher_transfers')
        .update({ status: 'failed', failure_reason: reason, hold_reason: null })
        .eq('invoice_id', inv.id)
      await supabaseAdmin.from('orders')
        .update({ status: 'cancelled', payment_status: 'unpaid' })
        .eq('invoice_id', inv.id)
      await supabaseAdmin.from('invoices')
        .update({ status: 'void' })
        .eq('id', inv.id)
    }

    for (const line of lines) {
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert({
          retailer_id: user.id,
          magazine_id: line.magazine_id,
          quantity: line.quantity,
          unit_price: line.retailer_unit_price,
          total_price: line.line_total,
          status: 'confirmed',
          payment_method: `net${termsDays}`,
          payment_status: 'invoiced',
          invoice_id: inv.id,
          due_date: dueAt,
        })
        .select('id')
        .single()

      if (orderError || !order) {
        await rollback('Order creation failed')
        return json(500, { error: 'Failed to create order' })
      }

      // Commit inventory (goods are reserved once the order is placed).
      const { error: invDecErr } = await supabaseAdmin.rpc('decrease_inventory', {
        p_magazine_id: line.magazine_id,
        p_quantity: line.quantity,
      })
      if (invDecErr) {
        console.error(`decrease_inventory failed for ${line.title}:`, invDecErr)
      }

      // Held publisher transfer — released only when the invoice is paid.
      const platformFee = Math.round((line.line_total - line.wholesale_price * line.quantity) * 100) / 100
      const netAmount = Math.round(line.wholesale_price * line.quantity * 100) / 100
      const { error: transferError } = await supabaseAdmin
        .from('publisher_transfers')
        .upsert({
          publisher_id: line.publisher_id,
          order_id: order.id,
          invoice_id: inv.id,
          gross_amount: line.line_total,
          platform_fee: platformFee,
          net_amount: netAmount,
          status: 'pending',
          hold_reason: 'awaiting_invoice_payment',
        }, { onConflict: 'order_id', ignoreDuplicates: true })

      if (transferError) {
        console.error(`Failed to insert held transfer for order ${order.id}:`, transferError)
      }
    }

    // ============================================================
    // Create, finalize & send the Stripe invoice
    // ============================================================
    let finalized: Stripe.Invoice
    try {
      const stripeInvoice = await stripe.invoices.create({
        customer: stripeCustomerId,
        collection_method: 'send_invoice',
        days_until_due: termsDays,
        auto_advance: true,
        automatic_tax: { enabled: true },
        payment_settings: { payment_method_types: ['card', 'us_bank_account'] },
        metadata: { neesh_invoice_id: inv.id, retailer_id: user.id },
      }, { idempotencyKey: `net-order-${inv.id}` })

      for (const line of lines) {
        await stripe.invoiceItems.create({
          customer: stripeCustomerId,
          invoice: stripeInvoice.id,
          currency: 'usd',
          unit_amount: line.retailer_unit_cents,
          quantity: line.quantity,
          description: line.title,
        })
      }

      finalized = await stripe.invoices.finalizeInvoice(stripeInvoice.id)
      await stripe.invoices.sendInvoice(stripeInvoice.id)
    } catch (stripeErr) {
      await rollback(stripeErr instanceof Error ? stripeErr.message : 'Stripe invoice error')
      return json(502, { error: 'Failed to issue invoice with Stripe. No charge was made; please try again.' })
    }

    // Persist Stripe identifiers & finalized totals back to our invoice row.
    await supabaseAdmin
      .from('invoices')
      .update({
        stripe_invoice_id: finalized.id,
        hosted_invoice_url: finalized.hosted_invoice_url,
        invoice_pdf_url: finalized.invoice_pdf,
        status: 'open',
        issued_at: new Date().toISOString(),
        due_at: finalized.due_date ? new Date(finalized.due_date * 1000).toISOString() : dueAt,
        subtotal: (finalized.subtotal ?? 0) / 100,
        tax: Math.max(0, ((finalized.total ?? 0) - (finalized.subtotal ?? 0))) / 100,
        total: (finalized.total ?? 0) / 100,
        amount_due: (finalized.amount_due ?? 0) / 100,
      })
      .eq('id', inv.id)

    // ============================================================
    // Notify publishers: new order, payout delayed until retailer pays
    // ============================================================
    try {
      const byPublisher = new Map<string, Line[]>()
      for (const line of lines) {
        if (!byPublisher.has(line.publisher_id)) byPublisher.set(line.publisher_id, [])
        byPublisher.get(line.publisher_id)!.push(line)
      }
      const retailerShopName = shippingAddr.company_name || shippingAddr.recipient_name || 'a retailer'
      for (const [publisherId, plines] of byPublisher) {
        const { data: publisher } = await supabaseAdmin
          .from('publishers')
          .select('company_name, user_id')
          .eq('id', publisherId)
          .single()
        if (!publisher) continue
        const { data: pubUser } = await supabaseAdmin
          .from('users')
          .select('email')
          .eq('id', publisher.user_id)
          .single()
        if (pubUser?.email) {
          await sendNetOrderPublisherEmail(
            pubUser.email,
            publisher.company_name || 'Publisher',
            retailerShopName,
            termsDays,
            new Date(dueAt),
            plines.map(l => ({ title: l.title, quantity: l.quantity, net_amount: Math.round(l.wholesale_price * l.quantity * 100) / 100 })),
          )
        }
      }
    } catch (emailErr) {
      console.error('Publisher notification failed (non-fatal):', emailErr)
    }

    return json(200, {
      success: true,
      invoice_id: inv.id,
      hosted_invoice_url: finalized.hosted_invoice_url,
      total: (finalized.total ?? 0) / 100,
      due_at: finalized.due_date ? new Date(finalized.due_date * 1000).toISOString() : dueAt,
    })

  } catch (error) {
    console.error('Error in create-net-order:', error)
    return json(500, { error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

// ------------------------------------------------------------------
// Publisher email: new net-terms order, payout is delayed
// ------------------------------------------------------------------
interface NetLine { title: string; quantity: number; net_amount: number }

async function sendNetOrderPublisherEmail(
  publisherEmail: string,
  publisherName: string,
  retailerName: string,
  termsDays: number,
  dueDate: Date,
  lines: NetLine[],
) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    console.error('RESEND_API_KEY not configured')
    return
  }

  const netTotal = lines.reduce((s, l) => s + l.net_amount, 0)
  const copies = lines.reduce((s, l) => s + l.quantity, 0)
  const dueStr = formatDate(dueDate)

  const html = renderEmail({
    preheader: `${retailerName} ordered ${copies} ${copies === 1 ? 'copy' : 'copies'} on Net ${termsDays} terms. Ship as normal.`,
    label: `Publisher · Net ${termsDays}`,
    eyebrow: 'New wholesale order',
    heading: `Your ${lines.length > 1 ? 'magazines are' : 'magazine is'} going to ${retailerName}.`,
    intro: `Hi ${publisherName}, a retailer just ordered from your catalog on payment terms. Ship on your normal schedule and add tracking in your dashboard.`,
    blocks: [
      lineItems(
        lines.map((l) => ({ title: l.title, quantity: l.quantity, amount: l.net_amount })),
        { amountLabel: 'Your payout', total: { label: 'Total payout', amount: netTotal } }
      ),
      panel(
        emailHtml`The retailer has until ${strong(dueStr)} to pay. Your payout of ${strong(money(netTotal))} is released automatically once their invoice is paid.`,
        `Net ${termsDays} payment terms`
      ),
      button('Add tracking', `${BRAND_URL}/publisher/orders`),
    ],
  })

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Neesh <hi@neesh.art>',
        to: publisherEmail,
        subject: `New order from ${retailerName} (Net ${termsDays})`,
        reply_to: 'hi@neesh.art',
        html,
      }),
    })
    if (!response.ok) console.error('Failed to send publisher email:', await response.text())
  } catch (error) {
    console.error('Error sending publisher email:', error)
  }
}
