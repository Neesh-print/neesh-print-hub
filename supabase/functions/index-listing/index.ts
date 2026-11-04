// A publisher's Neesh Index listing, read and edited from the portal
// (/publisher/index-listing). The caller is the signed-in portal user; they
// may edit only the Index publishers directory_owned_publisher_ids() says
// they own: claimed listings linked to their Neesh magazines, or claimed
// under their account email. Nobody else sees or changes anything.
//
// Actions (POST JSON):
//   { action: 'get' }
//   { action: 'save_publisher', publisher_id, fields }
//   { action: 'save_title', title_id, fields, niches: { primary, others, identity },
//     cover?: { data: base64 } }
//
// Saves go live at once. Each one is recorded in directory_listing_edits,
// the admin gets a note of what changed, and the Index is asked to refresh
// its cached pages with the caller's own token.
import { adminClient, corsHeaders, getCaller, json } from '../_shared/http.ts'
import {
  diff,
  imageType,
  MAX_COVER_BYTES,
  parseNiches,
  parsePublisher,
  parseTitle,
} from '../_shared/index-listing.ts'

const INDEX_SITE = (Deno.env.get('INDEX_SITE_URL') ?? 'https://neesh.art').replace(/\/$/, '')
const ADMIN_EMAIL = Deno.env.get('INDEX_EDITS_NOTIFY_EMAIL') ?? 'gem@neesh.art'

const PUBLISHER_FIELDS = 'id, name, slug, website, city, country, stockist_page_url'
const TITLE_FIELDS =
  'id, publisher_id, name, slug, description, cover_image_path, frequency, cover_price, currency, trim_size, page_count, country, city, status, last_issue_date, subscribe_url, directory_title_tags(tag_id, is_primary)'

type Admin = ReturnType<typeof adminClient>

function coverUrl(path: string | null): string | null {
  if (!path || path.startsWith('reader-uploads/')) return null
  if (/^https?:\/\//.test(path)) return path
  return `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/covers/${path.replace(/^covers\//, '')}`
}

async function ownedIds(admin: Admin, userId: string): Promise<string[]> {
  const { data, error } = await admin.rpc('directory_owned_publisher_ids', { p_user: userId })
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown[]).map((row) =>
    typeof row === 'string' ? row : (row as Record<string, string>).directory_owned_publisher_ids
  )
}

async function notifyAdmin(subject: string, lines: string[]) {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Neesh <hi@neesh.art>',
        to: [ADMIN_EMAIL],
        subject: subject.replace(/[\r\n]+/g, ' ').slice(0, 150),
        text: lines.join('\n'),
      }),
    })
  } catch (err) {
    console.warn('index-listing notify failed', err)
  }
}

async function refreshIndex(authHeader: string) {
  try {
    const res = await fetch(`${INDEX_SITE}/api/revalidate-listing`, {
      method: 'POST',
      headers: { Authorization: authHeader },
    })
    if (!res.ok) console.warn('index-listing revalidate returned', res.status)
  } catch (err) {
    console.warn('index-listing revalidate failed', err)
  }
}

function changeLines(changes: Record<string, { from: unknown; to: unknown }>): string[] {
  return Object.entries(changes).map(([k, v]) => `${k}: ${JSON.stringify(v.from)} -> ${JSON.stringify(v.to)}`)
}

