import { adminClient, json } from '../_shared/http.ts'
import { verifySuggestions } from '../_shared/demand.ts'

// Automation 1 (demand-signal spec): checks new shop suggestions and moves
// them to needs_review with evidence for the admin queue. Called every 15
// minutes by pg_cron (job verify-stockist-suggestions) when there are new
// rows. verify_jwt = false, guarded by the shared REMINDER_SECRET in the
// x-reminder-secret header, like the reminder jobs. Body: { ids?, limit? }.

const cors = { 'Access-Control-Allow-Origin': '*' }

Deno.serve(async (req) => {
  const secret = Deno.env.get('REMINDER_SECRET')
  if (!secret) return json({ error: 'REMINDER_SECRET not configured' }, 500, cors)
  if (req.headers.get('x-reminder-secret') !== secret) return json({ error: 'Unauthorized' }, 401, cors)
  try {
    const body = await req.json().catch(() => ({}))
    const ids = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === 'string') : undefined
    const limit = Math.min(Math.max(Number(body?.limit) || 10, 1), 25)
    const results = await verifySuggestions(adminClient(), { ids, limit })
    return json({ ok: true, results }, 200, cors)
  } catch (err) {
    console.error('verify-stockist-suggestions failed', err)
    return json({ error: err instanceof Error ? err.message : 'failed' }, 500, cors)
  }
})
