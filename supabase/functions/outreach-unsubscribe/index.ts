import { adminClient } from '../_shared/http.ts'
import { suppress, verifyUnsubscribe } from '../_shared/demand.ts'

// One-click unsubscribe for demand emails (demand-signal spec, Automation 3).
// The link carries an outreach_log id and an HMAC of it, so no address is in
// the URL. GET from the email body, POST from mail clients that honour
// List-Unsubscribe-Post. Public: verify_jwt = false.

const text = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'POST') return text('Method not allowed', 405)
  const url = new URL(req.url)
  const id = url.searchParams.get('id') ?? ''
  const token = url.searchParams.get('t') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id) || !(await verifyUnsubscribe(id, token))) {
    return text('This unsubscribe link is not valid. Reply to the email and we will take you off the list.', 400)
  }
  const db = adminClient()
  const { data: row } = await db.from('outreach_log').select('recipient_email').eq('id', id).maybeSingle()
  if (!row) return text('This unsubscribe link has expired. Reply to the email and we will take you off the list.', 404)
  await suppress(db, row.recipient_email, 'unsubscribed', id)
  return text("You're unsubscribed. Neesh won't send you these emails again.")
})
