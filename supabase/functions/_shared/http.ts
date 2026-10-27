/**
 * Small helpers shared by the shipping_v2 edge functions: CORS, JSON
 * responses and "who is calling" (user id + role).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://neesh.art',
  'https://www.neesh.art',
  'https://app.neesh.art',
  'https://neesh-experimental.vercel.app',
  'http://localhost:8080',
  'http://localhost:8081',
]

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = ALLOWED_ORIGINS.includes(origin || '') ? origin! : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  }
}

export function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

export function adminClient() {
  return createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export interface Caller {
  userId: string
  email: string | null
  role: string | null
}

/** The authenticated caller, or null. Role comes from public.users. */
export async function getCaller(req: Request, admin: ReturnType<typeof adminClient>): Promise<Caller | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null
  const userClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error } = await userClient.auth.getUser()
  if (error || !user) return null
  const { data: row } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
  return { userId: user.id, email: user.email ?? null, role: (row?.role as string | undefined) ?? null }
}
