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
        console.error('Error creating auth user:', authUserError)
        return new Response(
          JSON.stringify({ error: `Failed to create account: ${authUserError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!authData.user) {
        return new Response(
          JSON.stringify({ error: 'Failed to create user account' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      userId = authData.user.id
      console.log(`Created auth user with ID: ${userId}`)

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
        const { error: magicLinkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: email,
          options: {
            redirectTo: `${siteUrl}/${type}`,
          },
        })

        if (magicLinkError) {
          console.error('Error generating magic link:', magicLinkError)
        }
      } catch (emailError) {
        console.error('Error with magic link:', emailError)
      }
    }

    // Step 5: Create/update role-specific record
    if (type === 'publisher') {
      const { error: updateError } = await supabaseAdmin
        .from('publishers')
        .update({
          application_status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          company_name: application.business_name || application.magazine_title,
          description: application.description,
          website_url: application.social_website_link,
          instagram_handle: application.instagram_handle?.replace('@', ''),
        })
        .eq('user_id', userId)

      if (updateError && updateError.code === 'PGRST116') {
        // No publisher record exists, create one
        const { error: insertError } = await supabaseAdmin
          .from('publishers')
          .insert({
            user_id: userId,
            company_name: application.business_name || application.magazine_title,
            description: application.description,
            website_url: application.social_website_link,
            instagram_handle: application.instagram_handle?.replace('@', ''),
            application_status: 'approved',
            reviewed_at: new Date().toISOString(),
            reviewed_by: user.id,
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
          shop_name: application.shop_name,
          shop_url: application.shop_url,
          address: application.shop_address,
          city: application.city,
          state: application.state,
          postal_code: application.postal_code,
          country: application.country,
          phone: application.phone,
          instagram_handle: application.instagram_handle,
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
        user_id: userId,
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
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
