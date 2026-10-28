/**
 * Minimal typed Shippo REST client (T9).
 *
 * Token: the SHIPPO_API_KEY secret (shippo_test_... everywhere except
 * production). Logs carry object ids and amounts, never addresses.
 */
import { usdAmount, type CarrierRate, type CustomsDeclaration, type Parcel, type ShipAddress } from './shipping.ts'

export const SHIPPO_BASE_URL = 'https://api.goshippo.com'

export class ShippoError extends Error {
  constructor(message: string, public status: number, public body: unknown) {
    super(message)
  }
}

export interface ShippoShipment {
  object_id: string
  status: string
  rates: CarrierRate[]
  messages?: { source?: string; code?: string; text?: string }[]
}

export interface ShippoTransaction {
  object_id: string
  status: 'SUCCESS' | 'ERROR' | 'QUEUED' | 'WAITING' | 'REFUNDED' | 'REFUNDPENDING' | 'REFUNDREJECTED'
  rate: string
  label_url?: string | null
  tracking_number?: string | null
  tracking_url_provider?: string | null
  commercial_invoice_url?: string | null
  messages?: { source?: string; code?: string; text?: string }[]
}

export interface ShippoRefund {
  object_id: string
  status: 'QUEUED' | 'PENDING' | 'SUCCESS' | 'ERROR'
  transaction: string
}

export interface ShippoTrack {
  carrier: string
  tracking_number: string
  tracking_status?: { status?: string; status_details?: string; status_date?: string } | null
}

type FetchLike = typeof fetch
type Sleep = (ms: number) => Promise<void>

const defaultSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** How long ratesInCurrency waits for a re-queued shipment, in total about 3 seconds. */
const CONVERT_WAITS_MS = [300, 600, 900, 1200]

export interface ShippoClient {
  createShipment(input: {
    from: ShipAddress
    to: ShipAddress
    parcel: Parcel
    customs?: CustomsDeclaration | null
    metadata?: string
  }): Promise<ShippoShipment>
  /**
   * The shipment's rates re-priced into `currency` (in `amount_local`). Shippo
   * re-queues the shipment to convert, so this waits for the rates to return.
   */
  ratesInCurrency(shipmentId: string, currency: string): Promise<CarrierRate[]>
  buyLabel(rateId: string, metadata?: string): Promise<ShippoTransaction>
  refundLabel(transactionId: string): Promise<ShippoRefund>
  getTracking(carrier: string, trackingNumber: string): Promise<ShippoTrack>
  /** Ask Shippo to follow a tracking number, so track_updated webhooks fire for it. */
  registerTracking(carrier: string, trackingNumber: string, metadata?: string): Promise<ShippoTrack>
}

/**
 * Shippo's carrier token for a carrier as publishers enter it, or null when
 * Shippo can't follow it ("other", Amazon Logistics).
 */
export function shippoCarrierToken(carrier: string | null | undefined): string | null {
  const key = (carrier ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '')
  const tokens: Record<string, string> = {
    usps: 'usps',
    ups: 'ups',
    fedex: 'fedex',
    dhl: 'dhl_express',
    dhlexpress: 'dhl_express',
    canadapost: 'canada_post',
    royalmail: 'royal_mail',
  }
  return tokens[key] ?? null
}

const toShippoAddress = (a: ShipAddress) => ({
  name: a.name,
  company: a.company ?? undefined,
  street1: a.line1,
  street2: a.line2 ?? undefined,
  city: a.city,
  state: a.state ?? undefined,
  zip: a.postal_code,
  country: a.country,
  phone: a.phone ?? undefined,
  email: a.email ?? undefined,
})

