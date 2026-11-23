// Loads what the Monday demand rollup (Automation 5) reports on, then builds
// it with demand-rollup.ts. Used by send-demand-rollup (cron) and by
// demand-review's preview_rollup action.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { draftPublisherOutreach } from './demand.ts'
import { buildRollup, type Rollup, type RollupRequest } from './demand-rollup.ts'

type Db = SupabaseClient
const DAY = 86_400_000

const count = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
  const { count: n, error } = await q
  if (error) throw new Error(error.message)
  return n ?? 0
}

export async function loadRollup(db: Db, now = new Date()): Promise<Rollup> {
  const since = new Date(now.getTime() - 30 * DAY).toISOString()

  const [{ data: toReview }, { data: drafts }, { data: signals }, { data: suggestions }, { data: demand }, publisherPlan] =
    await Promise.all([
      db
        .from('directory_stockist_suggestions')
        .select('shop_name, city, confidence, title:directory_titles(name)')
        .in('status', ['new', 'verifying', 'needs_review'])
        .order('created_at'),
      db.from('outreach_log').select('template, recipient_type, title:directory_titles(name)').eq('status', 'draft'),
      db
        .from('directory_demand_signals')
        .select('title_id, requester_role, postcode, created_at, retailer_id, title:directory_titles(name)')
        .not('status', 'is', null)
        .gte('created_at', since),
      db.from('directory_stockist_suggestions').select('city, created_at').gte('created_at', since),
      db.from('v_title_demand').select('title_id, title_state'),
      // Titles that qualify for a publisher email but have no address on file.
      draftPublisherOutreach(db, { dryRun: true }),
    ])

  const stateOf = new Map((demand ?? []).map((d) => [d.title_id as string, d.title_state as string]))
  const retailerIds = [...new Set((signals ?? []).map((s) => s.retailer_id).filter(Boolean))] as string[]
  const { data: retailers } = retailerIds.length
    ? await db.from('retailers').select('id, city').in('id', retailerIds)
    : { data: [] }
  const cityOf = new Map((retailers ?? []).map((r) => [r.id as string, r.city as string | null]))

  const sentSince = (templates: string[]) =>
    count(
      db
        .from('outreach_log')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'sent')
        .in('template', templates)
        .gte('sent_at', since),
    )

  const [publishersContacted, requestersNotified, claims, nowSelling, stockistsAdded] = await Promise.all([
    sentSince(['A', 'B', 'C']),
    sentSince(['D', 'E', 'F', 'G']),
    count(db.from('directory_publishers').select('id', { count: 'exact', head: true }).gte('claimed_at', since)),
    count(db.from('directory_titles').select('id', { count: 'exact', head: true }).gte('neesh_listed_at', since)),
    count(
      db
        .from('directory_stockist_suggestions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved')
        .gte('reviewed_at', since),
    ),
  ])

  const name = (t: unknown) => (t as { name?: string } | null)?.name ?? null
  const requests: RollupRequest[] = (signals ?? []).map((s) => ({
    title_id: s.title_id,
    title_name: name(s.title) ?? 'Unknown title',
    title_state: stateOf.get(s.title_id) ?? null,
    role: s.requester_role,
    postcode: s.postcode,
    created_at: s.created_at,
    space_city: s.retailer_id ? cityOf.get(s.retailer_id) ?? null : null,
  }))

  return buildRollup({
    now,
    suggestionsToReview: (toReview ?? []).map((s) => ({
      shop: s.shop_name,
      city: s.city,
      title: name(s.title) ?? 'Unknown title',
      confidence: s.confidence,
    })),
    draftsWaiting: (drafts ?? []).map((d) => ({ template: d.template, recipient_type: d.recipient_type, title: name(d.title) })),
    needsContact: publisherPlan.needsContact,
    requests,
    suggestions: suggestions ?? [],
    conversion: {
      signals: requests.length + (suggestions?.length ?? 0),
      publishersContacted,
      claims,
      nowSelling,
      stockistsAdded,
      requestersNotified,
    },
  })
}
