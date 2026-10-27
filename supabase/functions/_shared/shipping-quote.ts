/**
 * Server-side shipping quotes (T3, T10). Used by quote-shipping and
 * create-checkout so the cart and Stripe always see the same numbers.
 *
 * Live Shippo rates are the default (decision 1). A publisher's own flat
 * rates are an optional override. When no live quote can be had (no address,
 * no weight, no carrier) the group is blocked instead of guessed.
 */
import type { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  QUOTE_TTL_DAYS,
  RATE_CACHE_TTL_MINUTES,
  buildCustomsDeclaration,
  buildParcel,
  checkMinimums,
  destinationKey,
  flatRatesFor,
  flatShipping,
  incotermFor,
  isQuotableAddress,
  itemsKey,
  normalizeCountry,
  pickCheapestTrackedRate,
  rateCacheKey,
  regionFor,
  round2,
  zoneFor,
  type CarrierRate,
  type CustomsDeclaration,
  type FlatRatesByRegion,
  type PackagingPreset,
  type Parcel,
  type ShipAddress,
  type TitleShortfall,
  type Zone,
} from './shipping.ts'
import type { ShippoClient } from './shippo.ts'

type Admin = ReturnType<typeof createClient>

export interface CartLine {
  magazine_id: string
  quantity: number
}

export type BlockedReason =
  | 'no_international'
  | 'no_origin'
  | 'missing_weight'
  | 'no_rate'
  | 'minimum'
  | 'unavailable'

export interface LiveRate {
  shippingUsd: number
  amountLocal: number | null
  currencyLocal: string | null
  carrier: string
  service: string | null
  serviceToken: string | null
  estimatedDays: number | null
  rateId: string
  shipmentId: string
}

export interface QuoteGroup {
  publisher_id: string
  publisher_name: string
  origin_country: string | null
  origin_city: string | null
  destination_country: string
  zone: Zone
  copies: number
  items: CartLine[]
  intl_minimum: number | null
  intl_short: number
  title_shortfalls: TitleShortfall[]
  can_ship: boolean
  blocked_reason: BlockedReason | null
  shipping_usd: number | null
  rate_source: 'shippo' | 'flat' | null
  carrier: string | null
  service: string | null
  estimated_days: number | null
  duties_paid: boolean
  uses_neesh_labels: boolean
  quote_id: string | null
  quote_expires_at: string | null
}

export interface CartQuote {
  status: 'ok' | 'needs_address'
  destination: { city: string; state: string | null; country: string; postal_code: string } | null
  destination_is_reference: boolean
  groups: QuoteGroup[]
}

interface MagazineRow {
  id: string
  title: string
  wholesale_price: number | null
  minimum_order_quantity: number | null
  weight_grams: number | null
  width_mm: number | null
  height_mm: number | null
  publisher_id: string
  is_active: boolean | null
}

interface PublisherRow {
  id: string
  company_name: string | null
  ships_from_country: string | null
  shipping_rate_mode: 'live' | 'flat'
  flat_rates: FlatRatesByRegion | null
  ships_internationally: boolean
  uses_neesh_labels: boolean
  packaging_preset: PackagingPreset
  intl_min_copies: number
}

interface StoredQuoteRow {
  id: string
  publisher_id: string
  items_key: string
  destination_key: string
  expires_at: string
  shipping_usd: number
  rate_source: 'shippo' | 'flat'
  carrier: string | null
  service: string | null
  estimated_days: number | null
  duties_paid: boolean
}

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v))

/** The space's saved shipping address, or null (T3: needs_address). */
export async function resolveRetailerDestination(admin: Admin, userId: string): Promise<ShipAddress | null> {
  const { data: retailer } = await admin
    .from('retailers')
    .select('id, shop_name, contact_name, phone, contact_email')
    .eq('user_id', userId)
    .maybeSingle()
  if (!retailer) return null

  const { data: addr } = await admin
    .from('shipping_addresses')
    .select('recipient_name, company_name, address_line_1, address_line_2, city, state, postal_code, country, phone')
    .eq('retailer_id', retailer.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!addr) return null

  const candidate: Partial<ShipAddress> = {
    name: addr.recipient_name || retailer.contact_name || retailer.shop_name || 'Receiving',
    company: addr.company_name || retailer.shop_name || null,
    phone: addr.phone || retailer.phone || null,
    email: retailer.contact_email || null,
    line1: addr.address_line_1,
    line2: addr.address_line_2,
    city: addr.city,
    state: addr.state,
    postal_code: addr.postal_code,
    country: normalizeCountry(addr.country) ?? '',
  }
  return isQuotableAddress(candidate) ? candidate : null
}

