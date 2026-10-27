/**
 * quote-shipping (T3, T10, T17)
 *
 * mode "cart" (spaces): quotes each publisher group in the given items to the
 * space's saved address. Cart, title page and checkout all use these numbers.
 *   body: { items: [{ magazine_id, quantity }], persist?: boolean, allow_reference?: boolean }
 *   persist (default true) stores each quote so create-checkout can reuse it.
 *   allow_reference lets the title page show a New York estimate before the
 *   space has saved an address.
 *
 * mode "preview" (publishers): live rates from the publisher's ships-from
 * address (or one being typed) to a reference space, for the settings
 * preview, onboarding table, "What a space earns" and title badges.
 *   body: { mode: "preview", destination: "us" | "domestic", origin?: address,
 *           packaging?: preset, lines: [{ key, copies, weight_grams, wsp?, width_mm?, height_mm? }] }
 */
import { adminClient, corsHeaders, getCaller, json } from '../_shared/http.ts'
import { createShippoClient } from '../_shared/shippo.ts'
import { liveRate, loadShipsFrom, quoteCart, resolveRetailerDestination } from '../_shared/shipping-quote.ts'
import {
  REFERENCE_DOMESTIC_ADDRESSES,
  REFERENCE_US_ADDRESS,
  buildCustomsDeclaration,
  buildParcel,
  isQuotableAddress,
  normalizeCountry,
  type PackagingPreset,
  type ShipAddress,
} from '../_shared/shipping.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PRESETS: PackagingPreset[] = ['auto', 'envelope', 'padded_mailer', 'box']

interface PreviewLine {
  key: string
  copies: number
  weight_grams: number
  wsp?: number
  width_mm?: number | null
  height_mm?: number | null
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const admin = adminClient()
    const caller = await getCaller(req, admin)
    if (!caller) return json({ error: 'Unauthorized' }, 401, cors)

    const body = await req.json().catch(() => ({}))
    const apiKey = Deno.env.get('SHIPPO_API_KEY')
    const shippo = apiKey ? createShippoClient(apiKey) : null

    // ---------------------------------------------------------------- preview
    if (body?.mode === 'preview') {
      if (caller.role !== 'publisher' && caller.role !== 'admin') {
        return json({ error: 'Forbidden - Publisher access required' }, 403, cors)
      }
      const { data: publisher } = await admin
        .from('publishers')
        .select('id, company_name, packaging_preset')
        .eq('user_id', caller.userId)
        .maybeSingle()
      if (!publisher) return json({ error: 'Publisher not found' }, 404, cors)

      const lines: PreviewLine[] = Array.isArray(body.lines) ? body.lines.slice(0, 25) : []
      if (!lines.every((l) => typeof l.key === 'string' && l.copies > 0 && l.copies <= 500 && l.weight_grams > 0 && l.weight_grams < 20000)) {
        return json({ error: 'Invalid preview lines' }, 400, cors)
      }

      let origin: ShipAddress | null = null
      if (body.origin && typeof body.origin === 'object') {
        const o = body.origin as Partial<ShipAddress>
        const candidate = { ...o, name: o.name || publisher.company_name || 'Shipping', country: normalizeCountry(o.country ?? null) ?? '' }
        origin = isQuotableAddress(candidate) ? (candidate as ShipAddress) : null
      } else {
        origin = await loadShipsFrom(admin, publisher.id, publisher.company_name)
      }
      if (!origin) return json({ status: 'needs_origin', results: [] }, 200, cors)

      const destination = body.destination === 'domestic'
        ? REFERENCE_DOMESTIC_ADDRESSES[origin.country] ?? null
        : REFERENCE_US_ADDRESS
      if (!destination) return json({ status: 'no_reference', origin_country: origin.country, results: [] }, 200, cors)

      const preset: PackagingPreset = PRESETS.includes(body.packaging) ? body.packaging : (publisher.packaging_preset as PackagingPreset)
      const results = []
      for (const line of lines) {
        const parcel = buildParcel([{ quantity: line.copies, weightGrams: line.weight_grams, widthMm: line.width_mm, heightMm: line.height_mm }], preset)
        const customs = buildCustomsDeclaration({
          origin: origin.country,
          destination: destination.country,
          signer: origin.name,
          lines: [{ quantity: line.copies, weightGrams: line.weight_grams, wsp: line.wsp ?? 10 }],
        })
        const rate = parcel ? await liveRate(admin, shippo, { origin, destination, parcel, customs }) : null
        results.push({
          key: line.key,
          copies: line.copies,
          shipping_usd: rate?.shippingUsd ?? null,
          amount_local: rate?.amountLocal ?? null,
          currency_local: rate?.currencyLocal ?? null,
          carrier: rate?.carrier ?? null,
          service: rate?.service ?? null,
          estimated_days: rate?.estimatedDays ?? null,
          duties_paid: !!rate?.dutiesPaid,
        })
      }
      return json({
        status: 'ok',
        origin_country: origin.country,
        destination: { city: destination.city, country: destination.country, postal_code: destination.postal_code },
        results,
      }, 200, cors)
    }

    // ------------------------------------------------------------------- cart
    if (caller.role !== 'retailer') return json({ error: 'Forbidden - Retailer access required' }, 403, cors)

    const items = Array.isArray(body?.items) ? body.items : []
    if (items.length === 0 || items.length > 50) return json({ error: 'Cart must have 1 to 50 items' }, 400, cors)
    for (const i of items) {
      if (!UUID.test(i?.magazine_id ?? '') || typeof i.quantity !== 'number' || i.quantity < 1 || i.quantity > 10000) {
        return json({ error: 'Invalid cart item' }, 400, cors)
      }
    }

    let destination = await resolveRetailerDestination(admin, caller.userId)
    let destinationIsReference = false
    if (!destination && body.allow_reference) {
      // T8: zone fallback for a space with no address is retailers.country, then US.
      // A live quote needs a postal code, so only the US has a reference space.
      const { data: r } = await admin.from('retailers').select('country').eq('user_id', caller.userId).maybeSingle()
      const country = normalizeCountry(r?.country ?? null) ?? 'US'
      if (country === 'US') {
        destination = REFERENCE_US_ADDRESS
        destinationIsReference = true
      }
    }

    const quote = await quoteCart({
      admin,
      shippo,
      items: items.map((i: { magazine_id: string; quantity: number }) => ({ magazine_id: i.magazine_id, quantity: Math.floor(i.quantity) })),
      destination,
      destinationIsReference,
      retailerUserId: caller.userId,
      persist: body.persist !== false && !destinationIsReference,
    })
    return json(quote, 200, cors)
  } catch (err) {
    console.error('quote-shipping error:', err instanceof Error ? err.message : err)
    return json({ error: 'Could not quote shipping right now' }, 500, cors)
  }
})
