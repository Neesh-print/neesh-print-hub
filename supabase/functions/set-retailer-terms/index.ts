import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://neesh.art',
  'https://www.neesh.art',
  'https://neesh-experimental.vercel.app',
  'http://localhost:8081',
];

function getCorsHeaders(origin: string | null) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin || '') ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

interface SetTermsRequest {
  retailer_user_id: string
  payment_terms_enabled: boolean
  net_terms_days: 0 | 14 | 30
  credit_limit: number
  terms_status: 'none' | 'pending' | 'approved' | 'suspended'
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseServiceKey) {
      return json(500, { error: 'Server configuration error' })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Verify admin auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json(401, { error: 'Missing authorization header' })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return json(401, { error: 'Unauthorized' })
    }
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role !== 'admin') {
      return json(403, { error: 'Admin access required' })
    }

    // Parse & validate
    const body: SetTermsRequest = await req.json()
    if (!body.retailer_user_id) {
      return json(400, { error: 'retailer_user_id is required' })
    }
    if (![0, 14, 30].includes(body.net_terms_days)) {
      return json(400, { error: 'net_terms_days must be 0, 14, or 30' })
    }
    if (!['none', 'pending', 'approved', 'suspended'].includes(body.terms_status)) {
      return json(400, { error: 'Invalid terms_status' })
    }
    if (typeof body.credit_limit !== 'number' || body.credit_limit < 0) {
      return json(400, { error: 'credit_limit must be a non-negative number' })
    }

    const isApproved = body.terms_status === 'approved'

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('retailers')
      .update({
        payment_terms_enabled: body.payment_terms_enabled,
        net_terms_days: body.net_terms_days,
        credit_limit: body.credit_limit,
        terms_status: body.terms_status,
        terms_approved_at: isApproved ? new Date().toISOString() : null,
        terms_approved_by: isApproved ? user.id : null,
      })
      .eq('user_id', body.retailer_user_id)
      .select('id, user_id, payment_terms_enabled, net_terms_days, credit_limit, terms_status')
      .single()

    if (updateError || !updated) {
      console.error('Failed to update retailer terms:', updateError)
      return json(500, { error: 'Failed to update retailer terms' })
    }

    return json(200, { success: true, retailer: updated })
  } catch (error) {
    console.error('Error in set-retailer-terms:', error)
    return json(500, { error: error instanceof Error ? error.message : 'Unknown error' })
  }
})