/** The publisher's private ships-from address, or null. */
export async function loadShipsFrom(admin: Admin, publisherId: string, fallbackName: string | null): Promise<ShipAddress | null> {
  const { data } = await admin
    .from('publisher_shipping_settings')
    .select('ships_from_address')
    .eq('publisher_id', publisherId)
    .maybeSingle()
  const a = (data?.ships_from_address ?? null) as Partial<ShipAddress> | null
  if (!a) return null
  const candidate = { ...a, name: a.name || fallbackName || 'Shipping', country: normalizeCountry(a.country ?? null) ?? '' }
  return isQuotableAddress(candidate) ? (candidate as ShipAddress) : null
}

/**
 * Cheapest tracked live rate for one parcel, through the short-lived cache.
 * Returns null on any Shippo error or when no carrier quotes (logged, never guessed).
 */
export async function liveRate(
  admin: Admin,
  shippo: ShippoClient | null,
  input: { origin: ShipAddress; destination: ShipAddress; parcel: Parcel; customs: CustomsDeclaration | null },
): Promise<LiveRate | null> {
  const key = rateCacheKey(input.origin, input.destination, input.parcel.weightGrams, input.parcel.packaging)
  const { data: cached } = await admin
    .from('shipping_rate_cache')
    .select('result, expires_at')
    .eq('cache_key', key)
    .maybeSingle()
  if (cached && new Date(cached.expires_at as string).getTime() > Date.now()) {
    return (cached.result as { rate: LiveRate | null }).rate
  }

  if (!shippo) {
    console.warn('quote: SHIPPO_API_KEY not set, no live rate')
    return null
  }

  let rate: LiveRate | null = null
  try {
    const shipment = await shippo.createShipment({
      from: input.origin,
      to: input.destination,
      parcel: input.parcel,
      customs: input.customs,
    })
    const best: CarrierRate | null = pickCheapestTrackedRate(shipment.rates)
    if (best) {
      rate = {
        shippingUsd: round2(parseFloat(best.amount)),
        amountLocal: num(best.amount_local),
        currencyLocal: best.currency_local ?? null,
        carrier: best.provider,
        service: best.servicelevel?.name ?? null,
        serviceToken: best.servicelevel?.token ?? null,
        estimatedDays: best.estimated_days ?? null,
        rateId: best.object_id,
        shipmentId: shipment.object_id,
      }
    } else {
      console.warn(`quote: no tracked USD rate on shipment ${shipment.object_id}`)
    }
  } catch (err) {
    console.error('quote: Shippo rate request failed:', err instanceof Error ? err.message : err)
    // Do not cache failures: Shippo being briefly down should not block for 30 minutes.
    return null
  }

  await admin.from('shipping_rate_cache').upsert({
    cache_key: key,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + RATE_CACHE_TTL_MINUTES * 60_000).toISOString(),
    result: { rate },
  })
  return rate
}