function decodeBase64(data: string): Uint8Array {
  const clean = data.replace(/^data:[^,]*,/, '')
  const bin = atob(clean)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors)

  const admin = adminClient()
  const caller = await getCaller(req, admin)
  if (!caller) return json({ error: 'Sign in again to edit your listing.' }, 401, cors)
  const authHeader = req.headers.get('Authorization') ?? ''

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Bad request' }, 400, cors)
  }

  try {
    const owned = await ownedIds(admin, caller.userId)

    if (body.action === 'get') {
      if (owned.length === 0) return json({ publishers: [], titles: [], tags: [] }, 200, cors)
      const [pubs, titles, tags] = await Promise.all([
        admin.from('directory_publishers').select(PUBLISHER_FIELDS).in('id', owned).order('name'),
        admin.from('directory_titles').select(TITLE_FIELDS).in('publisher_id', owned).eq('removed', false).order('name'),
        admin.from('directory_tags').select('id, name, category').order('name'),
      ])
      if (pubs.error || titles.error || tags.error) throw new Error('read failed')
      return json({
        publishers: pubs.data,
        titles: (titles.data ?? []).map((t) => ({ ...t, cover_url: coverUrl(t.cover_image_path as string | null) })),
        tags: tags.data,
        index_site: INDEX_SITE,
      }, 200, cors)
    }

    if (body.action === 'save_publisher') {
      const id = String(body.publisher_id ?? '')
      if (!owned.includes(id)) return json({ error: 'That listing is not one of yours.' }, 403, cors)
      const parsed = parsePublisher((body.fields ?? {}) as Record<string, unknown>)
      if (!parsed.ok) return json({ error: parsed.error }, 400, cors)

      const { data: before } = await admin.from('directory_publishers').select(PUBLISHER_FIELDS).eq('id', id).maybeSingle()
      if (!before) return json({ error: 'That listing is gone.' }, 404, cors)
      const changes = diff(before, parsed.value as unknown as Record<string, unknown>)
      if (Object.keys(changes).length === 0) return json({ ok: true, changed: false }, 200, cors)

      const { error } = await admin.from('directory_publishers').update(parsed.value).eq('id', id)
      if (error) throw new Error(error.message)
      await admin.from('directory_listing_edits').insert({
        publisher_id: id, title_id: null, editor_user: caller.userId, editor_email: caller.email, changes,
      })
      await refreshIndex(authHeader)
      await notifyAdmin(`Index listing edit: ${parsed.value.name}`, [
        `${caller.email ?? caller.userId} edited the publisher details in the portal.`, '',
        ...changeLines(changes), '', `${INDEX_SITE}/publishers/${before.slug}`,
      ])
      return json({ ok: true, changed: true }, 200, cors)
    }

    if (body.action === 'save_title') {
      const id = String(body.title_id ?? '')
      const { data: before } = await admin
        .from('directory_titles').select(TITLE_FIELDS).eq('id', id).eq('removed', false).maybeSingle()
      if (!before || !owned.includes(before.publisher_id as string)) {
        return json({ error: 'That title is not one of yours.' }, 403, cors)
      }
      const parsed = parseTitle((body.fields ?? {}) as Record<string, unknown>)
      if (!parsed.ok) return json({ error: parsed.error }, 400, cors)

      const { data: vocab, error: vocabError } = await admin.from('directory_tags').select('id, name, category')
      if (vocabError) throw new Error(vocabError.message)
      const niches = parseNiches((body.niches ?? {}) as Record<string, unknown>, vocab ?? [])
      if (!niches.ok) return json({ error: niches.error }, 400, cors)
      const keep = [niches.value.primary, ...niches.value.others, ...niches.value.identity]

      // Optional new cover, under a fresh name so no cache serves the old one.
      let coverPath: string | null = null
      const cover = body.cover as { data?: unknown } | undefined
      if (cover && typeof cover.data === 'string' && cover.data.length > 0) {
        let bytes: Uint8Array
        try {
          bytes = decodeBase64(cover.data)
        } catch {
          return json({ error: 'That cover could not be read.' }, 400, cors)
        }
        if (bytes.length > MAX_COVER_BYTES) return json({ error: 'Covers can be up to 4 MB.' }, 400, cors)
        const type = imageType(bytes)
        if (!type) return json({ error: 'Covers need to be a JPEG, PNG or WebP image.' }, 400, cors)
        coverPath = `${before.slug}-${Date.now().toString(36)}.${type.ext}`
        const { error: upErr } = await admin.storage
          .from('covers')
          .upload(coverPath, bytes, { contentType: type.mime, upsert: false, cacheControl: '31536000' })
        if (upErr) throw new Error(`cover upload: ${upErr.message}`)
      }

      const name = (tagId: string) => vocab?.find((t) => t.id === tagId)?.name ?? tagId
      const links = (before.directory_title_tags ?? []) as { tag_id: string; is_primary: boolean }[]
      const beforePrimary = links.find((l) => l.is_primary)?.tag_id ?? null
      const changes = {
        ...diff(before, parsed.value as unknown as Record<string, unknown>),
        ...diff(
          { main_niche: beforePrimary ? name(beforePrimary) : null, niches: links.map((l) => name(l.tag_id)).sort() },
          { main_niche: name(niches.value.primary), niches: keep.map(name).sort() },
        ),
        ...(coverPath ? { cover_image_path: { from: before.cover_image_path, to: coverPath } } : {}),
      }
      if (Object.keys(changes).length === 0) return json({ ok: true, changed: false }, 200, cors)

      const update: Record<string, unknown> = { ...parsed.value, verified_at: new Date().toISOString() }
      if (coverPath) update.cover_image_path = coverPath
      const { error } = await admin.from('directory_titles').update(update).eq('id', id)
      if (error) throw new Error(error.message)

      // Clear the old primary (a unique index allows one per title), upsert
      // the chosen set, then drop the rest, so the title is never left with
      // no niche part way through.
      const steps = [
        () => admin.from('directory_title_tags').update({ is_primary: false }).eq('title_id', id).eq('is_primary', true),
        () => admin.from('directory_title_tags').upsert(
          keep.map((tag_id) => ({ title_id: id, tag_id, is_primary: tag_id === niches.value.primary })),
          { onConflict: 'title_id,tag_id' },
        ),
        () => admin.from('directory_title_tags').delete().eq('title_id', id).not('tag_id', 'in', `(${keep.join(',')})`),
      ]
      for (const step of steps) {
        const { error: tagErr } = await step()
        if (tagErr) {
          await refreshIndex(authHeader)
          return json({ error: 'Your details saved, but the niches did not. Try saving again.' }, 500, cors)
        }
      }

      await admin.from('directory_listing_edits').insert({
        publisher_id: before.publisher_id, title_id: id, editor_user: caller.userId, editor_email: caller.email, changes,
      })
      await refreshIndex(authHeader)
      await notifyAdmin(`Index listing edit: ${parsed.value.name}`, [
        `${caller.email ?? caller.userId} edited ${parsed.value.name} in the portal.`, '',
        ...changeLines(changes), '', `${INDEX_SITE}/titles/${before.slug}`,
      ])
      return json({ ok: true, changed: true, cover_url: coverPath ? coverUrl(coverPath) : undefined }, 200, cors)
    }

    return json({ error: 'Unknown action' }, 400, cors)
  } catch (err) {
    console.error('index-listing failed', err)
    return json({ error: 'That did not save. Try again in a minute.' }, 500, cors)
  }
})
