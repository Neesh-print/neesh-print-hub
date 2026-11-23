// Server side of demand-signal Automations 1 and 2. Used by the
// verify-stockist-suggestions and draft-publisher-outreach cron functions and
// by demand-review (the admin queue), so "Check now" in the app runs the same
// code as the cron.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  confidenceFor,
  decideDraft,
  findTitle,
  matchKey,
  pageText,
  publisherDraft,
  rolesFor,
  sameCity,
  sameShop,
  spamReason,
  SPAM_IP_LIMIT,
  type TitleDemand,
  unsubscribeLine,
} from './demand-logic.ts'

type Db = SupabaseClient

const DAY = 86_400_000

// ---------------------------------------------------------------------------
// Automation 1: verify suggestions
// ---------------------------------------------------------------------------

interface Suggestion {
  id: string
  title_id: string
  shop_name: string
  city: string
  email: string | null
  status: string
  created_at: string
  ip_hash: string | null
}

interface Store {
  id: string
  name: string
  city: string | null
  country: string
  website: string | null
  slug: string
  match_key: string
}

interface Place {
  place_id: string
  name: string
  address: string | null
  city: string | null
  country: string | null
  website: string | null
  maps_url: string
}

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; NeeshIndexBot/1.0; +https://neesh.art)',
  Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
}

async function fetchText(url: string, ms = 8000): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow', signal: AbortSignal.timeout(ms) })
    if (!res.ok) return null
    const body = await res.text()
    return body.slice(0, 1_500_000)
  } catch {
    return null
  }
}

async function findStore(db: Db, shop: string, city: string): Promise<Store | null> {
  const key = matchKey(shop)
  if (!key) return null
  const { data } = await db
    .from('directory_stores')
    .select('id, name, city, country, website, slug, match_key')
    .ilike('city', city.trim().replace(/[%_\\]/g, (c) => `\\${c}`))
    .limit(2000)
  const stores = (data ?? []) as Store[]
  return stores.find((s) => s.match_key === key) ?? stores.find((s) => sameShop(s.name, shop)) ?? null
}