/** Quote every publisher group in a cart (or a hypothetical cart on the title page). */
export async function quoteCart(opts: {
  admin: Admin
  shippo: ShippoClient | null
  items: CartLine[]
  destination: ShipAddress | null
  destinationIsReference?: boolean
  retailerUserId: string
  persist: boolean
  reuseQuoteIds?: string[]
}): Promise<CartQuote> {
  const { admin, shippo, destination } = opts
  const items = opts.items.filter((i) => i.quantity > 0)

  if (!destination) {
    return { status: 'needs_address', destination: null, destination_is_reference: false, groups: [] }
  }
  const destCountry = normalizeCountry(destination.country) ?? 'US'

  const { data: magazineRows, error: magErr } = await admin
    .from('magazines')
    .select('id, title, wholesale_price, minimum_order_quantity, weight_grams, width_mm, height_mm, publisher_id, is_active')
    .in('id', items.map((i) => i.magazine_id))
  if (magErr) throw new Error(`Failed to load titles: ${magErr.message}`)
  const magazines = new Map((magazineRows as MagazineRow[] | null ?? []).map((m) => [m.id, m]))

  const byPublisher = new Map<string, CartLine[]>()
  for (const item of items) {
    const m = magazines.get(item.magazine_id)
    if (!m) continue
    if (!byPublisher.has(m.publisher_id)) byPublisher.set(m.publisher_id, [])
    byPublisher.get(m.publisher_id)!.push(item)
  }

  const publisherIds = [...byPublisher.keys()]
  const { data: publisherRows } = await admin
    .from('publishers')
    .select('id, company_name, ships_from_country, shipping_rate_mode, flat_rates, ships_internationally, uses_neesh_labels, packaging_preset, intl_min_copies')
    .in('id', publisherIds.length ? publisherIds : ['00000000-0000-0000-0000-000000000000'])
  const publishers = new Map((publisherRows as PublisherRow[] | null ?? []).map((p) => [p.id, p]))

  let stored: StoredQuoteRow[] = []
  if (opts.reuseQuoteIds?.length) {
    const { data } = await admin
      .from('shipping_quotes')
      .select('id, publisher_id, items_key, destination_key, expires_at, shipping_usd, rate_source, carrier, service, estimated_days, duties_paid')
      .in('id', opts.reuseQuoteIds)
      .eq('retailer_user_id', opts.retailerUserId)
    stored = (data as StoredQuoteRow[] | null) ?? []
  }

  const destKey = destinationKey(destination)
  const groups: QuoteGroup[] = []

  for (const [publisherId, lines] of byPublisher) {
    const pub = publishers.get(publisherId)
    const name = pub?.company_name || 'Publisher'
    const origin = pub ? await loadShipsFrom(admin, publisherId, name) : null
    const originCountry = normalizeCountry(origin?.country ?? pub?.ships_from_country ?? null)
    const zone = zoneFor(originCountry, destCountry)
    const lineMags = lines.map((l) => ({ line: l, mag: magazines.get(l.magazine_id)! }))
    const minimums = checkMinimums(zone, pub?.intl_min_copies, lineMags.map(({ line, mag }) => ({
      magazineId: mag.id,
      title: mag.title,
      quantity: line.quantity,
      minimumOrderQuantity: mag.minimum_order_quantity,
    })))

    const group: QuoteGroup = {
      publisher_id: publisherId,
      publisher_name: name,
      origin_country: originCountry,
      origin_city: origin?.city ?? null,
      destination_country: destCountry,
      zone,
      copies: minimums.copies,
      items: lines,
      intl_minimum: minimums.intlMinimum,
      intl_short: minimums.intlShort,
      title_shortfalls: minimums.titleShortfalls,
      can_ship: false,
      blocked_reason: null,
      shipping_usd: null,
      rate_source: null,
      carrier: null,
      service: null,
      estimated_days: null,
      duties_paid: false,
      uses_neesh_labels: !!pub?.uses_neesh_labels,
      quote_id: null,
      quote_expires_at: null,
    }
    groups.push(group)

    if (!pub || lineMags.some(({ mag }) => !mag.is_active)) { group.blocked_reason = 'unavailable'; continue }
    if (zone === 'international' && !pub.ships_internationally) { group.blocked_reason = 'no_international'; continue }
    if (!minimums.ok) { group.blocked_reason = 'minimum'; continue }

    const key = itemsKey(lines)
    const reuse = stored.find((s) =>
      s.publisher_id === publisherId && s.items_key === key && s.destination_key === destKey &&
      new Date(s.expires_at).getTime() > Date.now())
    if (reuse) {
      Object.assign(group, {
        can_ship: true,
        shipping_usd: Number(reuse.shipping_usd),
        rate_source: reuse.rate_source,
        carrier: reuse.carrier,
        service: reuse.service,
        estimated_days: reuse.estimated_days,
        duties_paid: reuse.duties_paid,
        quote_id: reuse.id,
        quote_expires_at: reuse.expires_at,
      })
      continue
    }

    const parcel = buildParcel(lineMags.map(({ line, mag }) => ({
      quantity: line.quantity,
      weightGrams: mag.weight_grams,
      widthMm: mag.width_mm,
      heightMm: mag.height_mm,
    })), pub.packaging_preset)

    let shippingUsd: number | null = null
    let live: LiveRate | null = null
    let customs: CustomsDeclaration | null = null

    if (pub.shipping_rate_mode === 'flat') {
      shippingUsd = flatShipping(flatRatesFor(pub.flat_rates, regionFor(originCountry, destCountry)), minimums.copies)
      if (shippingUsd === null) { group.blocked_reason = 'no_rate'; continue }
    } else {
      if (!origin) { group.blocked_reason = 'no_origin'; continue }
      if (!parcel) { group.blocked_reason = 'missing_weight'; continue }
      customs = buildCustomsDeclaration({
        origin: origin.country,
        destination: destCountry,
        signer: origin.name,
        lines: lineMags.map(({ line, mag }) => ({
          quantity: line.quantity,
          weightGrams: mag.weight_grams ?? 0,
          wsp: Number(mag.wholesale_price ?? 0),
        })),
      })
      live = await liveRate(admin, shippo, { origin, destination, parcel, customs })
      if (!live) { group.blocked_reason = 'no_rate'; continue }
      shippingUsd = live.shippingUsd
    }

    const dutiesPaid = !!(originCountry && incotermFor(originCountry, destCountry))
    Object.assign(group, {
      can_ship: true,
      shipping_usd: shippingUsd,
      rate_source: live ? 'shippo' : 'flat',
      carrier: live?.carrier ?? null,
      service: live?.service ?? null,
      estimated_days: live?.estimatedDays ?? null,
      duties_paid: live ? dutiesPaid : false,
    })

    if (opts.persist) {
      const expiresAt = new Date(Date.now() + QUOTE_TTL_DAYS * 86_400_000).toISOString()
      const { data: row, error } = await admin
        .from('shipping_quotes')
        .insert({
          expires_at: expiresAt,
          retailer_user_id: opts.retailerUserId,
          publisher_id: publisherId,
          items: lines,
          items_key: key,
          destination,
          destination_key: destKey,
          origin_country: originCountry,
          destination_country: destCountry,
          zone,
          copies: minimums.copies,
          weight_grams: parcel?.weightGrams ?? null,
          parcel,
          shipping_usd: shippingUsd,
          rate_source: group.rate_source,
          shippo_shipment_id: live?.shipmentId ?? null,
          shippo_rate_id: live?.rateId ?? null,
          carrier: live?.carrier ?? null,
          service: live?.service ?? null,
          service_token: live?.serviceToken ?? null,
          rate_amount_local: live?.amountLocal ?? null,
          rate_currency_local: live?.currencyLocal ?? null,
          estimated_days: live?.estimatedDays ?? null,
          duties_paid: group.duties_paid,
        })
        .select('id')
        .single()
      if (error) {
        console.error('quote: failed to store quote:', error.message)
      } else {
        group.quote_id = row.id as string
        group.quote_expires_at = expiresAt
      }
    }
  }

  return {
    status: 'ok',
    destination: {
      city: destination.city,
      state: destination.state ?? null,
      country: destCountry,
      postal_code: destination.postal_code,
    },
    destination_is_reference: !!opts.destinationIsReference,
    groups,
  }
}

/** The shipping_v2 flag (shipping_config.shipping_v2_enabled). */
export async function shippingV2Enabled(admin: Admin): Promise<boolean> {
  const { data, error } = await admin.from('shipping_config').select('shipping_v2_enabled').maybeSingle()
  if (error) {
    console.error('shipping_config read failed:', error.message)
    return false
  }
  return !!data?.shipping_v2_enabled
}
