import { missingPaymentMessage, planRefund } from './refund-plan.ts'

const assertEquals = (a: unknown, b: unknown) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} !== ${JSON.stringify(b)}`)
}

const paid = { payment_method: 'pay_now', payment_status: 'paid', total_price: '121.00' }
const charge = (amount: number, amount_refunded = 0, extra = {}) => ({ status: 'succeeded', amount, amount_refunded, ...extra })

Deno.test('the only order on a charge refunds everything left, shipping included', () => {
  assertEquals(planRefund(paid, charge(13100), 0), { ok: true, amountCents: 13100, full: true })
})

Deno.test('an order sharing a charge refunds only its own total', () => {
  assertEquals(planRefund(paid, charge(30000), 2), { ok: true, amountCents: 12100, full: false })
})

Deno.test('the last order on a partly refunded charge refunds the rest', () => {
  assertEquals(planRefund(paid, charge(30000, 17900), 0), { ok: true, amountCents: 12100, full: true })
})

Deno.test('refuses orders that cannot be refunded here', () => {
  assertEquals(planRefund({ ...paid, payment_status: 'refunded' }, charge(12100), 0).ok, false)
  assertEquals(planRefund({ ...paid, payment_status: 'disputed' }, charge(12100), 0).ok, false)
  assertEquals(planRefund({ ...paid, payment_method: 'net_30' }, charge(12100), 0).ok, false)
  assertEquals(planRefund({ ...paid, payment_status: 'unpaid' }, charge(12100), 0).ok, false)
  assertEquals(planRefund({ ...paid, payment_status: 'written_off' }, charge(12100), 0).ok, false)
  assertEquals(planRefund(paid, null, 0).ok, false)
  assertEquals(planRefund(paid, charge(12100, 0, { status: 'pending' }), 0).ok, false)
  assertEquals(planRefund(paid, charge(12100, 0, { disputed: true }), 0).ok, false)
  assertEquals(planRefund(paid, charge(12100, 12100), 0).ok, false)
  assertEquals(planRefund(paid, charge(30000, 20000), 1).ok, false)
})

Deno.test('explains payments the live Stripe account cannot see', () => {
  assertEquals(missingPaymentMessage('cs_test_abc', 'pi_123').includes('test mode'), true)
  assertEquals(missingPaymentMessage('cs_demo_abc', 'pi_demo_undergrowth_0001').includes('demo order'), true)
  assertEquals(missingPaymentMessage(null, 'pi_demo_x').includes('demo order'), true)
  assertEquals(missingPaymentMessage('cs_live_abc', 'pi_123').includes('no record'), true)
})
