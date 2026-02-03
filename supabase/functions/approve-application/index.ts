import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ApproveApplicationRequest {
  applicationId: string
  type: 'publisher' | 'retailer'
  redirectUrl?: string
}

interface ApprovalEmailData {
  firstName: string
  businessName: string
  role: 'publisher' | 'retailer'
  magicLinkUrl: string
}

const generateApprovalEmail = (data: ApprovalEmailData): string => {
  const roleTitle = data.role === 'publisher' ? 'Publisher' : 'Retailer'

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

              <!-- Welcome Message -->
              <h2 style="margin: 0 0 20px; color: #1A1A1A; font-size: 24px; font-weight: 600;">
                Welcome to Neesh, ${data.firstName}! 🎉
              </h2>

              <p style="margin: 0 0 16px; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
                Great news! Your application for <strong>${data.businessName}</strong> has been approved. You're now part of the Neesh community.
              </p>

              <p style="margin: 0 0 24px; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
                Click the button below to access your ${roleTitle} dashboard and get started.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                <tr>
                  <td align="center">
                    <a href="${data.magicLinkUrl}" style="display: inline-block; background-color: #C49A6C; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Access Your Dashboard
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; color: #6B6B6B; font-size: 14px; line-height: 1.6;">
                This link will expire in 24 hours. You can also copy and paste this URL into your browser:
              </p>
              <p style="margin: 8px 0 0; color: #C49A6C; font-size: 14px; word-break: break-all;">
                ${data.magicLinkUrl}
              </p>

              <!-- Divider -->
              <div style="margin: 32px 0; height: 1px; background-color: #E5E5E5;"></div>

              <!-- Next Steps -->
              <h3 style="margin: 0 0 16px; color: #1A1A1A; font-size: 18px; font-weight: 600;">
                What's Next?
              </h3>

              ${data.role === 'publisher' ? `
                <ul style="margin: 0; padding-left: 20px; color: #4A4A4A; font-size: 15px; line-height: 1.8;">
                  <li>Add your magazine titles to the catalog</li>
                  <li>Set up your payment information</li>
                  <li>Start receiving orders from retailers</li>
                  <li>Track your sales and earnings</li>
                </ul>
              ` : `
                <ul style="margin: 0; padding-left: 20px; color: #4A4A4A; font-size: 15px; line-height: 1.8;">
                  <li>Browse our curated catalog of independent magazines</li>
                  <li>Add titles to your wishlist</li>
                  <li>Place your first order</li>
                  <li>Track shipments and manage inventory</li>
                </ul>
              `}

              <!-- Help -->
              <div style="margin-top: 32px; padding: 20px; background-color: #F8F8F6; border-radius: 8px; border-left: 4px solid #C49A6C;">
                <p style="margin: 0; color: #4A4A4A; font-size: 14px; line-height: 1.6;">
                  <strong>Need help?</strong> We're here for you. Reply to this email or reach out to us at
                  <a href="mailto:hi@neesh.art" style="color: #C49A6C; text-decoration: none;">hi@neesh.art</a>
                </p>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8F8F6; padding: 30px 40px; text-align: center; border-top: 1px solid #E5E5E5;">
              <p style="margin: 0 0 8px; color: #6B6B6B; font-size: 14px;">
                Welcome to the future of indie print distribution.
              </p>
              <p style="margin: 0; color: #A0A0A0; font-size: 12px;">
                © ${new Date().getFullYear()} Neesh. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}


Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // ============================================================
    // SECURITY: Require admin authentication
    // ============================================================
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the user is an admin using their JWT
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if the caller is an admin
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || !userData || userData.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    // ============================================================

    // Parse request body
    const { applicationId, type, redirectUrl }: ApproveApplicationRequest = await req.json()

    if (!applicationId || !type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: applicationId and type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!['publisher', 'retailer'].includes(type)) {
      return new Response(
        JSON.stringify({ error: 'Type must be either "publisher" or "retailer"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing ${type} application approval: ${applicationId}`)

    // Create admin client with service role key for user creation
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

    // Get application data
    const table = type === 'publisher' ? 'publisher_applications' : 'retailer_applications'
    const { data: application, error: fetchError } = await supabaseAdmin
      .from(table)
      .select('*')
      .eq('id', applicationId)
      .single()

    if (fetchError || !application) {
      return new Response(
        JSON.stringify({ error: 'Application not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const email = application.email || application.buyer_email
    if (!email) {
      return new Response(
        JSON.stringify({ error: 'No email found in application' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let userId = application.user_id

    // Step 1: Create auth user if they don't have one
    if (!userId) {
      const randomPassword = crypto.randomUUID()

      const { data: authData, error: authUserError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: randomPassword,
        email_confirm: true,
        user_metadata: {
          role: type,
          first_name: application.first_name || application.buyer_name?.split(' ')[0],
          last_name: application.last_name || application.buyer_name?.split(' ')[1],
        },
      })

      if (authUserError) {
        // Check if user already exists (422 error)
        if (authUserError.message?.includes('already') || authUserError.status === 422) {
          console.log('User already exists, looking up by email...')
          // Look up existing user by email
          const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
          if (!listError && existingUsers) {
            const existingUser = existingUsers.users.find(u => u.email === email)
            if (existingUser) {
              userId = existingUser.id
              console.log(`Found existing user with ID: ${userId}`)
            }
          }
          
          if (!userId) {
            console.error('Could not find existing user:', email)
            return new Response(
              JSON.stringify({ error: 'User exists but could not be found' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        } else {
          console.error('Error creating auth user:', authUserError)
          return new Response(
            JSON.stringify({ error: `Failed to create account: ${authUserError.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } else if (authData?.user) {
        userId = authData.user.id
        console.log(`Created auth user with ID: ${userId}`)

        // Only create user/profile records for new auth users
        // Step 2: Create user record
      const { error: userInsertError } = await supabaseAdmin
        .from('users')
        .insert({
          id: userId,
          email: email,
          username: email.split('@')[0],
          role: type,
          password_hash: 'managed_by_supabase_auth',
        })

      if (userInsertError && userInsertError.code !== '23505') {
        console.error('Error creating user record:', userInsertError)
      }

      // Step 3: Create profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          user_id: userId,
          full_name: application.first_name && application.last_name
            ? `${application.first_name} ${application.last_name}`
            : application.buyer_name || email.split('@')[0],
        })

      if (profileError && profileError.code !== '23505') {
        console.error('Error creating profile:', profileError)
      }

      // Step 4: Send magic link for sign in
      const siteUrl = redirectUrl || Deno.env.get('SITE_URL') || 'https://neesh.store'
      try {
        const { data: linkData, error: magicLinkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: email,
          options: {
            redirectTo: `${siteUrl}/${type}`,
          },
        })

        if (magicLinkError) {
          console.error('Error generating magic link:', magicLinkError)
        } else if (linkData?.properties?.action_link) {
          // Send email using Resend
          const resendApiKey = Deno.env.get('RESEND_API_KEY')
          if (resendApiKey) {
            const firstName = application.first_name || application.buyer_name?.split(' ')[0] || 'there'
            const businessName = type === 'publisher'
              ? (application.business_name || application.magazine_title || 'Your Business')
              : (application.shop_name || 'Your Shop')
            
            const html = generateApprovalEmail({
              firstName,
              businessName,
              role: type,
              magicLinkUrl: linkData.properties.action_link,
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
                subject: `Welcome to Neesh - ${businessName} Approved! 🎉`,
                html: html,
              }),
            })

            if (!resendResponse.ok) {
              const resendError = await resendResponse.json()
              console.error('Error sending approval email:', resendError)
            } else {
              console.log('Approval email sent successfully')
            }
          } else {
            console.error('RESEND_API_KEY not found, cannot send approval email')
          }
        }
      } catch (emailError) {
        console.error('Error with magic link / email:', emailError)
      }
      }
    } // end if (!userId) - new user creation

    // Validate we have a userId at this point
    if (!userId) {
      console.error('No userId available after user lookup/creation')
      return new Response(
        JSON.stringify({ error: 'Could not resolve user identity' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Proceeding with userId: ${userId}`)

    // Step 5: Create/update role-specific record
    if (type === 'publisher') {
      // Try to update existing publisher, or create new one
      const { error: updateError } = await supabaseAdmin
        .from('publishers')
        .update({
          company_name: application.business_name || application.magazine_title,
          description: application.description,
          website_url: application.social_website_link,
          instagram_handle: application.instagram_handle?.replace('@', ''),
          verified: true,
          verified_at: new Date().toISOString(),
        })
        .eq('user_id', userId)

      if (updateError && updateError.code === 'PGRST116') {
        // No publisher record exists, create one
        const { error: insertError } = await supabaseAdmin
          .from('publishers')
          .insert({
            id: userId, // Explicitly set id to match user_id for frontend queries
            user_id: userId,
            company_name: application.business_name || application.magazine_title,
            description: application.description,
            website_url: application.social_website_link,
            instagram_handle: application.instagram_handle?.replace('@', ''),
            verified: true,
            verified_at: new Date().toISOString(),
          })

        if (insertError && insertError.code !== '23505') {
          console.error('Error creating publisher:', insertError)
        }
      } else if (updateError) {
        console.error('Error updating publisher:', updateError)
      }
    } else if (type === 'retailer') {
      const { error: upsertError } = await supabaseAdmin
        .from('retailers')
        .upsert({
          user_id: userId,
          shop_name: application.shop_name || application.buyer_name,
          shop_url: application.shop_url,
          address: application.shop_address,
          city: application.city,
          state: application.state,
          postal_code: application.postal_code,
          country: application.country,
          phone: application.phone,
          instagram_handle: application.instagram_handle,
          verified: true,
          verified_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        })

      if (upsertError) {
        console.error('Error creating/updating retailer:', upsertError)
      }
    }

    // Step 6: Update application status
    const { error: updateError } = await supabaseAdmin
      .from(table)
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq('id', applicationId)

    if (updateError) {
      console.error('Error updating application status:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update application status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Successfully approved ${type} application: ${applicationId}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId,
        message: `${type} application approved successfully` 
      }),
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
