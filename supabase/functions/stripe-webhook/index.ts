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

// Retailers pay wholesale + 10%. Must match the markup in create-checkout.
const RETAILER_MARKUP = 1.10

// Publisher receives 90% of wholesale (Neesh takes 10% from the publisher side)
const PUBLISHER_SHARE = 0.90

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

        if (!retailerId) {
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

        // Read what was actually charged from Stripe, not today's magazine
        // prices: a publisher may have changed a price between checkout and
        // this webhook. create-checkout put magazine_id and publisher_id in
        // each line item's product metadata.
        const chargedItems = await getChargedItems(stripe, session.id)
        if (chargedItems.size === 0) {
          // Throwing returns a 500, so Stripe retries.
          throw new Error(`No magazine line items found for session ${session.id}`)
        }

        // Fetch magazine details (titles, issue numbers and inventory handling
        // for emails, plus a publisher fallback)
        const magazineIds = [...chargedItems.keys()]
        const { data: magazines, error: magazinesError } = await supabaseAdmin
          .from('magazines')
          .select('id, title, issue_number, publisher_id')
          .in('id', magazineIds)

        if (magazinesError || !magazines) {
          console.error('Error fetching magazines:', magazinesError)
          throw new Error('Failed to fetch magazine data')
        }

        const magazineMap = new Map(magazines.map(m => [m.id, m]))

        for (const magazineId of magazineIds) {
          if (!magazineMap.has(magazineId)) {
            // Still create the order: the retailer paid for it.
            console.error(`Magazine not found for ID: ${magazineId}`)
          }
        }

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

        // Create one order per magazine. The orders_session_magazine_unique
        // constraint plus ignoreDuplicates makes this safe to retry, and safe
        // when two deliveries of this event run at once: rows that already
        // exist are skipped, and only rows inserted by THIS request come back.
        const orderRows = [...chargedItems.values()].map((item) => ({
          retailer_id: retailerId,
          magazine_id: item.magazineId,
          quantity: item.quantity,
          unit_price: item.unitAmountCents / 100,
          total_price: item.subtotalCents / 100,
          status: 'paid',
          payment_status: 'paid',
          stripe_session_id: session.id,
          payment_intent_id: session.payment_intent as string,
          shipping_address: shippingAddress,
          stripe_payment_metadata: {
            customer_email: session.customer_email,
            payment_status: session.payment_status,
            amount_total: session.amount_total,
          },
        }))

        const { data: insertedOrders, error: orderError } = await supabaseAdmin
          .from('orders')
          .upsert(orderRows, { onConflict: 'stripe_session_id,magazine_id', ignoreDuplicates: true })
          .select('id, magazine_id')

        if (orderError) {
          console.error('Error creating orders:', orderError)
          throw new Error('Failed to create orders')
        }

        const createdOrders = (insertedOrders ?? []).map(o => o.id as string)
        console.log(`Created ${createdOrders.length} new order(s) for session ${session.id}`)

        // Decrease inventory only for orders this request inserted, so a retry
        // never decrements twice.
        for (const order of insertedOrders ?? []) {
          const item = chargedItems.get(order.magazine_id as string)!
          try {
              // We use the new RPC function which is safe
              const { error: invError } = await supabaseAdmin.rpc('decrease_inventory', {
                p_magazine_id: item.magazineId,
                p_quantity: item.quantity
              });

              if (invError) {
                  console.error(`RPC decrease_inventory failed for ${item.magazineId}:`, invError);
              } else {
                  console.log(`Decreased inventory for ${item.magazineId} by ${item.quantity}`);
              }

          } catch (invError) {
              console.error(`Failed to call decrease_inventory for ${item.magazineId}:`, invError)
          }
        }

        // Every order for this session, including any an earlier (failed)
        // delivery inserted, so payouts and emails cover the whole purchase.
        const { data: sessionOrders, error: sessionOrdersError } = await supabaseAdmin
          .from('orders')
          .select('id, magazine_id')
          .eq('stripe_session_id', session.id)

        if (sessionOrdersError || !sessionOrders) {
          console.error('Error loading orders for session:', sessionOrdersError)
          throw new Error('Failed to load orders for session')
        }

        // --- Insert pending publisher transfer records ---
        // Amounts come from the charged line item. The unique order_id
        // constraint plus ignoreDuplicates makes this safe to retry.
        const publisherEmails: Map<string, OrderNotificationItem[]> = new Map() // Group orders by publisher

        for (const order of sessionOrders) {
          const item = chargedItems.get(order.magazine_id as string)
          if (!item) continue
          const magazine = magazineMap.get(item.magazineId)
          const publisherId = item.publisherId ?? magazine?.publisher_id
          if (!publisherId) {
            console.error(`No publisher for magazine ${item.magazineId} in session ${session.id}`)
            continue
          }

          const { grossCents, netCents } = payoutAmounts(item)

          const { error: transferError } = await supabaseAdmin
            .from('publisher_transfers')
            .upsert({
              publisher_id: publisherId,
              order_id: order.id,
              stripe_session_id: session.id,
              gross_amount: grossCents / 100,
              platform_fee: (grossCents - netCents) / 100,
              net_amount: netCents / 100,
              status: 'pending',
            }, { onConflict: 'order_id', ignoreDuplicates: true })

          if (transferError) {
            console.error(`Failed to insert publisher transfer for order ${order.id}:`, transferError)
            throw new Error('Failed to create publisher transfer records')
          }
          console.log(`Pending transfer for publisher ${publisherId}, order ${order.id}, net $${netCents / 100}`)

          // Group orders by publisher for email notifications
          if (!publisherEmails.has(publisherId)) {
            publisherEmails.set(publisherId, [])
          }
          publisherEmails.get(publisherId)!.push({
            order_id: order.id as string,
            magazine_title: magazine?.title ?? 'Magazine',
            issue_number: magazine?.issue_number ?? null,
            quantity: item.quantity,
            total_price: item.subtotalCents / 100,
          })
        }

        // Mark the payment session completed. Only the delivery that actually
        // flips it sends the emails below, so retries don't email twice.
        const { data: flippedSessions } = await supabaseAdmin
          .from('payment_sessions')
          .update({
            status: 'completed',
            payment_intent_id: session.payment_intent as string,
          })
          .eq('session_id', session.id)
          .neq('status', 'completed')
          .select('id')

        let shouldNotify = (flippedSessions?.length ?? 0) > 0
        if (!shouldNotify) {
          // create-checkout's payment_sessions insert is best-effort. With
          // no row to flip, fall back to "this delivery inserted new orders".
          const { count } = await supabaseAdmin
            .from('payment_sessions')
            .select('id', { count: 'exact', head: true })
            .eq('session_id', session.id)
          shouldNotify = (count ?? 0) === 0 && createdOrders.length > 0
        }

        if (!shouldNotify) {
          console.log(`Session ${session.id} already notified; skipping emails.`)
          break
        }

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
        let disputePayouts: PayoutProtectionResult = { affected: 0, alreadyPaid: 0 }
        if (dispute.payment_intent) {
          const paymentIntentId = idOf(dispute.payment_intent)
          await supabaseAdmin
            .from('orders')
            .update({ status: 'disputed' })
            .eq('payment_intent_id', paymentIntentId)

          // Hold unpaid payouts until the dispute closes; flag ones already sent.
          disputePayouts = await protectPayouts(supabaseAdmin, paymentIntentId, {
            kind: 'hold',
            holdReason: 'dispute',
            reversalReason: DISPUTE_REVERSAL_REASON,
          })
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
            ['Payouts put on hold', String(disputePayouts.affected)],
            ['Already paid out (review for reversal)', String(disputePayouts.alreadyPaid)],
          ],
          action: { text: 'Respond in Stripe', href: `https://dashboard.stripe.com/disputes/${dispute.id}` },
        })
        break
      }

      case 'charge.dispute.closed': {
        const dispute = event.data.object as Stripe.Dispute
        console.log(`Dispute closed: ${dispute.id}, status: ${dispute.status}`)

        if (dispute.payment_intent) {
          const paymentIntentId = idOf(dispute.payment_intent)
          await resolveDisputedPayouts(supabaseAdmin, paymentIntentId, dispute.status === 'won')
        }
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        console.log(`Charge refunded: ${charge.id}, amount refunded: ${charge.amount_refunded}`)

        let refundPayouts: PayoutProtectionResult = { affected: 0, alreadyPaid: 0 }
        let isFullRefund = false
        if (charge.payment_intent) {
          const paymentIntentId = idOf(charge.payment_intent)
          // Check if fully or partially refunded
          isFullRefund = charge.amount_refunded === charge.amount

          await supabaseAdmin
            .from('orders')
            .update({ status: isFullRefund ? 'refunded' : 'partially_refunded' })
            .eq('payment_intent_id', paymentIntentId)

          console.log(`Marked orders as ${isFullRefund ? 'refunded' : 'partially_refunded'}`)

          // A full refund cancels every unpaid payout for the purchase. A
          // partial refund can't be traced to specific orders, so hold the
          // unpaid payouts for an admin to review. Payouts that already went
          // out are flagged, not reversed automatically.
          refundPayouts = await protectPayouts(
            supabaseAdmin,
            paymentIntentId,
            isFullRefund
              ? { kind: 'cancel', reason: 'Order refunded', reversalReason: 'Order fully refunded after payout' }
              : { kind: 'hold', holdReason: 'refund_review', reversalReason: 'Order partially refunded after payout' },
          )
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
            [isFullRefund ? 'Payouts cancelled' : 'Payouts held for review', String(refundPayouts.affected)],
            ['Already paid out (review for reversal)', String(refundPayouts.alreadyPaid)],
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

// ---------------------------------------------------------------------------
// Charged amounts
// ---------------------------------------------------------------------------

interface ChargedItem {
  magazineId: string
  publisherId: string | null
  quantity: number
  unitAmountCents: number
  subtotalCents: number
}

// Reads the session's line items from Stripe: the prices the retailer was
// actually charged. Keyed by magazine_id, with repeated magazines merged.
async function getChargedItems(stripe: Stripe, sessionId: string): Promise<Map<string, ChargedItem>> {
  // create-checkout caps carts at 50 lines, so one page of 100 is enough.
  const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
    limit: 100,
    expand: ['data.price.product'],
  })

  const items = new Map<string, ChargedItem>()
  for (const line of lineItems.data) {
    const product = line.price?.product
    const metadata = product && typeof product === 'object' && !('deleted' in product && product.deleted)
      ? (product as Stripe.Product).metadata
      : {}
    const magazineId = metadata?.magazine_id
    const unitAmountCents = line.price?.unit_amount

    if (!magazineId || unitAmountCents == null) {
      console.error(`Line item ${line.id} in session ${sessionId} has no magazine_id or unit_amount`)
      continue
    }

    const quantity = line.quantity ?? 0
    const existing = items.get(magazineId)
    if (existing) {
      existing.quantity += quantity
      existing.subtotalCents += line.amount_subtotal
    } else {
      items.set(magazineId, {
        magazineId,
        publisherId: metadata.publisher_id || null,
        quantity,
        unitAmountCents,
        subtotalCents: line.amount_subtotal,
      })
    }
  }
  return items
}