async function searchPlace(db: Db, shop: string, city: string): Promise<{ place: Place | null; note?: string }> {
  const key = Deno.env.get('GOOGLE_PLACES_API_KEY')
  if (!key) return { place: null, note: 'no Places key' }
  const { data: allowed } = await db.rpc('nustand_worker_place_budget')
  if (allowed !== true) return { place: null, note: 'Places daily budget used up' }
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.addressComponents,places.websiteUri,places.googleMapsUri,places.businessStatus',
      },
      body: JSON.stringify({ textQuery: `${shop}, ${city}`, pageSize: 3 }),
    })
    if (!res.ok) return { place: null, note: `Places error ${res.status}` }
    const json = await res.json()
    const hit = (Array.isArray(json.places) ? json.places : []).find(
      (p: Record<string, unknown>) =>
        (!p.businessStatus || p.businessStatus === 'OPERATIONAL') &&
        sameShop(String((p.displayName as { text?: string })?.text ?? ''), shop),
    )
    if (!hit) return { place: null, note: 'no matching place' }
    const comps = (hit.addressComponents ?? []) as { types?: string[]; shortText?: string; longText?: string }[]
    const comp = (type: string) => comps.find((c) => c.types?.includes(type))
    return {
      place: {
        place_id: String(hit.id),
        name: String(hit.displayName?.text ?? shop),
        address: hit.formattedAddress ?? null,
        city: comp('locality')?.longText ?? comp('postal_town')?.longText ?? null,
        country: comp('country')?.shortText ?? null,
        website: typeof hit.websiteUri === 'string' ? hit.websiteUri : null,
        maps_url: hit.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${hit.id}`,
      },
    }
  } catch (err) {
    return { place: null, note: `Places failed: ${err instanceof Error ? err.message : err}` }
  }
}

/** Drop Shopify's search-tracking params (_pos, _psq, _psid, _ss) so the listing links to the plain product page. */
const cleanUrl = (u: URL): string => {
  for (const key of [...u.searchParams.keys()]) if (key.startsWith('_')) u.searchParams.delete(key)
  return u.toString()
}

/** Look for the title on the shop's own site: the home page, then a Shopify product search. */
async function findTitleOnSite(website: string, title: string): Promise<{ url: string; snippet: string } | null> {
  let origin: string
  try {
    origin = new URL(website).origin
  } catch {
    return null
  }
  const home = await fetchText(website)
  if (home) {
    const snippet = findTitle(pageText(home), title)
    if (snippet) return { url: website, snippet }
  }
  // Shopify's suggest endpoint returns only matching products, so a hit here
  // is a product, not the search box echoing the query back.
  const suggestUrl = `${origin}/search/suggest.json?q=${encodeURIComponent(title)}&resources[type]=product&resources[limit]=5`
  const suggest = await fetchText(suggestUrl, 6000)
  if (suggest) {
    try {
      const products = JSON.parse(suggest)?.resources?.results?.products ?? []
      for (const p of products as { title?: string; url?: string }[]) {
        const snippet = p.title ? findTitle(p.title, title) : null
        if (snippet) return { url: p.url ? cleanUrl(new URL(p.url, origin)) : suggestUrl, snippet }
      }
    } catch {
      // not Shopify
    }
  }
  return null
}

export interface VerifyResult {
  id: string
  status: string
  confidence?: string
  note?: string
}

async function verifyOne(db: Db, s: Suggestion, title: { id: string; name: string; publisher_id: string }): Promise<VerifyResult> {
  const evidence: Record<string, unknown> = { checked_at: new Date().toISOString() }
  const finish = async (patch: Record<string, unknown>) => {
    const { error } = await db
      .from('directory_stockist_suggestions')
      .update({ ...patch, evidence })
      .eq('id', s.id)
    if (error) throw new Error(error.message)
    return { id: s.id, status: String(patch.status), confidence: patch.confidence as string | undefined }
  }

  // 1. Spam
  const junk = spamReason(s.shop_name, s.city)
  if (junk) {
    evidence.spam = junk
    return finish({ status: 'rejected', reject_reason: 'spam', confidence: 'unverified', reviewed_at: new Date().toISOString() })
  }
  if (s.ip_hash) {
    const { count } = await db
      .from('directory_stockist_suggestions')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', s.ip_hash)
      .gte('created_at', new Date(new Date(s.created_at).getTime() - DAY).toISOString())
    if ((count ?? 0) > SPAM_IP_LIMIT) {
      evidence.spam = `more than ${SPAM_IP_LIMIT} suggestions from one address in 24 hours`
      return finish({ status: 'rejected', reject_reason: 'spam', confidence: 'unverified', reviewed_at: new Date().toISOString() })
    }
  }

  // 2. Duplicate of an earlier suggestion
  const { data: earlier } = await db
    .from('directory_stockist_suggestions')
    .select('id, shop_name, city, status, created_at')
    .eq('title_id', s.title_id)
    .neq('id', s.id)
    .not('status', 'in', '(rejected,duplicate)')
    .gte('created_at', new Date(new Date(s.created_at).getTime() - 90 * DAY).toISOString())
    .lt('created_at', s.created_at)
  const twin = (earlier ?? []).find((e) => sameCity(e.city, s.city) && sameShop(e.shop_name, s.shop_name))
  if (twin) {
    evidence.duplicate_of = twin.id
    return finish({ status: 'duplicate' })
  }

  // 3. Match the shop: the Index first, then Google Places
  const store = await findStore(db, s.shop_name, s.city)
  let website: string | null = store?.website ?? null
  if (store) {
    evidence.store = { id: store.id, name: store.name, city: store.city, country: store.country, slug: store.slug }
    const { data: listed } = await db
      .from('directory_stockists')
      .select('id, title_id')
      .eq('store_id', store.id)
      .eq('publisher_id', title.publisher_id)
      .eq('is_current', true)
    const current = (listed ?? []).find((k) => k.title_id === null || k.title_id === title.id)
    if (current) {
      evidence.existing_stockist_id = current.id
      return finish({ status: 'duplicate', store_id: store.id, confidence: 'confirmed' })
    }
  }
  if (!store || !website) {
    const { place, note } = await searchPlace(db, s.shop_name, s.city)
    if (place) {
      evidence.place = place
      website = website ?? place.website
    } else if (note) {
      evidence.places_note = note
    }
  }

  // 4. Look for the title on the shop's site
  let hit: { url: string; snippet: string } | null = null
  if (website) {
    hit = await findTitleOnSite(website, title.name)
    evidence.website = website
    if (hit) evidence.title_hit = hit
  }

  const confidence = confidenceFor(!!store || !!evidence.place, !!hit)
  return finish({ status: 'needs_review', confidence, store_id: store?.id ?? null })
}

/** Verify suggestions in status 'new' (or the given ids, whatever their state, short of a decision). */
export async function verifySuggestions(db: Db, opts: { ids?: string[]; limit?: number } = {}): Promise<VerifyResult[]> {
  let q = db
    .from('directory_stockist_suggestions')
    .select('id, title_id, shop_name, city, email, status, created_at, ip_hash')
    .order('created_at')
    .limit(opts.limit ?? 10)
  q = opts.ids?.length ? q.in('id', opts.ids).in('status', ['new', 'verifying', 'needs_review']) : q.eq('status', 'new')
  const { data, error } = await q
  if (error) throw new Error(error.message)
  const results: VerifyResult[] = []
  for (const s of (data ?? []) as Suggestion[]) {
    // Claim the row so an overlapping run skips it.
    const { data: claimed } = await db
      .from('directory_stockist_suggestions')
      .update({ status: 'verifying' })
      .eq('id', s.id)
      .eq('status', s.status)
      .select('id')
    if (!claimed?.length) continue
    try {
      const { data: title } = await db.from('directory_titles').select('id, name, publisher_id').eq('id', s.title_id).single()
      if (!title) throw new Error('title not found')
      results.push(await verifyOne(db, s, title))
    } catch (err) {
      const note = err instanceof Error ? err.message : String(err)
      await db
        .from('directory_stockist_suggestions')
        .update({ status: 'needs_review', confidence: 'unverified', evidence: { error: note, checked_at: new Date().toISOString() } })
        .eq('id', s.id)
      results.push({ id: s.id, status: 'needs_review', confidence: 'unverified', note })
    }
  }
  return results
}

// ---------------------------------------------------------------------------
// Automation 2: publisher drafts
// ---------------------------------------------------------------------------

export interface DraftResult {
  title: string
  action: string
  template?: string
  reason?: string
}

export async function draftPublisherOutreach(db: Db, opts: { dryRun?: boolean } = {}): Promise<{
  drafted: DraftResult[]
  needsContact: string[]
  skipped: DraftResult[]
}> {
  const { data: rows, error } = await db.from('v_title_demand').select('*')
  if (error) throw new Error(error.message)
  const demand = (rows ?? []) as TitleDemand[]

  const publisherIds = [...new Set(demand.map((d) => d.publisher_id).filter(Boolean))] as string[]
  const { data: pubs } = publisherIds.length
    ? await db.from('directory_publishers').select('id, name').in('id', publisherIds)
    : { data: [] }
  const pubName = new Map((pubs ?? []).map((p) => [p.id, p.name as string]))

  const { data: pending } = await db
    .from('outreach_log')
    .select('publisher_id, recipient_email, status')
    .eq('recipient_type', 'publisher')
    .in('status', ['draft', 'approved', 'sent'])
  const pendingPublishers = new Set(
    (pending ?? []).filter((r) => r.status !== 'sent' && r.publisher_id).map((r) => r.publisher_id as string),
  )
  const { data: sentRows } = await db.from('outreach_log').select('recipient_email').eq('status', 'sent')
  const sentTo = new Map<string, number>()
  for (const r of sentRows ?? []) sentTo.set(r.recipient_email, (sentTo.get(r.recipient_email) ?? 0) + 1)

  const drafted: DraftResult[] = []
  const skipped: DraftResult[] = []
  const needsContact: string[] = []
  const now = new Date()

  for (const d of demand) {
    const email = d.publisher_email?.trim().toLowerCase() ?? null
    const decision = decideDraft(d, {
      now,
      publisherHasPending: !!d.publisher_id && pendingPublishers.has(d.publisher_id),
      recipientSent: email ? sentTo.get(email) ?? 0 : 0,
    })
    if (decision.action === 'needs_contact') {
      needsContact.push(d.title_name)
      continue
    }
    if (decision.action === 'skip') {
      skipped.push({ title: d.title_name, action: 'skip', reason: decision.reason })
      continue
    }

    const copy = publisherDraft(decision.template, { ...d, publisher_name: pubName.get(d.publisher_id ?? '') ?? null })
    const { data: signals } = await db
      .from('directory_demand_signals')
      .select('id')
      .eq('title_id', d.title_id)
      .eq('status', 'open')
      .in('requester_role', rolesFor(decision.template))
    const row = {
      recipient_email: email!,
      recipient_type: 'publisher',
      template: decision.template,
      title_id: d.title_id,
      publisher_id: d.publisher_id,
      demand_signal_ids: (signals ?? []).map((s) => s.id),
      subject: copy.subject,
      body: copy.body,
      status: 'draft',
    }
    if (!opts.dryRun) {
      const { error: insErr } = await db.from('outreach_log').insert(row)
      if (insErr) {
        skipped.push({
          title: d.title_name,
          action: 'skip',
          reason: insErr.code === '23505' ? 'already drafted or sent' : insErr.message,
        })
        continue
      }
      if (d.publisher_id) pendingPublishers.add(d.publisher_id)
    }
    drafted.push({ title: d.title_name, action: 'draft', template: decision.template })
  }
  return { drafted, needsContact, skipped }
}

// ---------------------------------------------------------------------------
// Sending (admin approves a draft)
// ---------------------------------------------------------------------------

const FROM_GEM = 'Gem <gem@neesh.art>'
const FROM_NEESH = 'Neesh <hi@neesh.art>'

// Unsubscribe links carry the outreach row id and an HMAC of it, never the
// address. Keyed with the service role key, which only the functions hold.
const hmac = async (value: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`unsubscribe:${value}`))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

export const unsubscribeUrl = async (outreachId: string): Promise<string> =>
  `${(Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '')}/functions/v1/outreach-unsubscribe?id=${outreachId}&t=${await hmac(outreachId)}`

export const verifyUnsubscribe = async (outreachId: string, token: string): Promise<boolean> => {
  const expected = await hmac(outreachId)
  if (token.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i)
  return diff === 0
}

/** Record an unsubscribe and skip anything still waiting for that address. */
export async function suppress(db: Db, email: string, reason: string, outreachId?: string) {
  const address = email.trim().toLowerCase()
  await db
    .from('outreach_suppressions')
    .upsert({ email: address, reason, source_outreach_id: outreachId ?? null }, { onConflict: 'email', ignoreDuplicates: true })
  await db
    .from('outreach_log')
    .update({ status: 'skipped', skip_reason: reason })
    .eq('recipient_email', address)
    .eq('status', 'draft')
}

export async function sendOutreach(db: Db, id: string, approver: string): Promise<{ resendId: string }> {
  const { data: row, error } = await db.from('outreach_log').select('*').eq('id', id).single()
  if (error || !row) throw new Error('draft not found')
  if (row.status !== 'draft') throw new Error(`this email is already ${row.status}`)
  if (!row.subject?.trim() || !row.body?.trim()) throw new Error('subject and body are required')
  if (/—/.test(row.subject + row.body)) throw new Error('remove the em dash before sending')
  const toPublisher = row.recipient_type === 'publisher'

  const { data: suppressed } = await db.from('outreach_suppressions').select('email').eq('email', row.recipient_email).maybeSingle()
  if (suppressed) throw new Error('this address unsubscribed')
  if (toPublisher && row.title_id) {
    const { data: t } = await db.from('directory_titles').select('do_not_contact, distributor_exclusive').eq('id', row.title_id).single()
    if (t?.do_not_contact) throw new Error('this title is flagged do not contact')
    if (t?.distributor_exclusive) throw new Error('this title is flagged distributor exclusive')
  }
  const { count } = await db
    .from('outreach_log')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_email', row.recipient_email)
    .eq('status', 'sent')
  if ((count ?? 0) >= 2) throw new Error('this recipient already has 2 automated emails')

  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) throw new Error('email service not configured')

  // Claim the draft first so a double click cannot send twice.
  const { data: claimed } = await db
    .from('outreach_log')
    .update({ status: 'approved', approved_by: approver, approved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'draft')
    .select('id')
  if (!claimed?.length) throw new Error('this email is already being sent')

  const unsub = await unsubscribeUrl(id)
  // Readers and spaces get the spec's one-line unsubscribe; publisher emails
  // read as a personal note from Gem and carry it in the header only.
  const text = toPublisher ? row.body : `${row.body.trimEnd()}\n\n${unsubscribeLine(unsub)}`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: toPublisher ? FROM_GEM : FROM_NEESH,
      to: [row.recipient_email],
      reply_to: toPublisher ? 'gem@neesh.art' : 'hi@neesh.art',
      subject: row.subject,
      text,
      headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      tags: [{ name: 'campaign', value: 'demand' }, { name: 'template', value: row.template }],
    }),
  })
  const sent = await res.json().catch(() => ({}))
  if (!res.ok || !sent?.id) {
    await db.from('outreach_log').update({ status: 'draft', approved_by: null, approved_at: null }).eq('id', id)
    throw new Error(`Resend refused the email: ${sent?.message ?? res.status}`)
  }

  const now = new Date().toISOString()
  const { error: upErr } = await db
    .from('outreach_log')
    .update({ status: 'sent', sent_at: now, resend_message_id: sent.id, body: text })
    .eq('id', id)
  if (upErr) console.error('sent but could not mark outreach_log', id, upErr.message)

  await applyResolution(db, row, now)
  return { resendId: sent.id }
}

interface SentRow {
  template: string
  demand_signal_ids: number[] | null
  suggestion_ids: string[] | null
  stock_notification_ids: string[] | null
  meta: { resolution?: string; stockist_id?: string; magazine_id?: string } | null
}

/** What a sent email resolves: publisher contacted, request resolved, suggester or space notified. */
async function applyResolution(db: Db, row: SentRow, now: string) {
  const signals = row.demand_signal_ids ?? []
  const meta = row.meta ?? {}
  if (['A', 'B', 'C'].includes(row.template) && signals.length) {
    await db.from('directory_demand_signals').update({ status: 'publisher_contacted' }).in('id', signals).eq('status', 'open')
  }
  if (['E', 'F'].includes(row.template) && signals.length) {
    await db
      .from('directory_demand_signals')
      .update({
        status: 'resolved',
        resolution: meta.resolution ?? (row.template === 'E' ? 'stockist_added' : 'now_selling'),
        resolved_at: now,
        requester_notified_at: now,
        resolved_by_stockist_id: meta.stockist_id ?? null,
        resolved_by_magazine_id: meta.magazine_id ?? null,
      })
      .in('id', signals)
  }
  if (row.template === 'D' && row.suggestion_ids?.length) {
    await db.from('directory_stockist_suggestions').update({ requester_notified_at: now }).in('id', row.suggestion_ids)
  }
  if (row.template === 'G' && row.stock_notification_ids?.length) {
    await db.from('stock_notifications').update({ notified_at: now }).in('id', row.stock_notification_ids)
  }
}

// ---------------------------------------------------------------------------
// Index revalidation after an approval
// ---------------------------------------------------------------------------

export async function revalidateIndex(paths: string[]): Promise<boolean> {
  const token = Deno.env.get('INDEX_REVALIDATE_TOKEN')
  const site = (Deno.env.get('INDEX_SITE_URL') ?? 'https://neesh.art').replace(/\/$/, '')
  if (!token || paths.length === 0) return false
  try {
    const res = await fetch(`${site}/api/revalidate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
      signal: AbortSignal.timeout(10000),
    })
    return res.ok
  } catch {
    return false
  }
}
