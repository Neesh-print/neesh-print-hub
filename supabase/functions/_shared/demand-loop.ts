// Server side of demand-signal Automations 3 (close the loop with
// requesters) and 4 (space requests become Nustand leads). Used by the
// process-demand-loop function (hourly cron, plus a trigger on every new
// space request) and by demand-review (template D on approval, "Run now").
//
// Every requester email is written to outreach_log as a draft. Nothing is
// sent until an admin approves it in /admin/demand, and sendOutreach (in
// demand.ts) applies the resolution when it goes out.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  businessDomain,
  domainStem,
  hostOf,
  inferSegment,
  REQUESTER_CAP,
  sameShop,
  requesterDraft,
  STALE_DAYS,
  storeNearPostcode,
  type DraftEmail,
  type RequesterTemplate,
} from './demand-logic.ts'

type Db = SupabaseClient
const DAY = 86_400_000
const OPEN = ['open', 'publisher_contacted']

export interface LoopResult {
  label: string
  action: 'draft' | 'skip' | 'routed' | 'closed'
  detail?: string
}

// ---------------------------------------------------------------------------
// Drafting with the requester guardrails
// ---------------------------------------------------------------------------

interface RequesterDraftInput {
  email: string
  recipientType: 'reader' | 'space'
  template: RequesterTemplate
  titleId: string | null
  copy: DraftEmail
  signalIds?: number[]
  suggestionIds?: string[]
  stockNotificationIds?: string[]
  meta?: Record<string, unknown>
}

/** Write one requester draft, or say why not: unsubscribed, at the 2-email cap, or already emailed for this signal. */
async function draftForRequester(db: Db, d: RequesterDraftInput): Promise<string | null> {
  const email = d.email.trim().toLowerCase()
  const { data: suppressed } = await db.from('outreach_suppressions').select('email').eq('email', email).maybeSingle()
  if (suppressed) return 'unsubscribed'

  const { count } = await db
    .from('outreach_log')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_email', email)
    .in('status', ['draft', 'approved', 'sent'])
  if ((count ?? 0) >= REQUESTER_CAP) return 'recipient cap reached'

  for (const [col, ids] of [
    ['demand_signal_ids', d.signalIds],
    ['suggestion_ids', d.suggestionIds],
    ['stock_notification_ids', d.stockNotificationIds],
  ] as const) {
    if (!ids?.length) continue
    const { count: dup } = await db
      .from('outreach_log')
      .select('id', { count: 'exact', head: true })
      .overlaps(col, ids)
      .in('status', ['draft', 'approved', 'sent'])
    if ((dup ?? 0) > 0) return 'already emailed for this request'
  }

  const { error } = await db.from('outreach_log').insert({
    recipient_email: email,
    recipient_type: d.recipientType,
    template: d.template,
    title_id: d.titleId,
    demand_signal_ids: d.signalIds ?? [],
    suggestion_ids: d.suggestionIds ?? [],
    stock_notification_ids: d.stockNotificationIds ?? [],
    subject: d.copy.subject,
    body: d.copy.body,
    status: 'draft',
    meta: d.meta ?? {},
  })
  if (error) return error.code === '23505' ? 'already drafted or sent' : error.message
  return null
}

// ---------------------------------------------------------------------------
// Template D: suggestion approved
// ---------------------------------------------------------------------------

export async function draftSuggestionThanks(db: Db, suggestionId: string): Promise<string | null> {
  const { data: s } = await db
    .from('directory_stockist_suggestions')
    .select('id, email, shop_name, city, status, requester_notified_at, title:directory_titles(id, name, slug)')
    .eq('id', suggestionId)
    .single()
  if (!s || s.status !== 'approved') return 'not approved'
  if (!s.email || s.requester_notified_at) return 'no email to thank'
  const title = s.title as unknown as { id: string; name: string; slug: string }
  return draftForRequester(db, {
    email: s.email,
    recipientType: 'reader',
    template: 'D',
    titleId: title.id,
    suggestionIds: [s.id],
    copy: requesterDraft('D', { title: title.name, titleSlug: title.slug, shop: s.shop_name, city: s.city }),
  })
}

// ---------------------------------------------------------------------------
// Template E: a new stockist near a reader
// ---------------------------------------------------------------------------

interface SignalRow {
  id: number
  title_id: string
  requester_email: string | null
  requester_role: string | null
  postcode: string | null
  created_at: string
  status: string
}

