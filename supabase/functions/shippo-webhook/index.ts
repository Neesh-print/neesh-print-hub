/**
 * shippo-webhook (T12)
 *
 * Subscribed to Shippo track_updated. Moves order_shipments (and their
 * orders) to shipped or delivered. Protected by a secret token in the URL:
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
    if (!shipment) return new Response('unknown shipment', { status: 200 })
    if (shipment.status === 'delivered' || shipment.status === 'cancelled') return new Response('final', { status: 200 })
    if (shipment.status === next) return new Response('unchanged', { status: 200 })

    await admin.from('order_shipments').update({ status: next }).eq('id', shipment.id)
    await admin.from('orders')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('shipment_id', shipment.id)
      .in('status', next === 'delivered' ? ['paid', 'pending', 'shipped'] : ['paid', 'pending'])

    console.log(`shippo-webhook: shipment ${shipment.id} -> ${next}`)
    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('shippo-webhook error:', err instanceof Error ? err.message : err)
    return new Response('error', { status: 500 })
  }
})