// Splits a charged line into what the retailer paid (gross) and what the
// publisher is owed (net). create-checkout charges round(wholesale * 1.10)
// cents per unit, so dividing by the markup and rounding recovers the exact
// wholesale cents at the time of purchase (the rounding error is under half
// a cent). Neesh keeps 10% of the publisher's wholesale subtotal; the space
// pays wholesale + 10%. The net uses the same expression production used
// before this change, so payouts are identical to the cent.
function payoutAmounts(item: ChargedItem): { grossCents: number; netCents: number } {
  const wholesaleCents = Math.round(item.unitAmountCents / RETAILER_MARKUP)
  const wholesalePrice = wholesaleCents / 100
  const netCents = Math.min(
    Math.round(wholesalePrice * PUBLISHER_SHARE * item.quantity * 100),
    item.subtotalCents,
  )
  return { grossCents: item.subtotalCents, netCents }
}

// ---------------------------------------------------------------------------
// Payout protection on refunds and disputes
// ---------------------------------------------------------------------------

const DISPUTE_REVERSAL_REASON = 'Dispute opened after payout'

// deno-lint-ignore no-explicit-any
type SupabaseAdmin = ReturnType<typeof createClient<any>>

type PayoutProtection =
  | { kind: 'cancel'; reason: string; reversalReason: string }
  | { kind: 'hold'; holdReason: 'refund_review' | 'dispute'; reversalReason: string }

