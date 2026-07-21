import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Weekly job: email publishers whose active titles are missing a cover image.
// Each title is reminded at most 4 times (image_reminder_count < 4) and stops
// as soon as a cover image is uploaded. Intended to be invoked on a weekly
// schedule (pg_cron -> pg_net). See ./README.md for the schedule setup.
//
// Auth: this function has verify_jwt = false (see supabase/config.toml) and is
// guarded by a shared secret in the `x-cron-secret` header, compared against the
// CRON_SECRET env var. It runs with the service role key to bypass RLS.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const MAX_REMINDERS = 4

interface MagazineRow {
  id: string
  title: string | null
  publisher_id: string
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const buildEmail = (companyName: string, titles: { id: string; title: string }[], appUrl: string): string => {
  const rows = titles
    .map(
      (t) => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #E5E5E5;">
          <span style="color: #1A1A1A; font-size: 16px; font-weight: 500;">${escapeHtml(t.title)}</span>
          <br />
          <a href="${appUrl}/publisher/titles/${t.id}/edit"
             style="color: #6D28D9; font-size: 14px; text-decoration: none;">
            Add a cover image &rarr;
          </a>
        </td>
      </tr>`
    )
    .join('')

  const plural = titles.length === 1 ? 'title is' : 'titles are'

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Add cover images</title></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F5F5F0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F5F5F0; padding: 40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); overflow: hidden;">
        <tr>
          <td style="background-color: #1A1A1A; padding: 40px 40px 30px; text-align: center;">
            <h1 style="margin: 0; color: #FFFFFF; font-size: 28px; font-weight: 600; letter-spacing: 0.5px;">NEESH</h1>
            <p style="margin: 8px 0 0; color: #A0A0A0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">The OS for Indie Print</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px;">
            <h2 style="margin: 0 0 20px; color: #1A1A1A; font-size: 22px; font-weight: 600;">Your ${plural} missing a cover image</h2>
            <p style="margin: 0 0 24px; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
              Hi ${escapeHtml(companyName)}, titles without a cover image aren't shown to
              retailers in the Neesh catalogue. Add an image to get them in front of buyers:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
            <p style="margin: 28px 0 0; color: #6B6B6B; font-size: 14px; line-height: 1.6;">
              Once you upload an image, the title appears in the catalogue and these reminders stop.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color: #F8F8F6; padding: 24px 40px; text-align: center; border-top: 1px solid #E5E5E5;">
            <p style="margin: 0; color: #A0A0A0; font-size: 12px;">© ${new Date().getFullYear()} Neesh. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    // --- Guard: shared cron secret ---
    const cronSecret = Deno.env.get('CRON_SECRET')
    if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) return json({ error: 'Email service not configured' }, 500)

    const appUrl = (Deno.env.get('APP_URL') ?? 'https://app.neesh.art').replace(/\/$/, '')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Active, imageless titles that still have reminders remaining.
    const { data: mags, error: magErr } = await supabase
      .from('magazines')
      .select('id, title, publisher_id')
      .eq('is_active', true)
      .or('cover_image_url.is.null,cover_image_url.eq.')
      .lt('image_reminder_count', MAX_REMINDERS)

    if (magErr) throw magErr
    const magazines = (mags ?? []) as MagazineRow[]
    if (magazines.length === 0) return json({ ok: true, publishersEmailed: 0, titles: 0 })

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

    // 3. Group titles by publisher.
    const groups = new Map<string, { email: string; company: string; titles: { id: string; title: string }[] }>()
    for (const mag of magazines) {
      const pub = pubById.get(mag.publisher_id)
      if (!pub) continue
      const email = emailByUser.get(pub.user_id)
      if (!email) continue
      if (!groups.has(mag.publisher_id)) {
        groups.set(mag.publisher_id, { email, company: pub.company_name || 'there', titles: [] })
      }
      groups.get(mag.publisher_id)!.titles.push({ id: mag.id, title: mag.title || 'Untitled' })
    }

    // 4. Send one email per publisher; collect the titles that were actually sent.
    const sentMagazineIds: string[] = []
    let publishersEmailed = 0
    const failures: string[] = []

    for (const [, group] of groups) {
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
          html: buildEmail(group.company, group.titles, appUrl),
        }),
      })

      if (res.ok) {
        publishersEmailed++
        sentMagazineIds.push(...group.titles.map((t) => t.id))
      } else {
        failures.push(`${group.email}: ${res.status} ${await res.text()}`)
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
