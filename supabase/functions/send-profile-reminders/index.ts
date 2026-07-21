import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-reminder-secret',
}

const BASE_URL = 'https://neesh.art'

interface DuePublisher {
  id: string
  email: string
  name: string
  company_name: string | null
  profile_slug: string
}

// "Your public page exists" reminder — encourages sharing the profile link and
// shows publishers how to add their logo.
const generateReminderEmail = (pub: DuePublisher): string => {
  const profileUrl = `${BASE_URL}/p/${pub.profile_slug}`
  const logoUrl = `${BASE_URL}/publisher/profile`
  const displayName = pub.company_name || 'your publication'

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Neesh page is live</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F5F5F0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F5F5F0; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); overflow: hidden;">

          <!-- Header -->
          <tr>
            <td style="background-color: #1A1A1A; padding: 40px 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 28px; font-weight: 600; letter-spacing: 0.5px;">NEESH</h1>
              <p style="margin: 8px 0 0; color: #A0A0A0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">The OS for Indie Print</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1A1A1A; font-size: 24px; font-weight: 600;">Your public page is live 🎉</h2>

              <p style="margin: 0 0 16px; color: #4A4A4A; font-size: 16px; line-height: 1.6;">Hi ${pub.name},</p>

              <p style="margin: 0 0 16px; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
                Every publisher on Neesh gets a shareable public page. It's the easiest way to send retailers straight to ${displayName} &mdash; no login required for them to browse your titles.
              </p>

              <!-- Profile link CTA -->
              <div style="margin: 28px 0; padding: 20px; background-color: #F8F8F6; border-radius: 8px; text-align: center;">
                <p style="margin: 0 0 12px; color: #6B6B6B; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Your page</p>
                <p style="margin: 0 0 16px; color: #1A1A1A; font-size: 16px; font-weight: 600; word-break: break-all;">${profileUrl}</p>
                <a href="${profileUrl}" style="display: inline-block; background-color: #1A1A1A; color: #FFFFFF; text-decoration: none; font-size: 15px; font-weight: 600; padding: 12px 28px; border-radius: 8px;">View your page</a>
              </div>

              <p style="margin: 0 0 24px; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
                Share it in your newsletter, link it in your Instagram bio, or send it to shops you'd love to stock you.
              </p>

              <!-- Divider -->
              <div style="margin: 32px 0; height: 1px; background-color: #E5E5E5;"></div>

              <!-- Logo how-to -->
              <h3 style="margin: 0 0 12px; color: #1A1A1A; font-size: 18px; font-weight: 600;">Add your logo first</h3>
              <p style="margin: 0 0 16px; color: #4A4A4A; font-size: 15px; line-height: 1.6;">
                Pages with a logo look far more credible to retailers. It takes about 30 seconds:
              </p>
              <ol style="margin: 0 0 24px; padding-left: 20px; color: #4A4A4A; font-size: 15px; line-height: 1.8;">
                <li>Open <strong>My Profile</strong> on your Neesh dashboard</li>
                <li>Click your profile photo (the circle at the top)</li>
                <li>Upload a square image &mdash; your logo or cover works great</li>
              </ol>
              <div style="text-align: center; margin-bottom: 8px;">
                <a href="${logoUrl}" style="display: inline-block; background-color: #FFFFFF; color: #1A1A1A; text-decoration: none; font-size: 15px; font-weight: 600; padding: 12px 28px; border-radius: 8px; border: 1px solid #1A1A1A;">Update your logo</a>
              </div>

              <!-- Contact -->
              <div style="margin-top: 32px; padding: 20px; background-color: #F8F8F6; border-radius: 8px; border-left: 4px solid #C49A6C;">
                <p style="margin: 0; color: #4A4A4A; font-size: 14px; line-height: 1.6;">
                  <strong>Questions?</strong> Reply to this email or reach us at
                  <a href="mailto:hi@neesh.art" style="color: #C49A6C; text-decoration: none;">hi@neesh.art</a>
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8F8F6; padding: 30px 40px; text-align: center; border-top: 1px solid #E5E5E5;">
              <p style="margin: 0 0 8px; color: #6B6B6B; font-size: 14px;">Thanks for being part of Neesh.</p>
              <p style="margin: 0; color: #A0A0A0; font-size: 12px;">© ${new Date().getFullYear()} Neesh. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // ---- Auth: shared secret (the scheduler / operator holds it) ----
    const expectedSecret = Deno.env.get('REMINDER_SECRET')
    if (!expectedSecret) {
      return new Response(
        JSON.stringify({ error: 'REMINDER_SECRET not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (req.headers.get('x-reminder-secret') !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ---- Options ----
    let dryRun = false
    let limit: number | null = null
    try {
      const body = await req.json()
      dryRun = body?.dryRun === true
      if (typeof body?.limit === 'number' && body.limit > 0) limit = body.limit
    } catch {
      // empty body is fine (cron sends {})
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data, error } = await supabase.rpc('due_profile_reminders')
    if (error) throw error

    let due = (data ?? []) as DuePublisher[]
    if (limit) due = due.slice(0, limit)

    // Dry run: return who WOULD be emailed, send nothing, stamp nothing.
    if (dryRun) {
      return new Response(
        JSON.stringify({
          dryRun: true,
          count: due.length,
          recipients: due.map((p) => ({
            email: p.email,
            company_name: p.company_name,
            url: `${BASE_URL}/p/${p.profile_slug}`,
          })),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results: Array<{ email: string; ok: boolean; error?: string }> = []

    for (const pub of due) {
      try {
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Neesh <hi@neesh.art>',
            to: pub.email,
            subject: 'Your Neesh page is live — share it with retailers',
            html: generateReminderEmail(pub),
            reply_to: 'hi@neesh.art',
          }),
        })

        if (!resendResponse.ok) {
          const detail = await resendResponse.json().catch(() => ({}))
          results.push({ email: pub.email, ok: false, error: JSON.stringify(detail) })
          continue // leave profile_reminder_sent_at NULL so it retries next run
        }

        // Only stamp AFTER a confirmed send, so failures are retried.
        const { error: stampError } = await supabase
          .from('publishers')
          .update({ profile_reminder_sent_at: new Date().toISOString() })
          .eq('id', pub.id)

        results.push({ email: pub.email, ok: !stampError, error: stampError?.message })
      } catch (err) {
        results.push({ email: pub.email, ok: false, error: err instanceof Error ? err.message : 'Unknown error' })
      }
    }

    const sent = results.filter((r) => r.ok).length
    return new Response(
      JSON.stringify({ sent, failed: results.length - sent, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error in send-profile-reminders:', error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
