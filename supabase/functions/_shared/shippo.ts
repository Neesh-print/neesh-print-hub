/**
 * Minimal typed Shippo REST client (T9).
 *
 * Token: the SHIPPO_API_KEY secret (shippo_test_... everywhere except
 * production). Logs carry object ids and amounts, never addresses.
 */
import type { CarrierRate, CustomsDeclaration, Parcel, ShipAddress } from './shipping.ts'

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

export interface ShippoClient {
  createShipment(input: {
    from: ShipAddress
    to: ShipAddress
    parcel: Parcel
    customs?: CustomsDeclaration | null
    metadata?: string
  }): Promise<ShippoShipment>
  buyLabel(rateId: string, metadata?: string): Promise<ShippoTransaction>
  refundLabel(transactionId: string): Promise<ShippoRefund>
  getTracking(carrier: string, trackingNumber: string): Promise<ShippoTrack>
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

export function createShippoClient(apiKey: string, fetchImpl: FetchLike = fetch): ShippoClient {
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
  }
}
