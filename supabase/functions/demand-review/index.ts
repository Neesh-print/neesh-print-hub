import { adminClient, corsHeaders, getCaller, json } from '../_shared/http.ts'
import { draftPublisherOutreach, revalidateIndex, sendOutreach, verifySuggestions } from '../_shared/demand.ts'
import { draftSuggestionThanks, processDemandLoop } from '../_shared/demand-loop.ts'
import { loadRollup } from '../_shared/demand-rollup-data.ts'

// Admin actions for the Demand queue (demand-signal spec, Automations 1 and
// 2). Admin only, checked against public.users.role. Every write runs as the
// service role; the app only reads these tables.
//
//   approve_suggestion { id }             store + stockist rows, refresh the Index pages, draft template D
//   approve_confirmed {}                  the same for every confirmed suggestion
//   reject_suggestion { id, reason }      not_stocked | closed | spam | other
//   reverify_suggestion { id }            run the checks again
//   run_verify {}                         check every new suggestion now
//   run_drafts {}                         draft publisher emails now
//   run_loop {}                           route space requests, draft requester emails now
//   preview_rollup {}                     this week's Monday rollup, not sent
//   update_draft { id, subject, body }
//   send_outreach { id }                  send one approved draft through Resend
//   skip_outreach { id, reason }

const REJECT_REASONS = new Set(['not_stocked', 'closed', 'spam', 'other'])

async function approve(db: ReturnType<typeof adminClient>, id: string, reviewer: string) {
  const { data, error } = await db.rpc('directory_approve_stockist_suggestion', { p_id: id, p_reviewer: reviewer })
  if (error) throw new Error(error.message)
  const r = data as { title_slug?: string; store_slug?: string; city_slug?: string | null }
  const paths = [
    r.title_slug && `/titles/${r.title_slug}`,
    r.store_slug && `/stores/${r.store_slug}`,
    r.city_slug && `/cities/${r.city_slug}`,
  ].filter(Boolean) as string[]
  // Template D: thank the suggester, as a draft like every requester email.
  const thanks = await draftSuggestionThanks(db, id).catch((err) => String(err))
  return { ...r, paths, thanks: thanks ?? 'drafted' }
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const db = adminClient()
  const caller = await getCaller(req, db)
  if (!caller) return json({ error: 'Sign in again' }, 401, cors)
  if (caller.role !== 'admin') return json({ error: 'Admins only' }, 403, cors)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400, cors)
  }
  const id = typeof body.id === 'string' ? body.id : ''

  try {
    switch (body.action) {
      case 'approve_suggestion': {
        const r = await approve(db, id, caller.userId)
        const revalidated = await revalidateIndex(r.paths)
        return json({ ok: true, revalidated, paths: r.paths, thanks: r.thanks }, 200, cors)
      }
      case 'approve_confirmed': {
        const { data } = await db
          .from('directory_stockist_suggestions')
          .select('id')
          .eq('status', 'needs_review')
          .eq('confidence', 'confirmed')
        const paths = new Set<string>()
        const failed: { id: string; error: string }[] = []
        for (const row of data ?? []) {
          try {
            for (const p of (await approve(db, row.id, caller.userId)).paths) paths.add(p)
          } catch (err) {
            failed.push({ id: row.id, error: err instanceof Error ? err.message : String(err) })
          }
        }
        const revalidated = await revalidateIndex([...paths])
        return json({ ok: true, approved: (data ?? []).length - failed.length, failed, revalidated }, 200, cors)
      }
      case 'reject_suggestion': {
        const reason = String(body.reason ?? '')
        if (!REJECT_REASONS.has(reason)) return json({ error: 'Pick a reason' }, 400, cors)
        const { data, error } = await db
          .from('directory_stockist_suggestions')
          .update({ status: 'rejected', reject_reason: reason, reviewed_at: new Date().toISOString(), reviewed_by: caller.userId })
          .eq('id', id)
          .in('status', ['new', 'verifying', 'needs_review'])
          .select('id')
        if (error) throw new Error(error.message)
        if (!data?.length) return json({ error: 'This suggestion was already decided' }, 409, cors)
        return json({ ok: true }, 200, cors)
      }
      case 'reverify_suggestion':
        return json({ ok: true, results: await verifySuggestions(db, { ids: [id], limit: 1 }) }, 200, cors)
      case 'run_verify':
        return json({ ok: true, results: await verifySuggestions(db, { limit: 25 }) }, 200, cors)
      case 'run_drafts':
        return json({ ok: true, ...(await draftPublisherOutreach(db)) }, 200, cors)
      case 'run_loop':
        return json({ ok: true, loop: await processDemandLoop(db) }, 200, cors)
      case 'preview_rollup': {
        const r = await loadRollup(db)
        return json({ ok: true, rollup: { subject: r.subject, html: r.html, empty: r.empty } }, 200, cors)
      }
      case 'update_draft': {
        const subject = String(body.subject ?? '').trim()
        const text = String(body.body ?? '').trim()
        if (!subject || !text) return json({ error: 'Subject and body are required' }, 400, cors)
        const { data, error } = await db
          .from('outreach_log')
          .update({ subject, body: text })
          .eq('id', id)
          .eq('status', 'draft')
          .select('id')
        if (error) throw new Error(error.message)
        if (!data?.length) return json({ error: 'Only drafts can be edited' }, 409, cors)
        return json({ ok: true }, 200, cors)
      }
      case 'send_outreach':
        return json({ ok: true, ...(await sendOutreach(db, id, caller.userId)) }, 200, cors)
      case 'skip_outreach': {
        const reason = String(body.reason ?? '').trim() || 'skipped by admin'
        const { data, error } = await db
          .from('outreach_log')
          .update({ status: 'skipped', skip_reason: reason.slice(0, 300) })
          .eq('id', id)
          .eq('status', 'draft')
          .select('id')
        if (error) throw new Error(error.message)
        if (!data?.length) return json({ error: 'Only drafts can be skipped' }, 409, cors)
        return json({ ok: true }, 200, cors)
      }
      default:
        return json({ error: 'Unknown action' }, 400, cors)
    }
  } catch (err) {
    console.error('demand-review', body.action, err)
    return json({ error: err instanceof Error ? err.message : 'Something went wrong' }, 500, cors)
  }
})
