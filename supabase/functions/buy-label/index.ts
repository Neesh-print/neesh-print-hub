/**
 * buy-label (T11)
 *
 * Print Label on a publisher's order page. Buys a prepaid Shippo label for a
 * Neesh-label shipment, saves the label URL and tracking number on the
 * shipment and its orders, and deducts the label cost from that shipment's
 * shipping transfer (decision 5).
 *
 *   body: { shipment_id, action?: "buy" | "refund" }
 *
 * The label is always re-rated against the real destination address (the
 * quote cache is keyed by postal code, so the quoted rate id may belong to a
 * neighbour's shipment). It prefers the service the space was quoted. If the
 * new price is more than 15% above what the space paid, it stops, marks the
 * shipment needs_review and emails Neesh instead of buying.
 *
 * Reprint is free: a shipment that already has a label returns the same URL.
 */
import { adminClient, corsHeaders, getCaller, json } from '../_shared/http.ts'
import { createShippoClient, ShippoError, withUsdPrices } from '../_shared/shippo.ts'
import { loadShipsFrom } from '../_shared/shipping-quote.ts'
import { details, renderEmail } from '../_shared/email.ts'
import {
  LABEL_RERATE_TOLERANCE,
  buildCustomsDeclaration,
  buildParcel,
  customsRouteFor,
  dutiesPaidFor,
  isLabelReadyAddress,
  isTrackedRate,
  pickCheapestTrackedRate,
  round2,
  shippingPayoutSplit,
  usdAmount,
  type CarrierRate,
  type CustomsDeclaration,
  type CustomsRoute,
  type Parcel,
  type ShipAddress,
} from '../_shared/shipping.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface ShipmentRow {
  id: string
  publisher_id: string
  stripe_session_id: string
  destination_country: string | null
  destination_address: ShipAddress | null
  parcel: Parcel | null
  shipping_usd: number
  uses_neesh_labels: boolean
  service_token: string | null
  status: string
  label_url: string | null
  commercial_invoice_url: string | null
  tracking_number: string | null
  carrier: string | null
  shippo_transaction_id: string | null
  label_cost_usd: number | null
  customs_usd: number | null
  customs_route: CustomsRoute | null
}

