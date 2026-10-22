import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { button, formatDate, html as emailHtml, money, renderEmail, stats, strong } from '../_shared/email.ts'

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
  const dueStr = formatDate(new Date(inv.due_at))
  const overdue = inv.reminder_kind === 'overdue'
  const payUrl = inv.hosted_invoice_url || `${BASE_URL}/retailer/orders`
  const amount = money(Number(inv.amount_due))

  return renderEmail({
    preheader: overdue
      ? `${amount} was due on ${dueStr} and is now past due.`
      : `${amount} is due on ${dueStr}.`,
    label: 'Retailer · Invoice',
    badge: { text: overdue ? 'Overdue' : 'Due soon', tone: overdue ? 'error' : 'pending' },
    heading: overdue ? 'Your invoice is overdue.' : 'Your invoice is due soon.',
    intro: overdue
      ? emailHtml`Hi ${shop}, your Neesh invoice was due on ${strong(dueStr)} and is now past due. Please pay it as soon as you can to keep your account in good standing.`
      : emailHtml`Hi ${shop}, a quick reminder that your Neesh invoice is due on ${strong(dueStr)}.`,
    blocks: [
      stats([
        { label: 'Amount due', value: amount },
        { label: 'Due date', value: dueStr },
      ]),
      button('Pay invoice', payUrl),
    ],
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
          ? `Overdue: your Neesh invoice (${money(Number(inv.amount_due))})`
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
