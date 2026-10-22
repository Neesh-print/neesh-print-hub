import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { button, renderEmail, smallText } from '../_shared/email.ts'

// Scheduled job (see 20260721000002_schedule_onboarding_nudges.sql) that emails
// publishers who started but never finished Stripe payout onboarding. Nudges go
// out at 2, 7, and 21 days after the connected account was created. Every send
// is recorded in stripe_onboarding_nudges so nobody gets the same milestone
// twice, and at most one email is sent per publisher per run (the most recent
// milestone they have passed and not yet been reminded about).
//
// Links always point at /onboarding/continue, which mints a fresh Stripe link
// on demand — never a raw Stripe URL that can expire.

const NUDGE_DAYS = [2, 7, 21]
const DAY_MS = 24 * 60 * 60 * 1000

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  // This function is public (verify_jwt = false so the scheduler can reach it),
  // so gate it behind a shared secret.
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const siteUrl = Deno.env.get('SITE_URL') || 'https://neesh.art'

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Candidates: connected but onboarding not finished.
    const { data: publishers, error: pubError } = await supabaseAdmin
      .from('publishers')
      .select('id, company_name, user_id, stripe_account_created_at')
      .not('stripe_account_id', 'is', null)
      .eq('stripe_details_submitted', false)
      .not('stripe_account_created_at', 'is', null)

    if (pubError) {
      console.error('Failed to load publishers:', pubError)
      return new Response(
        JSON.stringify({ error: 'Failed to load publishers' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const now = Date.now()
    let sent = 0
    let processed = 0

    for (const publisher of publishers ?? []) {
      processed++

      const createdAt = publisher.stripe_account_created_at
        ? new Date(publisher.stripe_account_created_at).getTime()
        : null
      if (!createdAt) continue

      const ageDays = Math.floor((now - createdAt) / DAY_MS)

      // Which milestones has this publisher already been nudged for?
      const { data: alreadySent } = await supabaseAdmin
        .from('stripe_onboarding_nudges')
        .select('nudge_day')
        .eq('publisher_id', publisher.id)

      const sentDays = new Set((alreadySent ?? []).map((n) => n.nudge_day))

      // Send the most recent milestone they have passed and not yet received.
      const dueDay = NUDGE_DAYS
        .filter((d) => ageDays >= d && !sentDays.has(d))
        .sort((a, b) => b - a)[0]

      if (dueDay === undefined) continue

      // Resolve the publisher's email.
      const { data: publisherUser } = await supabaseAdmin
        .from('users')
        .select('email')
        .eq('id', publisher.user_id)
        .single()

      if (!publisherUser?.email) {
        console.log(`No email for publisher ${publisher.id}; skipping`)
        continue
      }

      // Record the nudge first. The unique constraint makes this the guard
      // against double-sends if two runs overlap: if the insert conflicts,
      // another run already claimed this milestone, so skip the email.
      const { error: insertError } = await supabaseAdmin
        .from('stripe_onboarding_nudges')
        .insert({ publisher_id: publisher.id, nudge_day: dueDay })

      if (insertError) {
        console.log(`Nudge day ${dueDay} already recorded for ${publisher.id}; skipping`)
        continue
      }

      const emailed = await sendNudgeEmail(
        resendApiKey,
        publisherUser.email,
        publisher.company_name || 'there',
        siteUrl
      )

      if (emailed) {
        sent++
        console.log(`Sent day-${dueDay} nudge to publisher ${publisher.id}`)
      } else {
        // Email failed — roll back the record so a later run can retry.
        await supabaseAdmin
          .from('stripe_onboarding_nudges')
          .delete()
          .eq('publisher_id', publisher.id)
          .eq('nudge_day', dueDay)
        console.error(`Failed to email publisher ${publisher.id}; rolled back nudge record`)
      }
    }

    return new Response(
      JSON.stringify({ processed, sent }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in send-onboarding-nudges:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Sends the reminder via Resend. Returns true on success. Copy is plain and
// non-alarming; the only action links to /onboarding/continue.
async function sendNudgeEmail(
  resendApiKey: string | undefined,
  to: string,
  publisherName: string,
  siteUrl: string
): Promise<boolean> {
  if (!resendApiKey) {
    console.error('RESEND_API_KEY not configured')
    return false
  }

  const continueUrl = `${siteUrl}/onboarding/continue`

  const html = renderEmail({
    preheader: 'You started payout setup but have not finished, so we cannot pay you for orders yet.',
    label: 'Publisher · Payouts',
    badge: { text: 'Payouts not set up', tone: 'pending' },
    heading: 'Finish setting up payouts.',
    intro: `Hi ${publisherName}, you started setting up payouts but have not finished, so we cannot send you payments for orders yet. It takes about five minutes.`,
    blocks: [
      button('Continue payout setup', continueUrl),
      smallText('If you have already finished, you can ignore this message.'),
    ],
  })

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Neesh <hi@neesh.art>',
        to,
        reply_to: 'hi@neesh.art',
        subject: 'Finish setting up payouts on Neesh',
        html,
      }),
    })

    if (!response.ok) {
      console.error('Resend error:', await response.text())
      return false
    }
    return true
  } catch (error) {
    console.error('Error sending nudge email:', error)
    return false
  }
}
