import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BRAND_URL, button, formatIssue, renderEmail, smallText, titleList } from '../_shared/email.ts'
import { isQuotableAddress, type ShipAddress } from '../_shared/shipping.ts'

// Twice-weekly job (shipping_v2): email approved publishers who have no
// ships-from address. With live rates as the default there are no Neesh flat
// defaults, so spaces can't check out a publisher's titles until the address
// is in. The email also lists the publisher's live titles with no weight,
// which block quotes the same way.
//
// Capped at MAX_REMINDERS sends per publisher (publishers.shipping_reminder_count),
// at least 4 days apart. Also stops once the address is complete, the publisher
// switches to their own flat rates, or shipping_reminders_opted_out is set
// (e.g. they replied "stop").
//
// Conventions match send-price-reminders / send-image-reminders:
// verify_jwt = false, guarded by the shared REMINDER_SECRET via the
// `x-reminder-secret` header, runs with the service role, links to BRAND_URL,
// and supports a { dryRun, limit } test mode. dryRun also accepts
// { preview: true } to return the first email's HTML.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-reminder-secret',
}

const MAX_REMINDERS = 2

interface PublisherGroup {
  publisherId: string
  email: string
  firstName: string | null
  company: string
  sendNumber: number
  titlesWithoutWeight: { id: string; title: string; issue: string | null; coverUrl: string | null }[]
}

