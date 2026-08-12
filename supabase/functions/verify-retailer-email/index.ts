import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

const generateVerificationEmail = (firstName: string, verifyEmailUrl: string): string => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm your email</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F5F5F0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F5F5F0; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); overflow: hidden;">

          <!-- Header -->
          <tr>
            <td style="background-color: #1A1A1A; padding: 40px 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 28px; font-weight: 600; letter-spacing: 0.5px;">
                NEESH
              </h1>
              <p style="margin: 8px 0 0; color: #A0A0A0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">
                The OS for Indie Print
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">

              <h2 style="margin: 0 0 20px; color: #1A1A1A; font-size: 24px; font-weight: 600;">
                Confirm your email${firstName ? `, ${firstName}` : ''}
              </h2>

              <p style="margin: 0 0 24px; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
                Click the button below to confirm your email address and unlock ordering on Neesh.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                <tr>
                  <td align="center">
                    <a href="${verifyEmailUrl}" style="display: inline-block; background-color: #C49A6C; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Confirm Your Email
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; color: #6B6B6B; font-size: 14px; line-height: 1.6;">
                Questions? Just reply to this email or reach us at <a href="mailto:hi@neesh.art" style="color: #C49A6C;">hi@neesh.art</a>.
              </p>

            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
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
        .select('id, email_verified_at')
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
      const html = generateVerificationEmail(
        firstName,
        `${siteUrl}/verify-email?token=${verificationToken}`
      )

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
