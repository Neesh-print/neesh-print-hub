import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateConfirmEmail } from '../_shared/retailer-emails.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VerifyEmailRequest {
  action?: 'verify' | 'resend'
  token?: string
  redirectUrl?: string
}

const sha256Hex = async (input: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const body: VerifyEmailRequest = await req.json()
    const action = body.action ?? 'verify'

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    if (action === 'verify') {
      const token = (body.token ?? '').trim()
      if (!token || token.length > 100) {
        return new Response(
          JSON.stringify({ error: 'invalid_token' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const tokenHash = await sha256Hex(token)
      const { data: retailer, error: lookupError } = await supabaseAdmin
        .from('retailers')
        .select('id, email_verified_at')
        .eq('email_verification_token_hash', tokenHash)
        .maybeSingle()

      if (lookupError) {
        console.error('Error looking up verification token:', lookupError)
        return new Response(
          JSON.stringify({ error: 'Verification failed, please try again' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!retailer) {
        // Token not found: either invalid, or already used (we clear it on
        // success). The frontend shows a "log in and resend" hint for this.
        return new Response(
          JSON.stringify({ error: 'invalid_token' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { error: updateError } = await supabaseAdmin
        .from('retailers')
        .update({
          email_verified_at: retailer.email_verified_at ?? new Date().toISOString(),
          email_verification_token_hash: null,
        })
        .eq('id', retailer.id)

      if (updateError) {
        console.error('Error marking email verified:', updateError)
        return new Response(
          JSON.stringify({ error: 'Verification failed, please try again' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log(`Email verified for retailer ${retailer.id}`)
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'resend') {
      // Resending requires a signed-in retailer — the new link goes to the
      // email on their auth account.
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      )
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
      if (authError || !user?.email) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: retailer, error: retailerError } = await supabaseAdmin
        .from('retailers')
        .select('id, email_verified_at, shop_name')
        .eq('user_id', user.id)
        .maybeSingle()

      if (retailerError || !retailer) {
        return new Response(
          JSON.stringify({ error: 'No retailer account found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (retailer.email_verified_at) {
        return new Response(
          JSON.stringify({ success: true, alreadyVerified: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const verificationToken = crypto.randomUUID()
      const verificationTokenHash = await sha256Hex(verificationToken)
      const { error: tokenUpdateError } = await supabaseAdmin
        .from('retailers')
        .update({ email_verification_token_hash: verificationTokenHash })
        .eq('id', retailer.id)

      if (tokenUpdateError) {
        console.error('Error storing new verification token:', tokenUpdateError)
        return new Response(
          JSON.stringify({ error: 'Could not resend email, please try again' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const resendApiKey = Deno.env.get('RESEND_API_KEY')
      if (!resendApiKey) {
        console.error('RESEND_API_KEY not found, cannot send verification email')
        return new Response(
          JSON.stringify({ error: 'Email service not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const siteUrl = body.redirectUrl || Deno.env.get('SITE_URL') || 'https://neesh.art'
      const firstName = (user.user_metadata?.first_name as string | undefined) ?? ''
      const html = generateConfirmEmail({
        firstName,
        shopName: retailer.shop_name ?? null,
        verifyEmailUrl: `${siteUrl}/verify-email?token=${verificationToken}`,
        welcome: false,
      })

      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Neesh <hi@neesh.art>',
          to: user.email,
          subject: 'Confirm your email to start ordering on Neesh',
          reply_to: 'hi@neesh.art',
          html: html,
        }),
      })

      if (!resendResponse.ok) {
        const resendError = await resendResponse.json()
        console.error('Error sending verification email:', resendError)
        return new Response(
          JSON.stringify({ error: 'Could not send the email, please try again' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
