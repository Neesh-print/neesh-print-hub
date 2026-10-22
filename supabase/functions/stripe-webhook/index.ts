import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno'
import {
  BRAND_URL,
  type LineItem,
  button,
  details,
  formatDate,
  formatIssue,
  lineItems,
  money,
  reference,
  renderEmail,
  stats,
  steps,
} from '../_shared/email.ts'
import { generateOrderConfirmationEmail } from '../_shared/retailer-emails.ts'

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
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
    'Access-Control-Allow-Credentials': 'true',
  };
}

interface CartItem {
  magazine_id: string
  quantity: number
}

// Also accept minimized format from create-checkout metadata
interface MinimizedCartItem {
  id: string
  qty: number
}

Deno.serve(async (req) => {
  console.log('Stripe webhook request received');
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const signature = req.headers.get('Stripe-Signature')

  if (!signature) {
    return new Response('No signature', { status: 400, headers: corsHeaders })
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    const webhookSecretDirect = Deno.env.get('STRIPE_WEBHOOK_SECRET_DIRECT')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!stripeKey || (!webhookSecret && !webhookSecretDirect) || !supabaseUrl || !supabaseServiceKey) {
      console.error('Configuration missing:', {
        stripeKey: !!stripeKey,
        webhookSecret: !!webhookSecret,
        webhookSecretDirect: !!webhookSecretDirect,
        supabaseUrl: !!supabaseUrl,
        supabaseServiceKey: !!supabaseServiceKey
      })
      return new Response('Configuration Error', { status: 500, headers: corsHeaders })
    }

    const stripe = new Stripe(stripeKey, {
      // @ts-ignore: User specified version
      apiVersion: '2026-01-28.clover',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const body = await req.text()
    console.log('Request body length:', body.length);
    let event

    // Try both webhook secrets: one for Connect events, one for direct account events
    const secrets = [webhookSecret, webhookSecretDirect].filter(Boolean) as string[]
    let verified = false
    for (const secret of secrets) {
      try {
        event = await stripe.webhooks.constructEventAsync(body, signature, secret)
        console.log('Event constructed successfully:', event.type);
        verified = true
        break
      } catch (err) {
        console.log(`Signature check failed with secret ending ...${secret.slice(-4)}: ${err.message}`)
      }
    }

    if (!verified || !event) {
      console.warn('Webhook signature verification failed with all secrets')
      return new Response('Webhook Error: Signature verification failed', { status: 400, headers: corsHeaders })
    }

    // Initialize Supabase Admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    switch (event.type) {
      case 'checkout.session.completed': {
        const eventSession = event.data.object as Stripe.Checkout.Session
        let session = eventSession

        // Re-retrieve the session to guarantee all fields are populated
        // (webhook event payload may not always include all fields)
        try {
          session = await stripe.checkout.sessions.retrieve(session.id) as Stripe.Checkout.Session
        } catch (retrieveErr) {
          console.warn('Failed to re-retrieve session, using event data:', retrieveErr)
        }

        // In API version 2026-01-28.clover, shipping details moved to
        // collected_information.shipping_details (no longer top-level).
        // Check both the re-retrieved session AND the original event data
        // since the API retrieve may not include collected_information without expansion.
        const shippingInfo = (session as any).collected_information?.shipping_details
          || (session as any).shipping_details
          || (eventSession as any).collected_information?.shipping_details
          || (eventSession as any).shipping_details
          || null

        console.log(`Processing checkout session: ${session.id}`)
        console.log(`Shipping details present: ${!!shippingInfo}`)
        console.log(`Source: re-retrieved collected_info=${!!(session as any).collected_information?.shipping_details}, re-retrieved shipping_details=${!!(session as any).shipping_details}, event collected_info=${!!(eventSession as any).collected_information?.shipping_details}, event shipping_details=${!!(eventSession as any).shipping_details}`)
        if (shippingInfo) {
          console.log(`Shipping to: ${shippingInfo.name}, ${shippingInfo.address?.city}, ${shippingInfo.address?.state}`)
        }

        // Get metadata from the session
        const retailerId = session.metadata?.retailer_id
        const cartItemsJson = session.metadata?.cart_items

        if (!retailerId || !cartItemsJson) {
          console.error('Missing required metadata in session:', session.metadata)
          return new Response(
            JSON.stringify({ error: 'Invalid session metadata' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Idempotency check: Don't process if already handled
        const { data: existingSession } = await supabaseAdmin
            .from('payment_sessions')
            .select('status')
            .eq('session_id', session.id)
            .single();
        
        if (existingSession?.status === 'completed') {
             console.log(`Session ${session.id} already processed.`);

             // Backfill shipping address on existing orders (overwrite null or bad data)
             if (shippingInfo) {
               const backfillAddress = {
                 name: shippingInfo.name,
                 address: {
                   line1: shippingInfo.address?.line1,
                   line2: shippingInfo.address?.line2,
                   city: shippingInfo.address?.city,
                   state: shippingInfo.address?.state,
                   postal_code: shippingInfo.address?.postal_code,
                   country: shippingInfo.address?.country,
                 }
               }
               console.log('Backfill address data:', JSON.stringify(backfillAddress))
               const { data: updated, error: backfillErr } = await supabaseAdmin
                 .from('orders')
                 .update({ shipping_address: backfillAddress })
                 .eq('stripe_session_id', session.id)
                 .select('id')
               if (backfillErr) {
                 console.error('Shipping address backfill failed:', backfillErr)
               } else if (updated && updated.length > 0) {
                 console.log(`Backfilled shipping address on ${updated.length} order(s)`)
               } else {
                 console.log('Backfill matched 0 orders for session:', session.id)
               }
             } else {
               console.log('No shipping info found — cannot backfill')
             }

             return new Response(JSON.stringify({ received: true }), { headers: corsHeaders, status: 200 });
        }

        let cartItems: CartItem[];
        try {
             const parsed = JSON.parse(cartItemsJson);
             // Support both minimized format ({id, qty}) and full format ({magazine_id, quantity})
             cartItems = parsed.map((item: CartItem | MinimizedCartItem) => ({
               magazine_id: (item as CartItem).magazine_id || (item as MinimizedCartItem).id,
               quantity: (item as CartItem).quantity ?? (item as MinimizedCartItem).qty,
             }));
        } catch (e) {
             console.error('Failed to parse cart items JSON:', cartItemsJson);
             return new Response(JSON.stringify({ error: 'Invalid cart format' }), { status: 400, headers: corsHeaders });
        }

        // Fetch magazine details
        const magazineIds = cartItems.map(item => item.magazine_id)
        const { data: magazines, error: magazinesError } = await supabaseAdmin
          .from('magazines')
          .select('id, title, issue_number, wholesale_price, publisher_id, cover_image_url, fulfillment_method')
          .in('id', magazineIds)

        if (magazinesError || !magazines) {
          console.error('Error fetching magazines:', magazinesError)
          throw new Error('Failed to fetch magazine data')
        }

        const magazineMap = new Map(magazines.map(m => [m.id, m]))
        
        // Check for missing magazines
        for (const item of cartItems) {
            if (!magazineMap.has(item.magazine_id)) {
                console.error(`Magazine not found for ID: ${item.magazine_id}`);
                // We continue processing other items, but this is a serious data integrity issue
            }
        }


        // Create orders for each cart item
        const createdOrders: string[] = []
        const publisherEmails: Map<string, OrderNotificationItem[]> = new Map() // Group orders by publisher

        for (const item of cartItems) {
          const magazine = magazineMap.get(item.magazine_id)
          if (!magazine) {
            continue
          }

          // Calculate prices
          const wholesalePrice = magazine.wholesale_price || 0
          const retailerUnitPrice = Math.round(wholesalePrice * 1.10 * 100) / 100 // Add 10%
          const totalPrice = retailerUnitPrice * item.quantity

          // Extract shipping address from Stripe session
          // (uses shippingInfo resolved above — supports both old and clover API versions)
          const shippingAddress = shippingInfo ? {
            name: shippingInfo.name,
            address: {
              line1: shippingInfo.address?.line1,
              line2: shippingInfo.address?.line2,
              city: shippingInfo.address?.city,
              state: shippingInfo.address?.state,
              postal_code: shippingInfo.address?.postal_code,
              country: shippingInfo.address?.country,
            }
          } : null

          // Create order
          const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .insert({
              retailer_id: retailerId,
              magazine_id: item.magazine_id,
              quantity: item.quantity,
              unit_price: retailerUnitPrice,
              total_price: totalPrice,
              status: 'paid',
              stripe_session_id: session.id,
              payment_intent_id: session.payment_intent as string,
              shipping_address: shippingAddress, // Now supported by schema!
              stripe_payment_metadata: {
                customer_email: session.customer_email,
                payment_status: session.payment_status,
                amount_total: session.amount_total,
              },
            })
            .select('id')
            .single()

          if (orderError) {
            console.error('Error creating order:', orderError)
            // Log full error details for debugging
            console.error('Failed insert payload:', {
                retailer_id: retailerId,
                magazine_id: item.magazine_id,
                stripe_session_id: session.id
            });
            continue
          }

          console.log(`Created order: ${order.id}`)
          createdOrders.push(order.id)

          // Group orders by publisher for email notifications
          const publisherId = magazine.publisher_id
          if (!publisherEmails.has(publisherId)) {
            publisherEmails.set(publisherId, [])
          }
          publisherEmails.get(publisherId)!.push({
            order_id: order.id,
            magazine_title: magazine.title,
            issue_number: magazine.issue_number ?? null,
            quantity: item.quantity,
            total_price: totalPrice,
          })

          // Decrease inventory atomically
          try {
              // We use the new RPC function which is safe
              const { error: invError } = await supabaseAdmin.rpc('decrease_inventory', {
                p_magazine_id: item.magazine_id,
                p_quantity: item.quantity
              });
              
              if (invError) {
                  console.error(`RPC decrease_inventory failed for ${magazine.title}:`, invError);
              } else {
                  console.log(`Decreased inventory for ${magazine.title} by ${item.quantity}`);
              }

          } catch (invError) {
              console.error(`Failed to call decrease_inventory for ${magazine.title}:`, invError)
          }
        }

        // --- Insert pending publisher transfer records ---
        try {
          for (const item of cartItems) {
            const magazine = magazineMap.get(item.magazine_id)
            if (!magazine) continue

            // Find the order we just created for this magazine
            const { data: matchedOrder } = await supabaseAdmin
              .from('orders')
              .select('id')
              .eq('stripe_session_id', session.id)
              .eq('magazine_id', item.magazine_id)
              .single()

            if (!matchedOrder) {
              console.error(`No order found for magazine ${item.magazine_id} in session ${session.id}`)
              continue
            }

            const wholesalePrice = magazine.wholesale_price || 0
            const grossAmount = Math.round(wholesalePrice * 1.10 * item.quantity * 100) / 100
            const netAmount = Math.round(wholesalePrice * item.quantity * 100) / 100
            const platformFee = Math.round((grossAmount - netAmount) * 100) / 100

            const { error: transferError } = await supabaseAdmin
              .from('publisher_transfers')
              .upsert({
                publisher_id: magazine.publisher_id,
                order_id: matchedOrder.id,
                stripe_session_id: session.id,
                gross_amount: grossAmount,
                platform_fee: platformFee,
                net_amount: netAmount,
                status: 'pending',
              }, { onConflict: 'order_id', ignoreDuplicates: true })

            if (transferError) {
              console.error(`Failed to insert publisher transfer for order ${matchedOrder.id}:`, transferError)
            } else {
              console.log(`Created pending transfer for publisher ${magazine.publisher_id}, order ${matchedOrder.id}, net $${netAmount}`)
            }
          }
        } catch (transferInsertError) {
          // Non-blocking: log but don't fail the webhook
          console.error('Error inserting publisher transfer records:', transferInsertError)
        }

        // Update payment session status
        await supabaseAdmin
          .from('payment_sessions')
          .update({
            status: 'completed',
            payment_intent_id: session.payment_intent as string,
          })
          .eq('session_id', session.id)

        // Get retailer details for emails
        const { data: retailer } = await supabaseAdmin
          .from('users')
          .select('email, id')
          .eq('id', retailerId)
          .single()

        const { data: retailerProfile } = await supabaseAdmin
          .from('retailers')
          .select('shop_name')
          .eq('user_id', retailerId)
          .single()

        const retailerShopName = retailerProfile?.shop_name || retailer?.email || 'Unknown Retailer'

        // Resolve each publisher once: the admin email lists them per line,
        // and each publisher gets their own email.
        const publishers = new Map<string, { name: string; email: string | null }>()
        for (const publisherId of publisherEmails.keys()) {
          const { data: publisher } = await supabaseAdmin
            .from('publishers')
            .select('company_name, user_id')
            .eq('id', publisherId)
            .single()
          if (!publisher) continue

          const { data: publisherUser } = await supabaseAdmin
            .from('users')
            .select('email')
            .eq('id', publisher.user_id)
            .single()

          publishers.set(publisherId, {
            name: publisher.company_name || 'Publisher',
            email: publisherUser?.email ?? null,
          })
        }

        // Send email to admin (Gem)
        const adminEmail = Deno.env.get('ADMIN_EMAIL') || 'hi@neesh.art'
        const adminLines: LineItem[] = []
        for (const [publisherId, orders] of publisherEmails) {
          for (const o of orders) {
            adminLines.push({
              title: titleWithIssue(o),
              subtitle: publishers.get(publisherId)?.name,
              quantity: o.quantity,
              amount: o.total_price,
            })
          }
        }
        await sendOrderNotificationToAdmin(
          adminEmail,
          session.id,
          retailerShopName,
          adminLines,
          (session.amount_total || 0) / 100 // Convert to dollars
        )

        // Send emails to publishers
        for (const [publisherId, orders] of publisherEmails) {
          const publisher = publishers.get(publisherId)
          if (publisher?.email) {
            await sendOrderNotificationToPublisher(
              publisher.email,
              publisher.name,
              retailerShopName,
              orders
            )
          }
        }

        // Confirm the order to the retailer
        const retailerEmail = retailer?.email || session.customer_details?.email || session.customer_email
        if (retailerEmail && adminLines.length > 0) {
          const confirmation = generateOrderConfirmationEmail({
            shopName: retailerProfile?.shop_name ?? null,
            lines: adminLines,
            subtotal: (session.amount_subtotal ?? session.amount_total ?? 0) / 100,
            tax: (session.total_details?.amount_tax ?? 0) / 100,
            total: (session.amount_total ?? 0) / 100,
            shipTo: shippingInfo
              ? {
                  name: shippingInfo.name,
                  line1: shippingInfo.address?.line1,
                  line2: shippingInfo.address?.line2,
                  city: shippingInfo.address?.city,
                  state: shippingInfo.address?.state,
                  postalCode: shippingInfo.address?.postal_code,
                  country: shippingInfo.address?.country,
                }
              : null,
          })
          await sendViaResend(retailerEmail, 'Your Neesh order is confirmed', confirmation, 'Retailer order confirmation')
        }

        console.log(`Successfully processed ${createdOrders.length} orders`)
        break
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session

        // Update payment session status
        await supabaseAdmin
          .from('payment_sessions')
          .update({ status: 'expired' })
          .eq('session_id', session.id)

        console.log(`Checkout session expired: ${session.id}`)
        break
      }

      case 'charge.failed': {
        const charge = event.data.object as Stripe.Charge
        console.log(`Charge failed: ${charge.id}, reason: ${charge.failure_message}`)

        // Find the associated order(s) by payment_intent
        if (charge.payment_intent) {
          const { data: orders } = await supabaseAdmin
            .from('orders')
            .select('id, retailer_id')
            .eq('payment_intent_id', charge.payment_intent as string)

          if (orders && orders.length > 0) {
            // Update orders to reflect payment failure
            await supabaseAdmin
              .from('orders')
              .update({ status: 'payment_failed' })
              .eq('payment_intent_id', charge.payment_intent as string)

            console.log(`Marked ${orders.length} order(s) as payment_failed`)
          }

          // Update payment session
          await supabaseAdmin
            .from('payment_sessions')
            .update({ status: 'failed' })
            .eq('payment_intent_id', charge.payment_intent as string)
        }

        // Notify admin
        const adminEmail = Deno.env.get('ADMIN_EMAIL') || 'hi@neesh.art'
        await sendSimpleAdminNotification(adminEmail, {
          subject: 'Payment failed',
          heading: 'A payment failed',
          summary: `A ${money((charge.amount || 0) / 100)} payment failed. Its orders are marked payment_failed.`,
          details: [
            ['Amount', money((charge.amount || 0) / 100)],
            ['Reason', charge.failure_message || 'Unknown'],
            ['Charge', charge.id],
          ],
          action: { text: 'Open in Stripe', href: `https://dashboard.stripe.com/payments/${charge.payment_intent || charge.id}` },
        })
        break
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute
        console.log(`Dispute created: ${dispute.id}, amount: ${dispute.amount}, reason: ${dispute.reason}`)

        // Find associated orders
        if (dispute.payment_intent) {
          await supabaseAdmin
            .from('orders')
            .update({ status: 'disputed' })
            .eq('payment_intent_id', dispute.payment_intent as string)
        }

        // Notify admin immediately — disputes are time-sensitive
        const adminEmail = Deno.env.get('ADMIN_EMAIL') || 'hi@neesh.art'
        const dueBy = dispute.evidence_details?.due_by
        const respondBy = dueBy ? formatDate(new Date(dueBy * 1000)) : null
        const disputeCharge = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id
        await sendSimpleAdminNotification(adminEmail, {
          subject: 'URGENT: Chargeback/Dispute Created',
          urgent: true,
          heading: 'Dispute opened on a charge',
          summary: `A ${money((dispute.amount || 0) / 100)} dispute needs a response in Stripe${respondBy ? ` by ${respondBy}` : ''}.`,
          details: [
            ['Amount', money((dispute.amount || 0) / 100)],
            ['Reason', dispute.reason],
            ['Respond by', respondBy || 'See Stripe'],
            ['Charge', disputeCharge || 'Unknown'],
            ['Dispute', dispute.id],
          ],
          action: { text: 'Respond in Stripe', href: `https://dashboard.stripe.com/disputes/${dispute.id}` },
        })
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        console.log(`Charge refunded: ${charge.id}, amount refunded: ${charge.amount_refunded}`)

        if (charge.payment_intent) {
          // Check if fully or partially refunded
          const isFullRefund = charge.amount_refunded === charge.amount

          await supabaseAdmin
            .from('orders')
            .update({ status: isFullRefund ? 'refunded' : 'partially_refunded' })
            .eq('payment_intent_id', charge.payment_intent as string)

          console.log(`Marked orders as ${isFullRefund ? 'refunded' : 'partially_refunded'}`)
        }

        const adminEmail = Deno.env.get('ADMIN_EMAIL') || 'hi@neesh.art'
        await sendSimpleAdminNotification(adminEmail, {
          subject: 'Refund processed',
          heading: 'A refund was processed',
          summary: `${money((charge.amount_refunded || 0) / 100)} was refunded on a Neesh charge.`,
          details: [
            ['Refunded', money((charge.amount_refunded || 0) / 100)],
            ['Charge total', money((charge.amount || 0) / 100)],
            ['Charge', charge.id],
          ],
          action: { text: 'Open in Stripe', href: `https://dashboard.stripe.com/payments/${charge.payment_intent || charge.id}` },
        })
        break
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account
        console.log(`Connect account updated: ${account.id}, charges_enabled: ${account.charges_enabled}, payouts_enabled: ${account.payouts_enabled}`)

        // Find the publisher with this Stripe account
        const { data: publisherRecord } = await supabaseAdmin
          .from('publishers')
          .select('id, user_id, company_name')
          .eq('stripe_account_id', account.id)
          .maybeSingle()

        if (publisherRecord) {
          // Persist the onboarding status so the dashboard, admin view, and nudge
          // cron can read it without calling Stripe. Stored fields mirror the
          // Stripe account object; requirements are kept in the shape the UI parses.
          const requirements = account.requirements
            ? {
                currently_due: account.requirements.currently_due ?? [],
                past_due: account.requirements.past_due ?? [],
                pending_verification: account.requirements.pending_verification ?? [],
                disabled_reason: account.requirements.disabled_reason ?? null,
                current_deadline: account.requirements.current_deadline ?? null,
              }
            : null

          const { error: statusError } = await supabaseAdmin
            .from('publishers')
            .update({
              stripe_charges_enabled: !!account.charges_enabled,
              stripe_payouts_enabled: !!account.payouts_enabled,
              stripe_details_submitted: !!account.details_submitted,
              stripe_requirements_due: requirements,
              stripe_account_created_at: account.created
                ? new Date(account.created * 1000).toISOString()
                : null,
              stripe_status_updated_at: new Date().toISOString(),
            })
            .eq('id', publisherRecord.id)

          if (statusError) {
            console.error('Failed to persist Stripe status for publisher:', statusError)
          } else {
            console.log(`Persisted Stripe status for publisher: ${publisherRecord.company_name}`)
          }

          // If account became disabled/restricted, notify admin
          if (!account.charges_enabled || !account.payouts_enabled) {
            const adminEmail = Deno.env.get('ADMIN_EMAIL') || 'hi@neesh.art'
            await sendSimpleAdminNotification(adminEmail, {
              subject: 'Publisher Stripe account issue',
              heading: `${publisherRecord.company_name || 'A publisher'}'s Stripe account needs attention`,
              summary: 'Charges or payouts are switched off. The publisher may need to finish onboarding or verify details.',
              details: [
                ['Publisher', publisherRecord.company_name || 'Unknown'],
                ['Account', account.id],
                ['Charges', account.charges_enabled ? 'Enabled' : 'Disabled'],
                ['Payouts', account.payouts_enabled ? 'Enabled' : 'Disabled'],
              ],
              action: { text: 'Open in Stripe', href: `https://dashboard.stripe.com/connect/accounts/${account.id}` },
            })
          }
          console.log(`Account update for publisher: ${publisherRecord.company_name}`)
        } else {
          console.log(`No publisher found for Stripe account: ${account.id}`)
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in stripe-webhook:', error)
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


interface OrderNotificationItem {
  order_id: string
  magazine_title: string
  issue_number: string | null
  quantity: number
  total_price: number
}

const titleWithIssue = (o: OrderNotificationItem): string =>
  formatIssue(o.issue_number) ? `${o.magazine_title}, ${formatIssue(o.issue_number)}` : o.magazine_title

async function sendViaResend(to: string, subject: string, html: string, label: string) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    console.error('RESEND_API_KEY not configured')
    return
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Neesh <hi@neesh.art>',
        to,
        reply_to: 'hi@neesh.art',
        subject,
        html,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error(`Failed to send ${label}:`, error)
    } else {
      console.log(`${label} sent to ${to}`)
    }
  } catch (error) {
    console.error(`Error sending ${label}:`, error)
  }
}

// Helper function to send email to admin
async function sendOrderNotificationToAdmin(
  adminEmail: string,
  sessionId: string,
  retailerName: string,
  lines: LineItem[],
  totalAmount: number
) {
  const copies = lines.reduce((sum, l) => sum + l.quantity, 0)
  const copiesText = `${copies} ${copies === 1 ? 'copy' : 'copies'}`

  const body = renderEmail({
    preheader: `${retailerName} paid ${money(totalAmount)} for ${copiesText}.`,
    label: 'Admin · Order',
    eyebrow: 'New order',
    heading: `${retailerName} placed an order.`,
    intro: 'Payment cleared on Stripe. Publishers have been emailed and will add tracking as each title ships.',
    blocks: [
      stats([
        { label: 'Total', value: money(totalAmount) },
        { label: 'Copies', value: String(copies) },
        { label: 'Status', badge: { text: 'Paid', tone: 'success' } },
      ]),
      lineItems(lines),
      button('Open orders in admin', `${BRAND_URL}/admin/orders`),
      reference('Stripe session', sessionId),
    ],
    footerNote: 'You are receiving this because you are an admin on Neesh.',
  })

  await sendViaResend(adminEmail, `New order from ${retailerName}`, body, 'Admin order notification')
}

// Helper function to send email to publisher
async function sendOrderNotificationToPublisher(
  publisherEmail: string,
  publisherName: string,
  retailerName: string,
  orders: OrderNotificationItem[]
) {
  const totalAmount = orders.reduce((sum, order) => sum + order.total_price, 0)
  const copies = orders.reduce((sum, order) => sum + order.quantity, 0)
  const copiesText = `${copies} ${copies === 1 ? 'copy' : 'copies'}`

  const body = renderEmail({
    preheader: `${retailerName} ordered ${copiesText}. Add tracking once it ships.`,
    label: 'Publisher · Order',
    eyebrow: 'New wholesale order',
    heading: `Your ${orders.length > 1 ? 'magazines are' : 'magazine is'} going to ${retailerName}.`,
    intro: `Hi ${publisherName}, a retailer just ordered from your catalog. Pack it up, then add tracking so the retailer can follow it.`,
    blocks: [
      lineItems(
        orders.map((o) => ({ title: titleWithIssue(o), quantity: o.quantity, amount: o.total_price })),
        { total: { label: 'Order total', amount: totalAmount } }
      ),
      steps('What to do next', [
        'Pack the copies and ship to the address on the order.',
        'Add the tracking number to mark the order shipped.',
        'Follow the payout for this order under Earnings.',
      ]),
      button('Add tracking', `${BRAND_URL}/publisher/orders`),
    ],
  })

  await sendViaResend(publisherEmail, `New order from ${retailerName}`, body, 'Publisher order notification')
}

interface AdminAlert {
  subject: string
  heading: string
  summary: string
  details: [string, string][]
  urgent?: boolean
  action?: { text: string; href: string }
}

// Helper for admin notification emails (failures, disputes, refunds, accounts)
async function sendSimpleAdminNotification(adminEmail: string, alert: AdminAlert) {
  const body = renderEmail({
    preheader: alert.summary,
    label: 'Admin · Alert',
    badge: alert.urgent ? { text: 'Urgent', tone: 'error' } : undefined,
    eyebrow: 'System alert',
    heading: alert.heading,
    intro: alert.summary,
    blocks: [
      details(alert.details),
      ...(alert.action ? [button(alert.action.text, alert.action.href)] : []),
    ],
    footerNote: 'Sent automatically by the Stripe webhook to Neesh admins.',
  })

  await sendViaResend(adminEmail, `[Neesh] ${alert.subject}`, body, `Admin alert "${alert.subject}"`)
}