const generateReminderEmail = (group: PublisherGroup): string => {
  const missingWeights = group.titlesWithoutWeight.length
  const isLast = group.sendNumber >= MAX_REMINDERS
  const greeting = group.firstName ? `Hi ${group.firstName},` : 'Hi there,'
  return renderEmail({
    preheader: `Two minutes in Settings and spaces can check out ${group.company}.`,
    label: 'Shipping',
    eyebrow: isLast ? 'Last reminder' : 'Shipping is live',
    heading: 'Add your ships-from address so spaces can order.',
    intro: `${greeting} spaces on Neesh now see live shipping at checkout, quoted from where you ship. We don't have an address for ${group.company} yet, so spaces can't check out your titles until it's in.`,
    blocks: [
      button('Add your ships-from address', `${BRAND_URL}/publisher/settings`),
      ...(missingWeights > 0
        ? [
            smallText(
              missingWeights === 1
                ? 'We also need the weight of one copy of this title:'
                : 'We also need the weight of one copy of each of these:',
            ),
            titleList(group.titlesWithoutWeight.map((t) => ({
              title: t.title,
              subtitle: [group.company, formatIssue(t.issue)].filter(Boolean).join(' · '),
              coverUrl: t.coverUrl,
              badge: { text: 'No weight', tone: 'pending' as const },
              href: `${BRAND_URL}/publisher/titles/${t.id}/edit`,
              linkText: 'Add the weight',
            }))),
          ]
        : []),
      smallText('Spaces pay shipping at checkout, so it never comes out of your pocket. Rather not log in? Reply with your address and weights and we will add them for you.'),
      smallText(isLast
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
    // ---- Auth: shared secret (matches the other reminder jobs) ----
    const expectedSecret = Deno.env.get('REMINDER_SECRET')
    if (!expectedSecret) return json({ error: 'REMINDER_SECRET not configured' }, 500)
    if (req.headers.get('x-reminder-secret') !== expectedSecret) return json({ error: 'Unauthorized' }, 401)

    // ---- Options: { dryRun, limit, preview } (empty body is fine; cron sends {}) ----
    let dryRun = false
    let preview = false
    let limit: number | null = null
    try {
      const body = await req.json()
      dryRun = body?.dryRun === true
      preview = body?.preview === true
      if (typeof body?.limit === 'number' && body.limit > 0) limit = body.limit
    } catch {
      // no body
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Approved publishers on live rates.
    const { data: pubs, error: pubErr } = await supabase
      .from('publishers')
      .select('id, user_id, company_name, shipping_rate_mode, shipping_reminder_count, shipping_reminder_last_sent_at, shipping_reminders_opted_out')
      .eq('application_status', 'approved')
      .neq('shipping_rate_mode', 'flat')
      .eq('shipping_reminders_opted_out', false)
      .lt('shipping_reminder_count', MAX_REMINDERS)
    if (pubErr) throw pubErr
    if (!pubs?.length) return json({ ok: true, dryRun, publishersEmailed: 0, recipients: [] })

    // 2. Keep those without a complete ships-from address.
    const { data: settings, error: setErr } = await supabase
      .from('publisher_shipping_settings')
      .select('publisher_id, ships_from_address')
      .in('publisher_id', pubs.map((p) => p.id))
    if (setErr) throw setErr
    const addressById = new Map((settings ?? []).map((s) => [s.publisher_id, s.ships_from_address as Partial<ShipAddress> | null]))
    const minGapMs = 4 * 24 * 60 * 60 * 1000
    const missing = pubs.filter((p) => {
      if (p.shipping_reminder_last_sent_at && Date.now() - new Date(p.shipping_reminder_last_sent_at).getTime() < minGapMs) return false
      const a = addressById.get(p.id)
      return !isQuotableAddress(a ? { ...a, name: a.name || p.company_name || 'Publisher' } : null)
    })
    if (missing.length === 0) return json({ ok: true, dryRun, publishersEmailed: 0, recipients: [] })

    // 3. Emails, and live titles with no weight.
    const userIds = [...new Set(missing.map((p) => p.user_id).filter(Boolean))]
    const { data: users, error: userErr } = await supabase
      .from('users')
      .select('id, email')
      .in('id', userIds)
      .eq('is_demo', false) // skip demo / test accounts
    if (userErr) throw userErr
    const emailByUser = new Map((users ?? []).map((u) => [u.id, u.email as string | null]))
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', userIds)
    const firstNameByUser = new Map((profiles ?? []).map((pr) => [pr.user_id, ((pr.full_name as string | null) ?? '').trim().split(/\s+/)[0] || null]))

    const { data: mags, error: magErr } = await supabase
      .from('magazines')
      .select('id, title, issue_number, cover_image_url, publisher_id, weight_grams')
      .in('publisher_id', missing.map((p) => p.id))
      .eq('is_active', true)
      .eq('is_demo', false)
    if (magErr) throw magErr

    let groups: PublisherGroup[] = []
    for (const pub of missing) {
      const email = emailByUser.get(pub.user_id)
      if (!email) continue
      if (email.toLowerCase().endsWith('@neesh.art')) continue // skip internal accounts
      groups.push({
        publisherId: pub.id,
        email,
        firstName: firstNameByUser.get(pub.user_id) ?? null,
        company: pub.company_name || 'your publication',
        sendNumber: (pub.shipping_reminder_count ?? 0) + 1,
        titlesWithoutWeight: (mags ?? [])
          .filter((m) => m.publisher_id === pub.id && !(Number(m.weight_grams) > 0))
          .map((m) => ({ id: m.id, title: m.title || 'Untitled', issue: m.issue_number, coverUrl: m.cover_image_url })),
      })
    }
    if (limit) groups = groups.slice(0, limit)

    // Dry run: report who WOULD be emailed. Send nothing.
    if (dryRun) {
      return json({
        dryRun: true,
        publishers: groups.length,
        recipients: groups.map((g) => ({ email: g.email, company: g.company, titlesWithoutWeight: g.titlesWithoutWeight.map((t) => t.title) })),
        ...(preview && groups[0] ? { previewHtml: generateReminderEmail(groups[0]) } : {}),
      })
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) return json({ error: 'Email service not configured' }, 500)

    // 4. Send one email per publisher.
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
          subject: group.sendNumber >= MAX_REMINDERS
            ? 'Last reminder: add your ships-from address on Neesh'
            : 'Add your ships-from address so spaces can order on Neesh',
          html: generateReminderEmail(group),
          headers: { 'List-Unsubscribe': '<mailto:hi@neesh.art?subject=stop%20shipping%20reminders>' },
        }),
      })
      if (res.ok) {
        publishersEmailed++
        const { error: bumpErr } = await supabase
          .from('publishers')
          .update({ shipping_reminder_count: group.sendNumber, shipping_reminder_last_sent_at: new Date().toISOString() })
          .eq('id', group.publisherId)
        if (bumpErr) failures.push(`${group.email}: sent but counter not bumped: ${bumpErr.message}`)
      } else {
        failures.push(`${group.email}: ${res.status} ${await res.text().catch(() => '')}`)
      }
    }

    return json({ ok: true, publishersEmailed, failures })
  } catch (error) {
    console.error('send-shipping-reminders error:', error)
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})
