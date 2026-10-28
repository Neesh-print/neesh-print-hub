/**
 * register-tracking
 *
 * Called after a publisher (or admin) adds tracking to an order, which marks
 * it Packed. Asks Shippo to follow the tracking number, so its first carrier
 * scan reaches shippo-webhook and moves the order to shipped, then delivered.
 * Labels bought through buy-label are already followed by Shippo.
 *
 *   body: { orderId }
 *
 * Carriers Shippo can't follow ("other", Amazon Logistics) are skipped; those
 * orders stay Packed until someone marks them shipped, and show on the admin
 * Today screen after a few days.
 */
import { adminClient, corsHeaders, getCaller, json } from '../_shared/http.ts'
import { createShippoClient, ShippoError, shippoCarrierToken } from '../_shared/shippo.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const admin = adminClient()
    const caller = await getCaller(req, admin)
    if (!caller) return json({ error: 'Unauthorized' }, 401, cors)

    const body = await req.json().catch(() => ({}))
    const orderId: string = body?.orderId ?? ''
    if (!UUID.test(orderId)) return json({ error: 'orderId is required' }, 400, cors)

    const { data: order } = await admin
      .from('orders')
      .select('id, tracking_number, carrier, magazines ( publisher_id, publishers ( user_id ) )')
      .eq('id', orderId)
      .maybeSingle()
    if (!order) return json({ error: 'Order not found' }, 404, cors)

    const owner = (order.magazines as { publishers?: { user_id?: string } | null } | null)?.publishers?.user_id
    if (caller.role !== 'admin' && caller.userId !== owner) return json({ error: 'Forbidden' }, 403, cors)

    const trackingNumber = order.tracking_number?.trim()
    if (!trackingNumber) return json({ registered: false, reason: 'no tracking number' }, 200, cors)

    const carrier = shippoCarrierToken(order.carrier)
    if (!carrier) return json({ registered: false, reason: `Shippo can't follow carrier "${order.carrier}"` }, 200, cors)

    const apiKey = Deno.env.get('SHIPPO_API_KEY')
    if (!apiKey) return json({ error: 'Shipping is not configured' }, 500, cors)

    const track = await createShippoClient(apiKey).registerTracking(carrier, trackingNumber, `order ${order.id}`)

    // Tracking added after the parcel moved: Shippo may not send another
    // update for a scan it already has, so apply the current one now. Same
    // forward-only rules as shippo-webhook.
    const status = track.tracking_status?.status ?? null
    const next = status === 'DELIVERED' ? 'delivered' : status === 'TRANSIT' ? 'shipped' : null
    if (next) {
      await admin
        .from('orders')
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq('id', order.id)
        .in('status', next === 'delivered' ? ['paid', 'processing', 'shipped'] : ['paid', 'processing'])
    }
    return json({ registered: true, carrier, status, moved_to: next }, 200, cors)
  } catch (err) {
    if (err instanceof ShippoError) {
      // A wrong or not-yet-active tracking number lands here; the order stays Packed.
      console.error('register-tracking Shippo error:', err.status, JSON.stringify(err.body ?? null))
      return json({ registered: false, reason: 'Shippo rejected the tracking number' }, 200, cors)
    }
    console.error('register-tracking error:', err instanceof Error ? err.message : err)
    return json({ error: 'Something went wrong' }, 500, cors)
  }
})
