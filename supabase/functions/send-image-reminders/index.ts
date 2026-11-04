import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BRAND_URL, button, formatIssue, renderEmail, smallText, titleList } from '../_shared/email.ts'

// Weekly job: email publishers whose active titles are missing a cover image.
// Each title is reminded at most 2 times (image_reminder_count < 2) and stops
// as soon as a cover image is uploaded. Intended to run on a weekly schedule
// (pg_cron -> pg_net). See ./README.md for the schedule setup.
//
// Conventions match send-profile-reminders: verify_jwt = false (see
// supabase/config.toml), guarded by the shared REMINDER_SECRET via the
// `x-reminder-secret` header, runs with the service role, links to BRAND_URL,
// and supports a { dryRun, limit } test mode.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-reminder-secret',
}

const MAX_REMINDERS = 2

interface MagazineRow {
  id: string
  title: string | null
  issue_number: string | null
  publisher_id: string
  image_reminder_count: number
}

interface PublisherGroup {
  publisherId: string
  email: string
  firstName: string | null
  company: string
  isLast: boolean
  titles: { id: string; title: string; issue: string | null }[]
}

const generateReminderEmail = (group: PublisherGroup): string => {
  const n = group.titles.length
  const greeting = group.firstName ? `Hi ${group.firstName},` : 'Hi there,'
  return renderEmail({
    preheader: n === 1
      ? 'Spaces browse by cover. Add one and this title shows up for them.'
      : `Spaces browse by cover. Add them and these ${n} titles show up for them.`,
    label: 'Your titles',
    eyebrow: group.isLast ? 'Last reminder' : 'One step left',
    heading: n === 1 ? 'Add a cover so spaces can see this title.' : 'Add covers so spaces can see these titles.',
    intro: `${greeting} spaces browse the Neesh catalogue by cover, so ${n === 1 ? 'this title from' : 'these titles from'} ${group.company} won't show up for them until ${n === 1 ? 'it has one' : 'they have one'}.`,
    blocks: [
      titleList(group.titles.map((t) => ({
        title: t.title,
        subtitle: formatIssue(t.issue) ?? undefined,
        badge: { text: 'No cover', tone: 'pending' as const },
        href: `${BRAND_URL}/publisher/titles/${t.id}/edit`,
        linkText: 'Add a cover image',
      }))),
      button(n === 1 ? 'Add cover' : 'Add covers', `${BRAND_URL}/publisher/titles`),
      smallText('Rather not log in? Reply with the cover file and we will add it for you.'),
      smallText(group.isLast
        ? 'This is the last reminder we will send about this.'
        : 'We will send one more reminder at most. Reply "stop" and we will not send that either.'),
    ],
    footerNote: 'You are getting this because you publish on Neesh.',
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    // ---- Auth: shared secret (matches send-profile-reminders) ----
    const expectedSecret = Deno.env.get('REMINDER_SECRET')
    if (!expectedSecret) return json({ error: 'REMINDER_SECRET not configured' }, 500)
    if (req.headers.get('x-reminder-secret') !== expectedSecret) return json({ error: 'Unauthorized' }, 401)

    // ---- Options: { dryRun, limit } (empty body is fine; cron sends {}) ----
    let dryRun = false
    let limit: number | null = null
    try {
      const body = await req.json()
      dryRun = body?.dryRun === true
      if (typeof body?.limit === 'number' && body.limit > 0) limit = body.limit
    } catch {
      // no body
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Active, imageless titles that still have reminders remaining.
    const { data: mags, error: magErr } = await supabase
      .from('magazines')
      .select('id, title, issue_number, publisher_id, image_reminder_count')
      .eq('is_active', true)
      .or('cover_image_url.is.null,cover_image_url.eq.')
      .lt('image_reminder_count', MAX_REMINDERS)
    if (magErr) throw magErr

    const magazines = (mags ?? []) as MagazineRow[]
    if (magazines.length === 0) return json({ ok: true, dryRun, publishersEmailed: 0, titles: 0, recipients: [] })

    // 2. Resolve publisher -> email, first name and company name.
    const publisherIds = [...new Set(magazines.map((m) => m.publisher_id))]
    const { data: pubs, error: pubErr } = await supabase
      .from('publishers')
      .select('id, user_id, company_name')
      .in('id', publisherIds)
    if (pubErr) throw pubErr

    const userIds = [...new Set((pubs ?? []).map((p) => p.user_id).filter(Boolean))]
    const { data: users, error: userErr } = await supabase
      .from('users')
      .select('id, email')
      .in('id', userIds)
    if (userErr) throw userErr
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', userIds)

    const emailByUser = new Map((users ?? []).map((u) => [u.id, u.email as string | null]))
    const firstNameByUser = new Map((profiles ?? []).map((pr) => [pr.user_id, ((pr.full_name as string | null) ?? '').trim().split(/\s+/)[0] || null]))
    const pubById = new Map((pubs ?? []).map((p) => [p.id, p]))

    // 3. Group titles by publisher.
    const groupMap = new Map<string, PublisherGroup>()
    for (const mag of magazines) {
      const pub = pubById.get(mag.publisher_id)
      if (!pub) continue
      const email = emailByUser.get(pub.user_id)
      if (!email) continue
      if (email.toLowerCase().endsWith('@neesh.art')) continue // skip internal accounts
      if (!groupMap.has(mag.publisher_id)) {
        groupMap.set(mag.publisher_id, {
          publisherId: mag.publisher_id,
          email,
          firstName: firstNameByUser.get(pub.user_id) ?? null,
          company: pub.company_name || 'you',
          isLast: true,
          titles: [],
        })
      }
      const g = groupMap.get(mag.publisher_id)!
      // 'Last reminder' only when every title in the email is on its final send.
      if ((mag.image_reminder_count ?? 0) + 1 < MAX_REMINDERS) g.isLast = false
      g.titles.push({ id: mag.id, title: mag.title || 'Untitled', issue: mag.issue_number })
    }

    let groups = [...groupMap.values()]
    if (limit) groups = groups.slice(0, limit)

    // Dry run: report who WOULD be emailed. Send nothing, bump nothing.
    if (dryRun) {
      return json({
        dryRun: true,
        publishers: groups.length,
        titles: groups.reduce((n, g) => n + g.titles.length, 0),
        recipients: groups.map((g) => ({ email: g.email, company: g.company, titles: g.titles.map((t) => t.title) })),
      })
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) return json({ error: 'Email service not configured' }, 500)

    // 4. Send one email per publisher; collect titles that actually sent.
    const sentMagazineIds: string[] = []
    let publishersEmailed = 0
    const failures: string[] = []

    for (const group of groups) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Neesh <hi@neesh.art>',
          to: group.email,
          reply_to: 'hi@neesh.art',
          subject:
            group.titles.length === 1
              ? 'Add a cover image to your Neesh title'
              : `Add cover images to ${group.titles.length} of your Neesh titles`,
          html: generateReminderEmail(group),
          headers: { 'List-Unsubscribe': '<mailto:hi@neesh.art?subject=stop%20cover%20reminders>' },
        }),
      })

      if (res.ok) {
        publishersEmailed++
        sentMagazineIds.push(...group.titles.map((t) => t.id))
      } else {
        failures.push(`${group.email}: ${res.status} ${await res.text().catch(() => '')}`)
      }
    }

    // 5. Bump the counter only for titles whose email actually went out.
    if (sentMagazineIds.length > 0) {
      const { error: bumpErr } = await supabase.rpc('bump_image_reminders', { mag_ids: sentMagazineIds })
      if (bumpErr) throw bumpErr
    }

    return json({ ok: true, publishersEmailed, titles: sentMagazineIds.length, failures })
  } catch (error) {
    console.error('send-image-reminders error:', error)
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})