export function createShippoClient(apiKey: string, fetchImpl: FetchLike = fetch, sleep: Sleep = defaultSleep): ShippoClient {
  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const res = await fetchImpl(`${SHIPPO_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `ShippoToken ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    let json: unknown = null
    try { json = text ? JSON.parse(text) : null } catch { json = text }
    if (!res.ok) {
      throw new ShippoError(`Shippo ${method} ${path} failed with ${res.status}`, res.status, json)
    }
    return json as T
  }

  return {
    async createShipment({ from, to, parcel, customs, metadata }) {
      const shipment = await call<ShippoShipment>('POST', '/shipments/', {
        address_from: toShippoAddress(from),
        address_to: toShippoAddress(to),
        parcels: [{
          length: String(parcel.lengthCm),
          width: String(parcel.widthCm),
          height: String(parcel.heightCm),
          distance_unit: 'cm',
          weight: String(parcel.weightGrams),
          mass_unit: 'g',
        }],
        ...(customs ? { customs_declaration: customs } : {}),
        ...(metadata ? { metadata } : {}),
        async: false,
      })
      console.log(`shippo shipment ${shipment.object_id} status=${shipment.status} rates=${shipment.rates?.length ?? 0}`)
      return shipment
    },

    async ratesInCurrency(shipmentId, currency) {
      const path = `/shipments/${encodeURIComponent(shipmentId)}/rates/${encodeURIComponent(currency)}?results=100`
      for (let attempt = 0; ; attempt++) {
        const page = await call<{ results?: CarrierRate[] }>('GET', path)
        const rates = page?.results ?? []
        if (rates.length > 0 || attempt >= CONVERT_WAITS_MS.length) {
          console.log(`shippo shipment ${shipmentId} rates in ${currency}=${rates.length} after ${attempt + 1} call(s)`)
          return rates
        }
        await sleep(CONVERT_WAITS_MS[attempt])
      }
    },

    async buyLabel(rateId, metadata) {
      const tx = await call<ShippoTransaction>('POST', '/transactions/', {
        rate: rateId,
        label_file_type: 'PDF_4x6',
        async: false,
        ...(metadata ? { metadata } : {}),
      })
      console.log(`shippo transaction ${tx.object_id} status=${tx.status} rate=${rateId}`)
      return tx
    },

    async refundLabel(transactionId) {
      const refund = await call<ShippoRefund>('POST', '/refunds/', { transaction: transactionId, async: false })
      console.log(`shippo refund ${refund.object_id} status=${refund.status} transaction=${transactionId}`)
      return refund
    },

    async getTracking(carrier, trackingNumber) {
      return await call<ShippoTrack>('GET', `/tracks/${encodeURIComponent(carrier)}/${encodeURIComponent(trackingNumber)}`)
    },

    async registerTracking(carrier, trackingNumber, metadata) {
      const track = await call<ShippoTrack>('POST', '/tracks/', {
        carrier,
        tracking_number: trackingNumber,
        ...(metadata ? { metadata } : {}),
      })
      console.log(`shippo track registered ${carrier} status=${track.tracking_status?.status ?? 'none'}`)
      return track
    },
  }
}

/**
 * The shipment's rates, each with a USD price. Shippo prices rates in the
 * origin and destination currencies, so a Toronto to Toronto or Berlin to
 * Berlin shipment has no USD price at all. When any rate lacks one, the rates
 * are re-requested in USD (same rate ids, so a label can still be bought from
 * them). A failed or unfinished conversion throws a ShippoError, so callers
 * treat it as Shippo being unavailable rather than caching "no rate".
 */
export async function withUsdPrices(shippo: Pick<ShippoClient, 'ratesInCurrency'>, shipment: ShippoShipment): Promise<CarrierRate[]> {
  const rates = shipment.rates ?? []
  if (rates.every((r) => usdAmount(r) !== null)) return rates
  const converted = new Map((await shippo.ratesInCurrency(shipment.object_id, 'USD')).map((r) => [r.object_id, r]))
  // Shippo still converting after the wait is a slow Shippo, not a route with no rate.
  if (converted.size === 0) throw new ShippoError(`Shippo had no USD rates ready for shipment ${shipment.object_id}`, 504, null)
  return rates.map((r) => (usdAmount(r) !== null ? r : converted.get(r.object_id) ?? r))
}
