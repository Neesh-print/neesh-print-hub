import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { button, details, html as emailHtml, paragraph, renderEmail, steps, strong } from '../_shared/email.ts'

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

  return renderEmail({
    preheader: `Send retailers straight to ${displayName}. No login needed to browse your titles.`,
    label: 'Your page',
    eyebrow: 'Your public page is live',
    heading: 'Share your Neesh page with retailers.',
    intro: `Hi ${pub.name}, every publisher on Neesh gets a shareable public page. It is the easiest way to send retailers straight to ${displayName}, with no login needed to browse your titles.`,
    blocks: [
      details([['Your page', profileUrl]]),
      button('View your page', profileUrl),
      paragraph('Share it in your newsletter, link it in your Instagram bio, or send it to shops you would love to stock you.'),
      steps('Add your logo first', [
        emailHtml`Open ${strong('My Profile')} on your Neesh dashboard.`,
        'Click your profile photo, the circle at the top.',
        'Upload a square image. Your logo or a cover works well.',
      ]),
      button('Update your logo', logoUrl),
    ],
    footerNote: 'You are getting this because you publish on Neesh.',
  })
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
            subject: 'Your Neesh page is live. Share it with retailers',
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
