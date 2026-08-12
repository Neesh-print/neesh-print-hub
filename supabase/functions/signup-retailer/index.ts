import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SignupRetailerRequest {
  firstName: string
  lastName: string
  email: string
  password: string
  storeName: string
  city: string
  state: string
  country: string
  website: string
  optInUpdates: boolean
  redirectUrl?: string
}

// Mirrors the DB-side validate_retailer_application trigger
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

const sha256Hex = async (input: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

interface WelcomeEmailData {
  firstName: string
  shopName: string
  verifyEmailUrl: string
}

const generateWelcomeEmail = (data: WelcomeEmailData): string => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Neesh</title>
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
                Welcome to Neesh, ${data.firstName}!
              </h2>

              <p style="margin: 0 0 16px; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
                Your account for <strong>${data.shopName}</strong> is live, you're signed in, and the catalog is open.
              </p>

              <p style="margin: 0 0 24px; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
                One quick step before your first order: <strong>confirm your email address</strong> so order updates reach you.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                <tr>
                  <td align="center">
                    <a href="${data.verifyEmailUrl}" style="display: inline-block; background-color: #C49A6C; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Confirm Your Email
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; color: #6B6B6B; font-size: 14px; line-height: 1.6;">
                You can browse the catalog right away — confirming just unlocks ordering. Need a fresh link? You can resend one from checkout at any time.
              </p>

              <!-- Divider -->
              <div style="margin: 32px 0; height: 1px; background-color: #E5E5E5;"></div>

              <!-- Next Steps -->
              <h3 style="margin: 0 0 16px; color: #1A1A1A; font-size: 18px; font-weight: 600;">
                What's Next?
              </h3>

              <ul style="margin: 0; padding-left: 20px; color: #4A4A4A; font-size: 15px; line-height: 1.8;">
                <li>Browse our curated catalog of independent magazines</li>
                <li>Order titles that fit your store</li>
                <li>Track orders and manage your inventory</li>
              </ul>

              <p style="margin: 32px 0 0; color: #6B6B6B; font-size: 14px; line-height: 1.6;">
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
    const body: SignupRetailerRequest = await req.json()

    const firstName = (body.firstName ?? '').trim()
    const lastName = (body.lastName ?? '').trim()
    const email = (body.email ?? '').trim()
    const password = body.password ?? ''
    const storeName = (body.storeName ?? '').trim()
    const city = (body.city ?? '').trim()
    const state = (body.state ?? '').trim()
    const country = (body.country ?? '').trim()
    const website = (body.website ?? '').trim()
    const optInUpdates = Boolean(body.optInUpdates)

    // Validate required fields, mirroring the DB validate_retailer_application trigger
    if (!firstName || !lastName || !email || !storeName || !city || !state || !country || !website) {
      return new Response(
        JSON.stringify({ error: 'All fields are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (!EMAIL_REGEX.test(email) || email.length > 255) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (password.length < 8 || password.length > 72) {
      return new Response(
        JSON.stringify({ error: 'Password must be between 8 and 72 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const buyerName = `${firstName} ${lastName}`
    if (buyerName.length > 200 || storeName.length > 200) {
      return new Response(
        JSON.stringify({ error: 'Name or store name is too long' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Step 1: Create the auth user. Doing this first means a duplicate email
    // fails cleanly before any application row is written. email_confirm: true
    // lets the retailer sign in immediately regardless of the project's
    // "Confirm email" auth setting — first-order gating is handled by our own
    // email_verified_at column on retailers instead.
    const { data: authData, error: authUserError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        role: 'retailer',
        first_name: firstName,
        last_name: lastName,
      },
    })

    if (authUserError) {
      if (authUserError.message?.includes('already') || authUserError.status === 422) {
        return new Response(
          JSON.stringify({ error: 'account_exists' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      console.error('Error creating auth user:', authUserError)
      return new Response(
        JSON.stringify({ error: `Failed to create account: ${authUserError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = authData.user.id
    console.log(`Created auth user with ID: ${userId}`)

    // Step 2: Insert the application row. The AFTER INSERT trigger/webhook on
    // retailer_applications notifies hi@neesh.art, so the team still hears
    // about every signup even though approval is automatic.
    const now = new Date().toISOString()
    const { data: applicationRow, error: insertError } = await supabaseAdmin
      .from('retailer_applications')
      .insert({
        buyer_name: buyerName,
        buyer_email: email,
        shop_name: storeName,
        city: city,
        state: state,
        country: country,
        shop_url: website,
        additional_notes: JSON.stringify({ optInUpdates }),
        status: 'approved',
        submitted_at: now,
        reviewed_at: now,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Error inserting application:', insertError)
      // Roll back the auth user so the applicant can retry cleanly
      await supabaseAdmin.auth.admin.deleteUser(userId).catch((e) =>
        console.error('Failed to roll back auth user:', e)
      )
      return new Response(
        JSON.stringify({ error: `Failed to save application: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Inserted retailer application: ${applicationRow.id}`)

    // Step 3: Ensure user record exists
    const { error: userUpsertError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: userId,
        email: email,
        username: email.split('@')[0],
        role: 'retailer',
        password_hash: 'managed_by_supabase_auth',
      }, { onConflict: 'id' })

    if (userUpsertError) {
      console.error('Error upserting user record:', userUpsertError)
      return new Response(
        JSON.stringify({ error: `Failed to create user record: ${userUpsertError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 4: Ensure profile exists
    const { error: profileUpsertError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        user_id: userId,
        full_name: buyerName,
        has_set_password: true,
      }, { onConflict: 'user_id' })

    if (profileUpsertError) {
      console.error('Error upserting profile:', profileUpsertError)
      // Non-fatal — profile is not strictly required for login
    }

    // Step 5: Create the retailer record. The raw verification token only
    // ever leaves this function inside the confirmation email; the DB keeps
    // a SHA-256 hash so nobody can self-verify by reading their own row.
    const verificationToken = crypto.randomUUID()
    const verificationTokenHash = await sha256Hex(verificationToken)
    const { error: retailerUpsertError } = await supabaseAdmin
      .from('retailers')
      .upsert({
        user_id: userId,
        shop_name: storeName,
        shop_url: website,
        city: city,
        state: state,
        country: country,
        verified: true,
        verified_at: now,
        email_verified_at: null,
        email_verification_token_hash: verificationTokenHash,
      }, { onConflict: 'user_id' })

    if (retailerUpsertError) {
      console.error('Error creating retailer record:', retailerUpsertError)
      return new Response(
        JSON.stringify({ error: `Failed to create retailer record: ${retailerUpsertError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Successfully signed up retailer: ${email}`)

    // Step 6: Send welcome email with the confirm-email link (non-fatal on
    // failure — the retailer can resend it from checkout).
    const siteUrl = body.redirectUrl || Deno.env.get('SITE_URL') || 'https://neesh.art'
    try {
      const resendApiKey = Deno.env.get('RESEND_API_KEY')
      if (resendApiKey) {
        const html = generateWelcomeEmail({
          firstName,
          shopName: storeName,
          verifyEmailUrl: `${siteUrl}/verify-email?token=${verificationToken}`,
        })

        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Neesh <hi@neesh.art>',
            to: email,
            subject: 'Welcome to Neesh — confirm your email',
            html: html,
          }),
        })

        if (!resendResponse.ok) {
          const resendError = await resendResponse.json()
          console.error('Error sending welcome email:', resendError)
        } else {
          console.log('Welcome email sent successfully')
        }
      } else {
        console.error('RESEND_API_KEY not found, cannot send welcome email')
      }
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
