// delete-user-data: close an account.
// Caller must be the user themselves or an admin. In order:
//   1. public.close_user_account() de-identifies the account in one
//      transaction. It keeps the rows that orders, invoices and payouts hang
//      off (the privacy policy keeps those records for seven years), deletes
//      data that is only personal, and refuses while orders are open,
//      invoices unpaid or payouts pending.
//   2. the user's folder in retailer-profiles (profile photos). Magazine
//      covers and product images stay: past orders still show them.
//   3. the auth user (last, so a partial failure can be retried; closing an
//      already closed account is a no-op).
// POST body: { "userId": "<uuid>" } (optional for self-deletion; defaults to caller)
// Refusals come back as 409 { code, error }.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PERSONAL_BUCKETS = ['retailer-profiles']

const plural = (n: string, one: string, many: string) => (n === '1' ? `is 1 ${one}` : `are ${n} ${many}`)

const REFUSALS: Record<string, (n: string) => string> = {
  open_orders: (n) =>
    `There ${plural(n, 'open order', 'open orders')} on this account. It can be closed once every order has shipped or been cancelled.`,
  unpaid_invoices: (n) =>
    `There ${plural(n, 'unpaid invoice', 'unpaid invoices')} on this account. It can be closed once they are paid.`,
  pending_payouts: (n) =>
    `There ${plural(n, 'pending payout', 'pending payouts')} on this account. It can be closed once they have been paid out.`,
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    // ---- Authenticate the caller ----
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return json({ error: 'Missing authorization' }, 401)

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
    )
    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser()
    if (authError || !caller) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // ---- Authorize: self, or admin per public.users.role ----
    const body = await req.json().catch(() => ({}))
    const targetUserId: string = String(body.userId ?? caller.id).trim()
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId)) {
      return json({ error: 'Invalid userId' }, 400)
    }

    if (targetUserId !== caller.id) {
      const { data: callerRow } = await admin.from('users').select('role').eq('id', caller.id).single()
      if (callerRow?.role !== 'admin') {
        return json({ error: 'Forbidden: only admins can delete other accounts' }, 403)
      }
    }

    const report: Record<string, unknown> = { userId: targetUserId }

    // ---- 1. Database: de-identify in one transaction ----
    const { data: closed, error: closeError } = await admin.rpc('close_user_account', { p_user_id: targetUserId })
    if (closeError) {
      const message = closeError.message ?? ''
      const [code, count] = message.split(':')
      if (REFUSALS[code]) {
        return json({ code, error: REFUSALS[code](count ?? '') }, 409)
      }
      if (message.includes('admin accounts')) {
        return json({ code: 'admin_account', error: 'Admin accounts are closed by hand. Remove the admin role first.' }, 409)
      }
      console.error('delete-user-data close_user_account failed:', closeError)
      return json({ error: 'Could not close the account. Nothing was changed.' }, 500)
    }
    report.database = closed

    // ---- 2. Storage: remove {userId}/** from the personal buckets ----
    const removedByBucket: Record<string, number> = {}
    for (const bucket of PERSONAL_BUCKETS) {
      let removed = 0
      const stack = [targetUserId]
      while (stack.length) {
        const prefix = stack.pop()!
        const { data: entries, error: listError } = await admin.storage.from(bucket).list(prefix, { limit: 1000 })
        if (listError || !entries) continue
        const files: string[] = []
        for (const entry of entries) {
          if (entry.id === null) {
            // folder
            stack.push(`${prefix}/${entry.name}`)
          } else {
            files.push(`${prefix}/${entry.name}`)
          }
        }
        if (files.length) {
          const { error: rmError } = await admin.storage.from(bucket).remove(files)
          if (!rmError) removed += files.length
        }
      }
      removedByBucket[bucket] = removed
    }
    report.storageRemoved = removedByBucket

    // ---- 3. Auth user (last) ----
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(targetUserId)
    const authGone = !authDeleteError || /not.?found/i.test(authDeleteError.message ?? '')
    report.authUser = authGone ? 'deleted' : `error: ${authDeleteError!.message}`

    console.log('delete-user-data report:', JSON.stringify(report))
    if (!authGone) {
      return json({ success: false, error: 'The account was closed but the login could not be removed. Try again.', report }, 500)
    }
    return json({ success: true, report })
  } catch (error) {
    console.error('delete-user-data fatal:', error)
    return json({ error: (error as Error).message ?? 'Internal error' }, 500)
  }
})
