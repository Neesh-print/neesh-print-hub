// delete-user-data: full account + upload deletion.
// Caller must be the user themselves or an admin. Deletes, in order:
//   1. the user's folders in the three public storage buckets
//   2. their rows in application/marketplace tables (service role)
//   3. the auth user (last, so a partial failure can be retried)
// POST body: { "userId": "<uuid>" } (optional for self-deletion; defaults to caller)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BUCKETS = ['magazine-assets', 'product-images', 'retailer-profiles']

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
    const targetUserId: string = (body.userId ?? caller.id).trim()
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

    // ---- 1. Storage: remove {userId}/** from each public bucket ----
    const removedByBucket: Record<string, number> = {}
    for (const bucket of BUCKETS) {
      let removed = 0
      // list is per-folder; walk the user's known subfolders plus the root of their prefix
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

    // ---- 2. Database rows (children before parents; FK-safe order) ----
    // Collect the user's email for application-table cleanup
    const { data: userRow } = await admin.from('users').select('email').eq('id', targetUserId).single()
    const email = userRow?.email ?? caller.email ?? null

    const deletions: Array<[string, string, string | null]> = [
      ['user_wishlists', 'user_id', null],
      ['stock_notifications', 'user_id', null],
      ['notifications', 'user_id', null],
      ['notification_preferences', 'user_id', null],
      ['shipping_addresses', 'user_id', null],
      ['conversation_participants', 'user_id', null],
      ['profiles', 'user_id', null],
      ['retailers', 'user_id', null],
      ['publishers', 'user_id', null],
      ['users', 'id', null],
    ]
    const dbReport: Record<string, string> = {}
    for (const [table, column] of deletions) {
      const { error } = await admin.from(table).delete().eq(column, targetUserId)
      dbReport[table] = error ? `error: ${error.message}` : 'ok'
    }
    if (email) {
      const { error: raError } = await admin.from('retailer_applications').delete().eq('buyer_email', email)
      dbReport['retailer_applications'] = raError ? `error: ${raError.message}` : 'ok'
      const { error: paError } = await admin.from('publisher_applications').delete().eq('email', email)
      dbReport['publisher_applications'] = paError ? `error: ${paError.message}` : 'ok'
    }
    report.database = dbReport

    // ---- 3. Auth user (last) ----
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(targetUserId)
    report.authUser = authDeleteError ? `error: ${authDeleteError.message}` : 'deleted'

    console.log('delete-user-data report:', JSON.stringify(report))
    return json({ success: !authDeleteError, report })
  } catch (error) {
    console.error('delete-user-data fatal:', error)
    return json({ error: (error as Error).message ?? 'Internal error' }, 500)
  }
})
