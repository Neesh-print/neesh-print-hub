import { chargeFromSession, findSourceCharge, type SourceChargeStripe } from './source-charge.ts'

const assertEquals = (a: unknown, b: unknown) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} !== ${JSON.stringify(b)}`)
}

type Charge = string | { id: string; status?: string; currency?: string } | null
const session = (charge: Charge) => ({ payment_intent: { id: 'pi_1', latest_charge: charge } })

Deno.test('uses a succeeded USD charge', () => {
  assertEquals(chargeFromSession(session({ id: 'ch_1', status: 'succeeded', currency: 'usd' })), { chargeId: 'ch_1' })
})

Deno.test('skips charges that have not succeeded', () => {
  assertEquals(chargeFromSession(session({ id: 'ch_1', status: 'pending', currency: 'usd' })), null)
  assertEquals(chargeFromSession(session({ id: 'ch_1', status: 'failed', currency: 'usd' })), null)
})

Deno.test('skips a charge in another currency', () => {
  assertEquals(chargeFromSession(session({ id: 'ch_1', status: 'succeeded', currency: 'eur' })), null)
})

Deno.test('returns null when nothing is expanded or there is no payment', () => {
  assertEquals(chargeFromSession(null), null)
  assertEquals(chargeFromSession({ payment_intent: null }), null)
  assertEquals(chargeFromSession({ payment_intent: 'pi_1' }), null)
  assertEquals(chargeFromSession(session('ch_1')), null)
  assertEquals(chargeFromSession(session(null)), null)
})

const fakeStripe = (impl: (id: string) => Promise<unknown>): SourceChargeStripe => ({
  checkout: { sessions: { retrieve: (id: string) => impl(id) as never } },
})

Deno.test('findSourceCharge expands the charge and returns it', async () => {
  let seen = ''
  const stripe: SourceChargeStripe = {
    checkout: {
      sessions: {
        retrieve: (id, params) => {
          seen = `${id}:${params.expand.join(',')}`
          return Promise.resolve(session({ id: 'ch_9', status: 'succeeded', currency: 'usd' }))
        },
      },
    },
  }
  assertEquals(await findSourceCharge(stripe, 'cs_1'), { chargeId: 'ch_9' })
  assertEquals(seen, 'cs_1:payment_intent.latest_charge')
})

Deno.test('findSourceCharge never throws and skips missing sessions', async () => {
  assertEquals(await findSourceCharge(fakeStripe(() => Promise.reject(new Error('boom'))), 'cs_1'), null)
  assertEquals(await findSourceCharge(fakeStripe(() => Promise.reject(new Error('unused'))), null), null)
  assertEquals(await findSourceCharge(fakeStripe(() => Promise.reject(new Error('unused'))), ''), null)
})
