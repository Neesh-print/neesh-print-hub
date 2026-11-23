import { adminClient, json } from '../_shared/http.ts'
import { processDemandLoop } from '../_shared/demand-loop.ts'

// Automations 3 and 4 (demand-signal spec). Hourly via pg_cron
// (process-demand-loop-hourly), and right after each new space request via
// the directory_demand_signals_route_space trigger with
// { only: 'route', signalId }. Routes space requests to a Neesh space or a
// hot Nustand lead, drafts requester emails E, F and G, and closes requests
// with no match in 120 days. Drafts only: nothing is sent from here.
// verify_jwt = false, guarded by REMINDER_SECRET in x-reminder-secret.

const cors = { 'Access-Control-Allow-Origin': '*' }

Deno.serve(async (req) => {
  const secret = Deno.env.get('REMINDER_SECRET')
  if (!secret) return json({ error: 'REMINDER_SECRET not configured' }, 500, cors)
  if (req.headers.get('x-reminder-secret') !== secret) return json({ error: 'Unauthorized' }, 401, cors)
  try {
    const body = await req.json().catch(() => ({}))
    const signalId = Number.isInteger(body?.signalId) ? body.signalId : undefined
    const results = await processDemandLoop(adminClient(), { only: body?.only === 'route' ? 'route' : undefined, signalId })
    return json({ ok: true, results }, 200, cors)
  } catch (err) {
    console.error('process-demand-loop failed', err)
    return json({ error: err instanceof Error ? err.message : 'failed' }, 500, cors)
  }
})