async function alertNeesh(subject: string, summary: string, rows: [string, string][]) {
  const key = Deno.env.get('RESEND_API_KEY')
  const to = Deno.env.get('ADMIN_EMAIL') || 'hi@neesh.art'
  if (!key) {
    console.error('RESEND_API_KEY not configured; alert not sent:', subject)
    return
  }
  const html = renderEmail({
    preheader: summary,
    label: 'Admin · Alert',
    eyebrow: 'Shipping labels',
    heading: subject,
    intro: summary,
    blocks: [details(rows)],
    footerNote: 'Sent automatically by buy-label.',
  })
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Neesh <hi@neesh.art>', to, subject: `[Neesh] ${subject}`, html }),
  })
  if (!res.ok) console.error('Failed to send label alert:', await res.text())
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const admin = adminClient()
    const caller = await getCaller(req, admin)
    if (!caller) return json({ error: 'Unauthorized' }, 401, cors)

    const body = await req.json().catch(() => ({}))
    const shipmentId: string = body?.shipment_id ?? ''
    const action: 'buy' | 'refund' = body?.action === 'refund' ? 'refund' : 'buy'
    if (!UUID.test(shipmentId)) return json({ error: 'Invalid shipment' }, 400, cors)

    const { data: shipmentData } = await admin.from('order_shipments').select('*').eq('id', shipmentId).maybeSingle()
    const shipment = shipmentData as ShipmentRow | null
    if (!shipment) return json({ error: 'Shipment not found' }, 404, cors)

    const { data: publisher } = await admin
      .from('publishers')
      .select('id, user_id, company_name')
      .eq('id', shipment.publisher_id)
      .maybeSingle()
    if (!publisher || (publisher.user_id !== caller.userId && caller.role !== 'admin')) {
      return json({ error: 'Forbidden' }, 403, cors)
    }
    if (!shipment.uses_neesh_labels) {
      return json({ error: 'This order ships on your own postage. Add tracking when it ships.' }, 400, cors)
    }

    const apiKey = Deno.env.get('SHIPPO_API_KEY')
    if (!apiKey) return json({ error: 'Labels are not set up yet. Neesh has been told.' }, 503, cors)
    const shippo = createShippoClient(apiKey)

    // ------------------------------------------------------------- refund
    if (action === 'refund') {
      if (!shipment.shippo_transaction_id || shipment.status !== 'label_ready') {
        return json({ error: 'Only an unused label can be cancelled.' }, 400, cors)
      }
      const refund = await shippo.refundLabel(shipment.shippo_transaction_id)
      if (refund.status === 'ERROR') return json({ error: 'Shippo could not refund this label.' }, 502, cors)
      await admin.from('order_shipments').update({
        status: 'awaiting_label',
        label_url: null,
        commercial_invoice_url: null,
        tracking_number: null,
        shippo_transaction_id: null,
        label_cost_usd: null,
      }).eq('id', shipment.id)
      await admin.from('orders').update({ label_url: null, tracking_number: null, carrier: null }).eq('shipment_id', shipment.id)
      const split = shippingPayoutSplit({
        shippingUsd: Number(shipment.shipping_usd),
        customsUsd: Number(shipment.customs_usd ?? 0),
        customsRoute: shipment.customs_route,
      })
      // Only re-hold a payout that has no other hold (refund review, dispute).
      await admin.from('publisher_transfers')
        .update({ gross_amount: split.gross, net_amount: split.net })
        .eq('shipment_id', shipment.id).eq('status', 'pending')
      await admin.from('publisher_transfers')
        .update({ hold_reason: 'awaiting_label' })
        .eq('shipment_id', shipment.id).eq('status', 'pending').is('hold_reason', null)
      return json({ success: true, refund_status: refund.status }, 200, cors)
    }

    // ---------------------------------------------------------------- buy
    if (shipment.label_url && ['label_ready', 'shipped', 'delivered'].includes(shipment.status)) {
      return json({
        success: true,
        reprint: true,
        label_url: shipment.label_url,
        commercial_invoice_url: shipment.commercial_invoice_url,
        tracking_number: shipment.tracking_number,
        carrier: shipment.carrier,
      }, 200, cors)
    }
    if (!['awaiting_label', 'needs_review'].includes(shipment.status)) {
      return json({ error: `This parcel is ${shipment.status.replace('_', ' ')}.` }, 400, cors)
    }

    const origin = await loadShipsFrom(admin, shipment.publisher_id, publisher.company_name)
    if (!origin || !isLabelReadyAddress(origin)) {
      return json({ error: 'Add your full ships-from address and phone number in Settings, then try again.' }, 400, cors)
    }
    // Shippo won't buy a label without a sender email, and the ships-from form
    // doesn't ask for one, so use the publisher's account email.
    if (!origin.email) {
      const { data: owner } = await admin.from('users').select('email').eq('id', publisher.user_id).maybeSingle()
      origin.email = (owner?.email as string | undefined) ?? null
    }
    const destination = shipment.destination_address
    if (!destination) return json({ error: 'This parcel has no destination address.' }, 400, cors)

    const { data: orderRows } = await admin
      .from('orders')
      .select('id, quantity, magazines ( wholesale_price, weight_grams, width_mm, height_mm )')
      .eq('shipment_id', shipment.id)
    const orders = (orderRows ?? []) as unknown as {
      id: string
      quantity: number
      magazines: { wholesale_price: number | null; weight_grams: number | null; width_mm: number | null; height_mm: number | null } | null
    }[]
    if (orders.length === 0) return json({ error: 'No orders found for this parcel.' }, 400, cors)

    const parcel = shipment.parcel ?? buildParcel(orders.map((o) => ({
      quantity: o.quantity,
      weightGrams: o.magazines?.weight_grams ?? null,
      widthMm: o.magazines?.width_mm,
      heightMm: o.magazines?.height_mm,
    })), 'auto')
    if (!parcel) return json({ error: 'A title in this parcel is missing its weight.' }, 400, cors)

    const reference = `Neesh ${orders.map((o) => o.id.slice(0, 8).toUpperCase()).join(' ')}`
    const declare = (dutiesPaid?: boolean) => buildCustomsDeclaration({
      origin: origin.country,
      destination: destination.country,
      signer: origin.name,
      reference,
      dutiesPaid,
      lines: orders.map((o) => ({
        quantity: o.quantity,
        weightGrams: o.magazines?.weight_grams ?? 0,
        wsp: Number(o.magazines?.wholesale_price ?? 0),
      })),
    })
    // Rates from outside the US come back in CAD, EUR or GBP; price them all in USD.
    const rateFor = async (customs: CustomsDeclaration | null, token: string | null) => {
      const created = await shippo.createShipment({ from: origin, to: destination, parcel, customs, metadata: reference })
      const usd = (await withUsdPrices(shippo, created)).filter((r: CarrierRate) => usdAmount(r) !== null && isTrackedRate(r))
      const sameService = token
        ? usd.filter((r) => r.servicelevel?.token === token).sort((a, b) => usdAmount(a)! - usdAmount(b)!)[0] ?? null
        : null
      return { created, rate: sameService ?? pickCheapestTrackedRate(usd) }
    }

    // Rate with DDP first, so a duty-paying courier still prices duties paid.
    let customs = declare()
    let { created: fresh, rate } = await rateFor(customs, shipment.service_token)
    // Only a duty-paying courier takes DDP; postal carriers (DPD UK, for one)
    // reject it, and on that route the publisher prepays customs themselves.
    // Re-rate the same service with DAP before buying.
    if (rate && customs?.incoterm === 'DDP' && !dutiesPaidFor(origin.country, destination.country, rate)) {
      customs = declare(false)
      ;({ created: fresh, rate } = await rateFor(customs, rate.servicelevel?.token ?? null))
    }
    if (!rate) {
      await admin.from('order_shipments').update({ status: 'needs_review', review_reason: 'No carrier rate at label time' }).eq('id', shipment.id)
      await alertNeesh('No label rate', `No tracked rate for shipment ${shipment.id} at label time.`, [
        ['Shipment', shipment.id], ['Publisher', publisher.company_name ?? ''], ['Shippo shipment', fresh.object_id],
      ])
      return json({ error: "We couldn't get a label rate right now. Neesh has been told and will sort it out." }, 409, cors)
    }

    const labelCost = round2(usdAmount(rate)!)
    const dutiesPaid = dutiesPaidFor(origin.country, destination.country, rate)
    const paid = Number(shipment.shipping_usd)
    if (labelCost > paid * (1 + LABEL_RERATE_TOLERANCE)) {
      const reason = `Label ${labelCost.toFixed(2)} USD vs ${paid.toFixed(2)} USD paid by the space`
      await admin.from('order_shipments').update({ status: 'needs_review', review_reason: reason }).eq('id', shipment.id)
      await alertNeesh('Label price jumped', `The label for shipment ${shipment.id} costs more than 15% over what the space paid. Nothing was bought.`, [
        ['Shipment', shipment.id], ['Publisher', publisher.company_name ?? ''], ['Space paid', `$${paid.toFixed(2)}`],
        ['Label now', `$${labelCost.toFixed(2)}`], ['Carrier', `${rate.provider} ${rate.servicelevel?.name ?? ''}`],
      ])
      return json({ error: 'The label price changed since the order. Neesh has been told and will sort it out.' }, 409, cors)
    }

    // US customs handling follows who clears customs on the rate actually
    // bought. If that flipped since checkout (a courier was quoted and post is
    // bought, or the reverse), record the new route before buying; the
    // shipping payout below then pays the customs amount to the publisher only
    // on the publisher route. The space paid the same amount either way.
    const customsUsd = Number(shipment.customs_usd ?? 0)
    const customsRoute = customsRouteFor(origin.country, destination.country, dutiesPaid)
    if (customsRoute !== shipment.customs_route) {
      await admin.from('order_shipments').update({ customs_route: customsRoute }).eq('id', shipment.id)
      console.log(`buy-label: shipment ${shipment.id} customs route ${shipment.customs_route} -> ${customsRoute} (${customsUsd} USD)`)
    }

    const tx = await shippo.buyLabel(rate.object_id, reference)
    if (tx.status !== 'SUCCESS' || !tx.label_url) {
      const msg = (tx.messages ?? []).map((m) => m.text).filter(Boolean).join(' ')
      console.error(`buy-label: transaction ${tx.object_id} status ${tx.status}`)
      return json({ error: msg || 'Shippo could not create the label. Please try again.' }, 502, cors)
    }

    const carrier = [rate.provider, rate.servicelevel?.name].filter(Boolean).join(' ')
    await admin.from('order_shipments').update({
      status: 'label_ready',
      review_reason: null,
      shippo_transaction_id: tx.object_id,
      shippo_rate_id: rate.object_id,
      label_cost_usd: labelCost,
      label_url: tx.label_url,
      commercial_invoice_url: tx.commercial_invoice_url ?? null,
      carrier,
      service: rate.servicelevel?.name ?? null,
      service_token: rate.servicelevel?.token ?? null,
      tracking_number: tx.tracking_number ?? null,
      duties_paid: dutiesPaid,
      parcel,
      customs,
    }).eq('id', shipment.id)

    await admin.from('orders')
      .update({ label_url: tx.label_url, tracking_number: tx.tracking_number ?? null, carrier })
      .eq('shipment_id', shipment.id)

    // Label cost comes out of the shipping the space paid (decision 5); customs
    // handling is added on the publisher route.
    const split = shippingPayoutSplit({ shippingUsd: paid, labelCostUsd: labelCost, customsUsd, customsRoute })
    // Clears only the label hold; a refund-review or dispute hold stays.
    await admin.from('publisher_transfers')
      .update({ gross_amount: split.gross, net_amount: split.net, platform_fee: 0 })
      .eq('shipment_id', shipment.id)
      .eq('status', 'pending')
    await admin.from('publisher_transfers')
      .update({ hold_reason: null })
      .eq('shipment_id', shipment.id)
      .eq('status', 'pending')
      .eq('hold_reason', 'awaiting_label')

    // A courier clearing US customs bills the duties and its own handling fee to
    // the Shippo account weeks later. That cost isn't in the label price, so flag it.
    // The label is bought by now, so a failed alert must not fail the request.
    if (dutiesPaid) {
      await alertNeesh('Courier will bill US duties', `${carrier} carries shipment ${shipment.id} into the US with duties paid. The carrier bills duties and its duty-handling fee to the Shippo account after delivery; they are not in the label cost.`, [
        ['Shipment', shipment.id], ['Publisher', publisher.company_name ?? ''], ['Carrier', carrier],
        ['Label cost', `$${labelCost.toFixed(2)}`], ['Shippo transaction', tx.object_id],
        ['Customs handling collected', `$${customsUsd.toFixed(2)}`],
      ]).catch((err) => console.error('buy-label: duties alert failed:', err instanceof Error ? err.message : err))
    }

    const priced = (rate.currency || '').toUpperCase() === 'USD' ? '' : ` (carrier price ${rate.amount} ${rate.currency})`
    console.log(`buy-label: shipment ${shipment.id} transaction ${tx.object_id} cost ${labelCost} USD${priced}`)
    return json({
      success: true,
      label_url: tx.label_url,
      commercial_invoice_url: tx.commercial_invoice_url ?? null,
      tracking_number: tx.tracking_number ?? null,
      carrier,
      label_cost_usd: labelCost,
      duties_paid: dutiesPaid,
    }, 200, cors)
  } catch (err) {
    if (err instanceof ShippoError) {
      console.error('buy-label Shippo error:', err.status)
      return json({ error: 'Shippo could not create the label. Please try again.' }, 502, cors)
    }
    console.error('buy-label error:', err instanceof Error ? err.message : err)
    return json({ error: 'Something went wrong buying the label.' }, 500, cors)
  }
})