async function draftNearbyStockists(db: Db, out: LoopResult[]) {
  const { data: signals } = await db
    .from('directory_demand_signals')
    .select('id, title_id, requester_email, requester_role, postcode, created_at, status')
    .in('status', OPEN)
    .eq('requester_role', 'reader')
    .not('requester_email', 'is', null)
    .not('postcode', 'is', null)
    .is('requester_notified_at', null)
  for (const s of (signals ?? []) as SignalRow[]) {
    const { data: t } = await db.from('directory_titles').select('id, name, publisher_id').eq('id', s.title_id).single()
    if (!t) continue
    const { data: stockists } = await db
      .from('directory_stockists')
      .select('id, title_id, created_at, store:directory_stores(name, slug, city, borough, country, address)')
      .eq('publisher_id', t.publisher_id)
      .eq('is_current', true)
      .gt('created_at', s.created_at)
      .order('created_at', { ascending: false })
    const near = (stockists ?? []).find((k) => {
      const store = k.store as unknown as { city: string | null; country: string; address: string | null } | null
      return (k.title_id === null || k.title_id === t.id) && !!store && storeNearPostcode(s.postcode, store)
    })
    if (!near) continue
    const store = near.store as unknown as { name: string; slug: string; city: string | null; borough: string | null }
    const why = await draftForRequester(db, {
      email: s.requester_email!,
      recipientType: 'reader',
      template: 'E',
      titleId: t.id,
      signalIds: [s.id],
      meta: { resolution: 'stockist_added', stockist_id: near.id },
      copy: requesterDraft('E', { title: t.name, shop: store.name, area: store.borough || store.city, storeSlug: store.slug }),
    })
    out.push({ label: `E · ${t.name}`, action: why ? 'skip' : 'draft', detail: why ?? store.name })
  }
}

// ---------------------------------------------------------------------------
// Template F: a requested title is now orderable
// ---------------------------------------------------------------------------

async function draftNowOrderable(db: Db, out: LoopResult[]) {
  const { data: signals } = await db
    .from('directory_demand_signals')
    .select('id, title_id, requester_email, requester_role, postcode, created_at, status')
    .in('status', OPEN)
    .eq('requester_role', 'space')
    .not('requester_email', 'is', null)
    .is('requester_notified_at', null)
  for (const s of (signals ?? []) as SignalRow[]) {
    const { data: t } = await db
      .from('directory_titles')
      .select('id, name, available_on_neesh, neesh_magazine_id')
      .eq('id', s.title_id)
      .single()
    if (!t?.available_on_neesh || !t.neesh_magazine_id) continue
    const { data: m } = await db
      .from('magazines')
      .select('id, inventory_count, is_active, is_demo')
      .eq('id', t.neesh_magazine_id)
      .single()
    if (!m || m.is_active === false || m.is_demo || (m.inventory_count ?? 0) <= 0) continue
    const why = await draftForRequester(db, {
      email: s.requester_email!,
      recipientType: 'space',
      template: 'F',
      titleId: t.id,
      signalIds: [s.id],
      meta: { resolution: 'now_selling', magazine_id: m.id },
      copy: requesterDraft('F', { title: t.name, magazineId: m.id }),
    })
    out.push({ label: `F · ${t.name}`, action: why ? 'skip' : 'draft', detail: why ?? undefined })
  }
}

// ---------------------------------------------------------------------------
// Template G: back in stock for spaces that asked to be told
// ---------------------------------------------------------------------------

async function draftBackInStock(db: Db, out: LoopResult[]) {
  const { data: rows } = await db
    .from('stock_notifications')
    .select('id, retailer_id, magazine_id, magazine:magazines(id, title, inventory_count, is_active, is_demo)')
    .is('notified_at', null)
  for (const n of rows ?? []) {
    const m = n.magazine as unknown as { id: string; title: string; inventory_count: number | null; is_active: boolean | null; is_demo: boolean } | null
    if (!m || m.is_active === false || m.is_demo || (m.inventory_count ?? 0) <= 0) continue
    const { data: r } = await db
      .from('retailers')
      .select('id, user_id, contact_email, is_internal, is_test')
      .eq('id', n.retailer_id)
      .single()
    if (!r || r.is_internal || r.is_test) continue
    let email = r.contact_email as string | null
    if (!email) {
      const { data: u } = await db.from('users').select('email').eq('id', r.user_id).single()
      email = u?.email ?? null
    }
    if (!email) continue
    const { data: t } = await db.from('directory_titles').select('id').eq('neesh_magazine_id', m.id).maybeSingle()
    const why = await draftForRequester(db, {
      email,
      recipientType: 'space',
      template: 'G',
      titleId: t?.id ?? null,
      stockNotificationIds: [n.id],
      meta: { magazine_id: m.id },
      copy: requesterDraft('G', { title: m.title, magazineId: m.id, qty: m.inventory_count ?? 0 }),
    })
    out.push({ label: `G · ${m.title}`, action: why ? 'skip' : 'draft', detail: why ?? undefined })
  }
}

