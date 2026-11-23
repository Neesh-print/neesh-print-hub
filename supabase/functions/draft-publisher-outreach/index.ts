import { adminClient, json } from '../_shared/http.ts'
import { draftPublisherOutreach } from '../_shared/demand.ts'

// Automation 2 (demand-signal spec): reads v_title_demand daily at 10am ET
// and writes publisher emails (templates A, B, C) to outreach_log as drafts.
// Nothing is sent from here: Gem approves each draft in the admin Demand
// queue. verify_jwt = false, guarded by REMINDER_SECRET in x-reminder-secret.
// Body: { dryRun?: boolean } returns what would be drafted without writing.

const cors = { 'Access-Control-Allow-Origin': '*' }

Deno.serve(async (req) => {
  const secret = Deno.env.get('REMINDER_SECRET')
  if (!secret) return json({ error: 'REMINDER_SECRET not configured' }, 500, cors)
  if (req.headers.get('x-reminder-secret') !== secret) return json({ error: 'Unauthorized' }, 401, cors)
  try {
    const body = await req.json().catch(() => ({}))
    const result = await draftPublisherOutreach(adminClient(), { dryRun: body?.dryRun === true })
    return json({ ok: true, ...result }, 200, cors)
  } catch (err) {
    console.error('draft-publisher-outreach failed', err)
    return json({ error: err instanceof Error ? err.message : 'failed' }, 500, cors)
  }
})