interface PayoutProtectionResult {
  affected: number     // unpaid payouts cancelled or held
  alreadyPaid: number  // payouts already sent (or in flight), flagged for review
}

function idOf(value: string | { id: string }): string {
  return typeof value === 'string' ? value : value.id
}

// Stops unpaid publisher payouts for a refunded or disputed purchase, and
// flags payouts that already went out. Throws on database errors so the
// webhook returns 500 and Stripe retries.
async function protectPayouts(
  supabaseAdmin: SupabaseAdmin,
  paymentIntentId: string,
  protection: PayoutProtection,
): Promise<PayoutProtectionResult> {
  const { data: orders, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select('id')
    .eq('payment_intent_id', paymentIntentId)

  if (ordersError) throw ordersError
  const orderIds = (orders ?? []).map((o: { id: string }) => o.id)
  if (orderIds.length === 0) return { affected: 0, alreadyPaid: 0 }

  // Only 'pending' rows: release-publisher-transfer can't claim them once
  // they're cancelled or held.
  const { data: stopped, error: stopError } = await supabaseAdmin
    .from('publisher_transfers')
    .update(
      protection.kind === 'cancel'
        ? { status: 'cancelled', hold_reason: null, failure_reason: protection.reason }
        : { hold_reason: protection.holdReason }
    )
    .in('order_id', orderIds)
    .eq('status', 'pending')
    .select('id')

  if (stopError) throw stopError

  // 'processing' is included: that money may already be on its way.
  const { data: flagged, error: flagError } = await supabaseAdmin
    .from('publisher_transfers')
    .update({ reversal_needed: true, reversal_reason: protection.reversalReason })
    .in('order_id', orderIds)
    .in('status', ['processing', 'transferred'])
    .select('id')

  if (flagError) throw flagError

  const result = { affected: stopped?.length ?? 0, alreadyPaid: flagged?.length ?? 0 }
  console.log(`Payout protection for ${paymentIntentId}: ${result.affected} stopped, ${result.alreadyPaid} flagged`)
  return result
}

// When a dispute closes: if Neesh won, release the hold and clear the review
// flag (and the order is no longer disputed); if it lost, cancel the held
// payouts. Payouts that already went out stay flagged after a loss.
async function resolveDisputedPayouts(
  supabaseAdmin: SupabaseAdmin,
  paymentIntentId: string,
  won: boolean,
): Promise<void> {
  const { data: orders, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select('id')
    .eq('payment_intent_id', paymentIntentId)

  if (ordersError) throw ordersError
  const orderIds = (orders ?? []).map((o: { id: string }) => o.id)
  if (orderIds.length === 0) return

  const { error: holdError } = await supabaseAdmin
    .from('publisher_transfers')
    .update(
      won
        ? { hold_reason: null }
        : { status: 'cancelled', hold_reason: null, failure_reason: 'Dispute lost' }
    )
    .in('order_id', orderIds)
    .eq('status', 'pending')
    .eq('hold_reason', 'dispute')

  if (holdError) throw holdError

  if (won) {
    const { error: flagError } = await supabaseAdmin
      .from('publisher_transfers')
      .update({ reversal_needed: false, reversal_reason: null })
      .in('order_id', orderIds)
      .eq('reversal_reason', DISPUTE_REVERSAL_REASON)

    if (flagError) throw flagError

    const { error: orderError } = await supabaseAdmin
      .from('orders')
      .update({ status: 'paid' })
      .in('id', orderIds)
      .eq('status', 'disputed')

    if (orderError) throw orderError
  }

  console.log(`Dispute for ${paymentIntentId} closed (${won ? 'won' : 'lost'}); payouts updated`)
}