// ---------------------------------------------------------------------------
// Requests with no match in 120 days close silently
// ---------------------------------------------------------------------------

async function closeStale(db: Db, out: LoopResult[]) {
  const { data } = await db
    .from('directory_demand_signals')
    .update({ status: 'closed_no_action', resolved_at: new Date().toISOString() })
    .in('status', OPEN)
    .lt('created_at', new Date(Date.now() - STALE_DAYS * DAY).toISOString())
    .select('id')
  if (data?.length) out.push({ label: `${data.length} request${data.length === 1 ? '' : 's'} older than ${STALE_DAYS} days`, action: 'closed' })
}

// ---------------------------------------------------------------------------
// Automation 4: route space requests
// ---------------------------------------------------------------------------

interface PlaceHit {
  id: string
  name: string
  address: string | null
  website: string | null
  maps_url: string
  types: string[]
  city: string | null
}

// One Places call per domain per run: three requests from one space cost one lookup.
const placeCache = new Map<string, Promise<PlaceHit | null>>()

/**
 * The space behind an email domain, from Places. Only kept when the place's
 * website is that domain or its name matches the domain, so a vague query
 * never turns into someone else's business.
 */
function placeForDomain(db: Db, domain: string, postcode: string | null): Promise<PlaceHit | null> {
  const key = `${domain}|${postcode ?? ''}`
  if (!placeCache.has(key)) {
    placeCache.set(
      key,
      placeForSpace(db, `${domainStem(domain)} ${postcode ?? ''}`.trim()).then((p) =>
        p && (hostOf(p.website) === domain || sameShop(p.name, domainStem(domain))) ? p : null,
      ),
    )
  }
  return placeCache.get(key)!
}

