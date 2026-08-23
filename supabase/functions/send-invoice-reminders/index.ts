import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-reminder-secret',
}

const BASE_URL = 'https://neesh.art'

interface DueInvoice {
  invoice_id: string
  retailer_id: string
  email: string
  shop_name: string | null
  total: number
  amount_due: number
  due_at: string
  hosted_invoice_url: string | null
  reminder_kind: 'due_soon' | 'overdue'
}

const generateReminderEmail = (inv: DueInvoice): string => {
  const shop = inv.shop_name || 'there'
  const dueStr = new Date(inv.due_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  const overdue = inv.reminder_kind === 'overdue'
  const headline = overdue ? 'Your invoice is overdue' : 'Your invoice is due soon'
  const accent = overdue ? '#EF4444' : '#C49A6C'
  const payUrl = inv.hosted_invoice_url || `${BASE_URL}/retailer/invoices`
  const intro = overdue
    ? `Your Neesh invoice was due on <strong>${dueStr}</strong> and is now past due. Please pay it as soon as possible to keep your account in good standing.`
    : `This is a friendly reminder that your Neesh invoice is due on <strong>${dueStr}</strong>.`

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${headline}</title></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F5F5F0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F5F5F0; padding: 40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); overflow: hidden;">
        <tr><td style="background-color: #1A1A1A; padding: 40px 40px 30px; text-align: center;">
          <h1 style="margin: 0; color: #FFFFFF; font-size: 28px; font-weight: 600; letter-spacing: 0.5px;">NEESH</h1>
          <p style="margin: 8px 0 0; color: #A0A0A0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">Payment Reminder</p>
        </td></tr>
        <tr><td style="padding: 40px;">
          <h2 style="margin: 0 0 20px; color: #1A1A1A; font-size: 24px; font-weight: 600;">${headline}</h2>
          <p style="margin: 0 0 16px; color: #4A4A4A; font-size: 16px; line-height: 1.6;">Hi ${shop},</p>
          <p style="margin: 0 0 16px; color: #4A4A4A; font-size: 16px; line-height: 1.6;">${intro}</p>
          <div style="margin: 28px 0; padding: 20px; background-color: #F8F8F6; border-radius: 8px; border-left: 4px solid ${accent};">
            <table width="100%">
              <tr><td style="color: #6B6B6B; font-size: 14px; padding: 4px 0;">Amount due:</td>
                  <td style="color: #1A1A1A; font-size: 18px; font-weight: 600; text-align: right;">$${Number(inv.amount_due).toFixed(2)}</td></tr>
              <tr><td style="color: #6B6B6B; font-size: 14px; padding: 4px 0;">Due date:</td>
                  <td style="color: #1A1A1A; font-size: 14px; text-align: right;">${dueStr}</td></tr>
            </table>
          </div>
          <div style="text-align: center; margin: 28px 0 8px;">
            <a href="${payUrl}" style="display: inline-block; background-color: #1A1A1A; color: #FFFFFF; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 32px; border-radius: 8px;">Pay invoice</a>
          </div>
          <div style="margin-top: 32px; padding: 20px; background-color: #F8F8F6; border-radius: 8px;">
            <p style="margin: 0; color: #4A4A4A; font-size: 14px; line-height: 1.6;">
              <strong>Questions?</strong> Reply to this email or reach us at
              <a href="mailto:hi@neesh.art" style="color: #C49A6C; text-decoration: none;">hi@neesh.art</a>
            </p>
          </div>
        </td></tr>
        <tr><td style="background-color: #F8F8F6; padding: 30px 40px; text-align: center; border-top: 1px solid #E5E5E5;">
          <p style="margin: 0; color: #A0A0A0; font-size: 12px;">© ${new Date().getFullYear()} Neesh. All rights reserved.</p>
        </td></tr>
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

    // 1) Flip open invoices to overdue where past due.
    const { error: overdueError } = await supabase.rpc('mark_overdue_invoices')
    if (overdueError) console.error('mark_overdue_invoices failed:', overdueError)

    // 2) Who needs a reminder.
    const { data, error } = await supabase.rpc('due_invoice_reminders')
    if (error) throw error

    let due = (data ?? []) as DueInvoice[]
    if (limit) due = due.slice(0, limit)

    if (dryRun) {
      return new Response(
        JSON.stringify({
          dryRun: true,
          count: due.length,
          recipients: due.map((i) => ({
            email: i.email,
            shop_name: i.shop_name,
            amount_due: i.amount_due,
            due_at: i.due_at,
            kind: i.reminder_kind,
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

    for (const inv of due) {
      try {
        const subject = inv.reminder_kind === 'overdue'
          ? `Overdue: your Neesh invoice ($${Number(inv.amount_due).toFixed(2)})`
          : `Reminder: your Neesh invoice is due soon`

        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Neesh <hi@neesh.art>',
            to: inv.email,
            subject,
            html: generateReminderEmail(inv),
            reply_to: 'hi@neesh.art',
          }),
        })

        if (!resendResponse.ok) {
          const detail = await resendResponse.json().catch(() => ({}))
          results.push({ email: inv.email, ok: false, error: JSON.stringify(detail) })
          continue // leave last_reminder_at unchanged so it retries next run
        }

        // Only stamp AFTER a confirmed send, so failures are retried.
        const { error: stampError } = await supabase
          .from('invoices')
          .update({ last_reminder_at: new Date().toISOString() })
          .eq('id', inv.invoice_id)

        results.push({ email: inv.email, ok: !stampError, error: stampError?.message })
      } catch (err) {
        results.push({ email: inv.email, ok: false, error: err instanceof Error ? err.message : 'Unknown error' })
      }
    }

    const sent = results.filter((r) => r.ok).length
    return new Response(
      JSON.stringify({ sent, failed: results.length - sent, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error in send-invoice-reminders:', error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
