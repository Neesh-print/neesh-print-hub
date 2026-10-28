/**
 * shippo-webhook (T12)
 *
 * Subscribed to Shippo track_updated. Moves order_shipments and orders to
 * shipped (first carrier scan) or delivered. Orders are matched through their
 * parcel when it has a Neesh label, and by their own tracking number when the
 * publisher used their own label (register-tracking asks Shippo to follow
 * those). Packed orders (`processing`) move too. Protected by a secret token
 * in the URL:
 *   https://<project>.supabase.co/functions/v1/shippo-webhook?token=<SHIPPO_WEBHOOK_TOKEN>
 * Shipping emails to spaces (T15) are out of scope here.
 */
import { adminClient } from '../_shared/http.ts'

const SHIPPED = new Set(['TRANSIT'])
const DELIVERED = new Set(['DELIVERED'])

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const expected = Deno.env.get('SHIPPO_WEBHOOK_TOKEN') ?? ''
  const token = new URL(req.url).searchParams.get('token') ?? ''
  if (!expected || !safeEqual(token, expected)) return new Response('Forbidden', { status: 403 })

  try {
    const payload = await req.json()
    if (payload?.event !== 'track_updated') return new Response('ignored', { status: 200 })

    const trackingNumber: string | undefined = payload?.data?.tracking_number
    const status: string = payload?.data?.tracking_status?.status ?? ''
    if (!trackingNumber) return new Response('no tracking number', { status: 200 })

    const next = DELIVERED.has(status) ? 'delivered' : SHIPPED.has(status) ? 'shipped' : null
    if (!next) return new Response('no change', { status: 200 })

    const admin = adminClient()
    const { data: shipment } = await admin
      .from('order_shipments')
      .select('id, status')
      .eq('tracking_number', trackingNumber)
      .maybeSingle()
    if (shipment?.status === 'cancelled') return new Response('cancelled', { status: 200 })

    // A self-ship parcel is already 'shipped' once tracking is added, so only
    // move the parcel forward; its orders are checked below either way.
    if (shipment && shipment.status !== 'delivered' && shipment.status !== next) {
      await admin.from('order_shipments').update({ status: next }).eq('id', shipment.id)
    }

    // Only move orders forward: delivered never goes back to shipped.
    const from = next === 'delivered' ? ['paid', 'pending', 'processing', 'shipped'] : ['paid', 'pending', 'processing']
    const changes = { status: next, updated_at: new Date().toISOString() }
    const moved = new Set<string>()
    const byTracking = await admin.from('orders').update(changes).eq('tracking_number', trackingNumber).in('status', from).select('id')
    if (byTracking.error) throw byTracking.error
    byTracking.data?.forEach((o) => moved.add(o.id))
    if (shipment) {
      const byShipment = await admin.from('orders').update(changes).eq('shipment_id', shipment.id).in('status', from).select('id')
      if (byShipment.error) throw byShipment.error
      byShipment.data?.forEach((o) => moved.add(o.id))
    }

    if (!shipment && moved.size === 0) return new Response('unknown tracking number', { status: 200 })
    console.log(`shippo-webhook: ${moved.size} order(s)${shipment ? ` in shipment ${shipment.id}` : ''} -> ${next}`)
    return new Response(moved.size > 0 ? 'ok' : 'unchanged', { status: 200 })
  } catch (err) {
    console.error('shippo-webhook error:', err instanceof Error ? err.message : err)
    return new Response('error', { status: 500 })
  }
})