async function placeForSpace(db: Db, query: string): Promise<PlaceHit | null> {
  const key = Deno.env.get('GOOGLE_PLACES_API_KEY')
  if (!key) return null
  const { data: allowed } = await db.rpc('nustand_worker_place_budget')
  if (allowed !== true) return null
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.addressComponents,places.websiteUri,places.googleMapsUri,places.types,places.businessStatus',
      },
      body: JSON.stringify({ textQuery: query, pageSize: 1 }),
    })
    if (!res.ok) return null
    const p = (await res.json())?.places?.[0]
    if (!p || (p.businessStatus && p.businessStatus !== 'OPERATIONAL')) return null
    const comps = (p.addressComponents ?? []) as { types?: string[]; longText?: string }[]
    return {
      id: String(p.id),
      name: String(p.displayName?.text ?? query),
      address: p.formattedAddress ?? null,
      website: typeof p.websiteUri === 'string' ? p.websiteUri : null,
      maps_url: p.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${p.id}`,
      types: Array.isArray(p.types) ? p.types : [],
      city: comps.find((c) => c.types?.includes('locality'))?.longText ?? null,
    }
  } catch {
    return null
  }
}

const shortHash = async (s: string): Promise<string> => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function matchRetailer(db: Db, email: string): Promise<{ id: string; how: string; name: string | null } | null> {
  const { data: byContact } = await db
    .from('retailers')
    .select('id, shop_name')
    .ilike('contact_email', email)
    .eq('is_test', false)
    .limit(1)
  if (byContact?.[0]) return { id: byContact[0].id, how: 'email', name: byContact[0].shop_name }
  const { data: user } = await db.from('users').select('id').ilike('email', email).eq('role', 'retailer').maybeSingle()
  if (user) {
    const { data: r } = await db.from('retailers').select('id, shop_name').eq('user_id', user.id).maybeSingle()
    if (r) return { id: r.id, how: 'account email', name: r.shop_name }
  }
  const domain = businessDomain(email)
  if (!domain) return null
  const { data: candidates } = await db
    .from('retailers')
    .select('id, shop_name, contact_email, shop_url')
    .eq('is_test', false)
    .or(`contact_email.ilike.%@${domain},shop_url.ilike.%${domain}%`)
    .limit(10)
  const hit = (candidates ?? []).find(
    (r) => r.contact_email?.toLowerCase().endsWith(`@${domain}`) || hostOf(r.shop_url) === domain,
  )
  return hit ? { id: hit.id, how: 'email domain', name: hit.shop_name } : null
}

async function alertGem(subject: string, lines: string[]) {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Neesh <hi@neesh.art>', to: ['gem@neesh.art'], subject, text: lines.join('\n') }),
  }).catch((err) => console.error('space request alert failed', err))
}

async function routeOne(db: Db, s: SignalRow & { title_name: string; title_slug: string }, alert: boolean): Promise<LoopResult> {
  const email = s.requester_email?.trim().toLowerCase() ?? null
  const now = new Date().toISOString()
  const retailer = email ? await matchRetailer(db, email) : null
  let route: Record<string, unknown>

  if (retailer) {
    route = { match: 'neesh_space', retailer_id: retailer.id, how: retailer.how }
    await db.from('directory_demand_signals').update({ retailer_id: retailer.id, routed_at: now, route }).eq('id', s.id)
  } else {
    const domain = businessDomain(email)
    const place = domain ? await placeForDomain(db, domain, s.postcode) : null
    const prospectId = place ? `gp:${place.id}` : domain ? `demand:${domain}` : `demand:${await shortHash(email ?? String(s.id))}`
    const segment = inferSegment(place?.types)
    const lead = {
      id: prospectId,
      name: place?.name ?? domain ?? `Space request${s.postcode ? ` (${s.postcode})` : ''}`,
      city: place?.city ?? null,
      address: place?.address ?? null,
      website: place?.website ?? (domain ? `https://${domain}` : null),
      do_not_contact: false,
      hot: true,
      demand: {
        wants_titles: [s.title_name],
        signal_ids: [s.id],
        postcode: s.postcode,
        last_requested_at: s.created_at,
      },
      contacts: email
        ? [{
            id: 'demand-request-email',
            kind: 'email',
            value: email,
            quality_status: 'verified',
            is_primary: true,
            relevance: 0,
            review_reasons: [],
            evidence: [{
              source_url: `https://neesh.art/titles/${s.title_slug}`,
              extract_method: 'neesh_stock_request',
              excerpt_or_signal: `Asked to stock ${s.title_name}`,
              observed_at: s.created_at,
            }],
          }]
        : [],
      original_record: { source: 'Neesh stock request', postcode: s.postcode, email_domain: domain },
      discovery: place
        ? { provider: 'google', source_url: place.maps_url, source_label: 'Google Places (stock request)' }
        : { provider: 'neesh', source_label: 'Stock request' },
      job: { status: 'not_started' },
      fit: {
        score: null,
        segment,
        uncertainties: [place ? 'Matched from the email domain and postcode; confirm it is the right space.' : 'No place found; only the email is known.'],
      },
    }
    const { error } = await db.rpc('demand_upsert_nustand_lead', { p_source: lead })
    if (error) throw new Error(`Nustand lead failed: ${error.message}`)
    route = { match: 'nustand', prospect_id: prospectId, place: place?.name ?? null, segment }
    await db.from('directory_demand_signals').update({ routed_at: now, route }).eq('id', s.id)
  }

  if (alert) {
    await alertGem(`Space request: ${s.title_name}`, [
      `A space asked to stock ${s.title_name}.`,
      '',
      `From: ${email ?? 'no email'}${s.postcode ? `, ${s.postcode}` : ''}`,
      retailer
        ? `Match: already a Neesh space (${retailer.name ?? 'unnamed'}, by ${retailer.how}).`
        : `Match: not on Neesh. Added to Nustand as a hot lead (${String(route.place ?? 'no place found')}).`,
      retailer ? `https://app.neesh.art/admin/retailers/${retailer.id}` : 'https://app.neesh.art/admin/nustand',
      '',
      `Title: https://neesh.art/titles/${s.title_slug}`,
    ])
  }
  return { label: `Route · ${s.title_name}`, action: 'routed', detail: String(route.match) }
}

async function routeSpaceRequests(db: Db, out: LoopResult[], signalId?: number) {
  let q = db
    .from('directory_demand_signals')
    .select('id, title_id, requester_email, requester_role, postcode, created_at, status, title:directory_titles(name, slug)')
    .eq('requester_role', 'space')
    .not('status', 'is', null)
    .is('routed_at', null)
    .order('created_at')
    .limit(20)
  if (signalId) q = q.eq('id', signalId)
  const { data } = await q
  for (const row of data ?? []) {
    const title = row.title as unknown as { name: string; slug: string }
    // Only alert for fresh requests, so backfilling old ones stays quiet.
    const fresh = Date.now() - new Date(row.created_at).getTime() < DAY
    try {
      out.push(await routeOne(db, { ...(row as SignalRow), title_name: title.name, title_slug: title.slug }, fresh))
    } catch (err) {
      out.push({ label: `Route · ${title.name}`, action: 'skip', detail: err instanceof Error ? err.message : String(err) })
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function processDemandLoop(db: Db, opts: { only?: 'route'; signalId?: number } = {}): Promise<LoopResult[]> {
  const out: LoopResult[] = []
  await routeSpaceRequests(db, out, opts.signalId)
  if (opts.only === 'route') {
    // A space that is already on Neesh may be able to order right away (Automation 4, step 3).
    await draftNowOrderable(db, out)
    return out
  }
  await draftNearbyStockists(db, out)
  await draftNowOrderable(db, out)
  await draftBackInStock(db, out)
  await closeStale(db, out)
  return out
}
