import { adminClient, json } from '../_shared/http.ts'
import { loadRollup } from '../_shared/demand-rollup-data.ts'

// Automation 5 (demand-signal spec): the weekly demand rollup to Gem.
// pg_cron job send-demand-rollup-weekly calls this Mondays at 14:00 UTC
// (9am ET in winter). Skips the send on a week where sections 1 to 4 are all
// empty. verify_jwt = false, guarded by REMINDER_SECRET in x-reminder-secret.
// Body: { dryRun?: true } returns the email instead of sending it.

const cors = { 'Access-Control-Allow-Origin': '*' }
const TO = 'gem@neesh.art'

Deno.serve(async (req) => {
  const secret = Deno.env.get('REMINDER_SECRET')
  if (!secret) return json({ error: 'REMINDER_SECRET not configured' }, 500, cors)
  if (req.headers.get('x-reminder-secret') !== secret) return json({ error: 'Unauthorized' }, 401, cors)
  try {
    const body = await req.json().catch(() => ({}))
    const rollup = await loadRollup(adminClient())
    if (body?.dryRun === true) return json({ ok: true, ...rollup }, 200, cors)
    if (rollup.empty) return json({ ok: true, sent: false, reason: 'nothing to report' }, 200, cors)

    const key = Deno.env.get('RESEND_API_KEY')
    if (!key) return json({ error: 'Email service not configured' }, 500, cors)
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Neesh <hi@neesh.art>',
        to: [TO],
        subject: rollup.subject,
        html: rollup.html,
        text: rollup.text,
        tags: [{ name: 'campaign', value: 'demand-rollup' }],
      }),
    })
    const sent = await res.json().catch(() => ({}))
    if (!res.ok) return json({ error: `Resend refused the email: ${sent?.message ?? res.status}` }, 502, cors)
    return json({ ok: true, sent: true, id: sent.id, subject: rollup.subject }, 200, cors)
  } catch (err) {
    console.error('send-demand-rollup failed', err)
    return json({ error: err instanceof Error ? err.message : 'failed' }, 500, cors)
  }
})
