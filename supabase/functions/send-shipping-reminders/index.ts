import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BRAND_URL, button, formatIssue, renderEmail, smallText, titleList } from '../_shared/email.ts'
import { isQuotableAddress, type ShipAddress } from '../_shared/shipping.ts'

// Twice-weekly job (shipping_v2): email approved publishers who have no
// ships-from address. With live rates as the default there are no Neesh flat
// defaults, so spaces can't check out a publisher's titles until the address
// is in. The email also lists the publisher's live titles with no weight,
// which block quotes the same way.
//
// Stops on its own: a publisher drops out once their address is complete (or
// they switch to their own flat rates). No reminder counter.
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

interface PublisherGroup {
  publisherId: string
  email: string
  company: string
  titlesWithoutWeight: { id: string; title: string; issue: string | null; coverUrl: string | null }[]
}

const generateReminderEmail = (group: PublisherGroup): string => {
  const missingWeights = group.titlesWithoutWeight.length
  return renderEmail({
    preheader: 'Spaces can’t check out your titles until we know where you ship from.',
    label: 'Shipping',
    eyebrow: 'Action needed',
    heading: 'Add where you ship from so spaces can order.',
    intro: `Hi ${group.company}, spaces now pay shipping at checkout, quoted live from your ships-from address. Until you add it, spaces can’t check out your titles. It takes about two minutes.`,
    blocks: [
      button('Add your ships-from address', `${BRAND_URL}/publisher/settings`),
      ...(missingWeights > 0
        ? [
            smallText(
              missingWeights === 1
                ? 'This title also needs the weight of one copy, so we can quote shipping:'
                : 'These titles also need the weight of one copy, so we can quote shipping:',
            ),
            titleList(group.titlesWithoutWeight.map((t) => ({
              title: t.title,
              subtitle: formatIssue(t.issue) ?? undefined,
              coverUrl: t.coverUrl,
              badge: { text: 'No weight', tone: 'pending' as const },
              href: `${BRAND_URL}/publisher/titles/${t.id}/edit`,
              linkText: 'Add the weight',
            }))),
          ]
        : []),
      smallText('Shipping passes to you in full. Once your address is in, these reminders stop. Easier to reply with your address and weights? Do that and we’ll add them for you.'),
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
      .select('id, user_id, company_name, shipping_rate_mode')
      .eq('application_status', 'approved')
      .neq('shipping_rate_mode', 'flat')
    if (pubErr) throw pubErr
    if (!pubs?.length) return json({ ok: true, dryRun, publishersEmailed: 0, recipients: [] })

    // 2. Keep those without a complete ships-from address.
    const { data: settings, error: setErr } = await supabase
      .from('publisher_shipping_settings')
      .select('publisher_id, ships_from_address')
      .in('publisher_id', pubs.map((p) => p.id))
    if (setErr) throw setErr
    const addressById = new Map((settings ?? []).map((s) => [s.publisher_id, s.ships_from_address as Partial<ShipAddress> | null]))
    const missing = pubs.filter((p) => {
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
        company: pub.company_name || 'there',
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
          subject: 'Add your ships-from address so spaces can order on Neesh',
          html: generateReminderEmail(group),
        }),
      })
      if (res.ok) {
        publishersEmailed++
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
