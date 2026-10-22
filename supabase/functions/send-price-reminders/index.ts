import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BRAND_URL, button, renderEmail, smallText, titleList } from '../_shared/email.ts'

// Weekly job: email publishers whose titles have no wholesale price. A title
// without one can be added to a cart but is rejected at checkout, so
// approve-application creates it inactive — meaning it is invisible to
// retailers until the publisher sets a price. Nothing else tells them to.
//
// Each title is reminded at most 4 times (price_reminder_count < 4) and stops
// as soon as a wholesale price is set. Note this deliberately does NOT filter
// on is_active: unpriced titles are precisely the ones held inactive, so
// filtering them out would skip every title this job exists to chase.
//
// Conventions match send-image-reminders / send-profile-reminders:
// verify_jwt = false, guarded by the shared REMINDER_SECRET via the
// `x-reminder-secret` header, runs with the service role, links to BRAND_URL,
// and supports a { dryRun, limit } test mode.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-reminder-secret',
}

const MAX_REMINDERS = 4

interface MagazineRow {
  id: string
  title: string | null
  issue_number: string | null
  cover_image_url: string | null
  publisher_id: string
}

interface PublisherGroup {
  publisherId: string
  email: string
  company: string
  titles: { id: string; title: string; issue: string | null; coverUrl: string | null }[]
}

const generateReminderEmail = (group: PublisherGroup): string => {
  const n = group.titles.length
  return renderEmail({
    preheader: `${n === 1 ? 'One of your titles is' : `${n} of your titles are`} hidden from retailers until ${n === 1 ? 'it has' : 'they have'} a price.`,
    label: 'Your titles',
    eyebrow: 'One step left',
    heading: n === 1 ? 'Set a wholesale price so stores can order.' : 'Set wholesale prices so stores can order.',
    intro: `Hi ${group.company}, retailers buy at your wholesale price, so until one is set these titles stay out of the catalogue. It takes about a minute each.`,
    blocks: [
      titleList(group.titles.map((t) => ({
        title: t.title,
        subtitle: t.issue ? `Issue ${t.issue}` : undefined,
        coverUrl: t.coverUrl,
        badge: { text: 'No price', tone: 'pending' as const },
        href: `${BRAND_URL}/publisher/titles/${t.id}/edit`,
        linkText: 'Set a wholesale price',
      }))),
      button(n === 1 ? 'Set price' : 'Set prices', `${BRAND_URL}/publisher/titles`),
      smallText('Once a price is set, the title goes live in the catalogue and these reminders stop. Not sure what to charge? Reply and we will help you price it.'),
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
    // ---- Auth: shared secret (matches the other reminder jobs) ----
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

    // 1. Titles with no wholesale price that still have reminders remaining.
    //    No is_active filter — see the note at the top of this file.
    const { data: mags, error: magErr } = await supabase
      .from('magazines')
      .select('id, title, issue_number, cover_image_url, publisher_id')
      .is('wholesale_price', null)
      .lt('price_reminder_count', MAX_REMINDERS)
    if (magErr) throw magErr

    const magazines = (mags ?? []) as MagazineRow[]
    if (magazines.length === 0) return json({ ok: true, dryRun, publishersEmailed: 0, titles: 0, recipients: [] })

    // 2. Resolve publisher -> email + company name.
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

    const emailByUser = new Map((users ?? []).map((u) => [u.id, u.email as string | null]))
    const pubById = new Map((pubs ?? []).map((p) => [p.id, p]))

    // 3. Group titles by publisher, one email each.
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
          company: pub.company_name || 'there',
          titles: [],
        })
      }
      groupMap.get(mag.publisher_id)!.titles.push({
        id: mag.id,
        title: mag.title || 'Untitled',
        issue: mag.issue_number,
        coverUrl: mag.cover_image_url,
      })
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
              ? 'Set a wholesale price for your Neesh title'
              : `Set wholesale prices for ${group.titles.length} of your Neesh titles`,
          html: generateReminderEmail(group),
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
      const { error: bumpErr } = await supabase.rpc('bump_price_reminders', { mag_ids: sentMagazineIds })
      if (bumpErr) throw bumpErr
    }

    return json({ ok: true, publishersEmailed, titles: sentMagazineIds.length, failures })
  } catch (error) {
    console.error('send-price-reminders error:', error)
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})
