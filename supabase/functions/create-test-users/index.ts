import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TestUser {
  email: string
  password: string
  role: 'publisher' | 'retailer' | 'admin'
  fullName: string
  businessName?: string
}

const testUsers: TestUser[] = [
  {
    email: 'publisher@test.com',
    password: 'Test123!',
    role: 'publisher',
    fullName: 'Test Publisher',
    businessName: 'Indie Press Co',
  },
  {
    email: 'retailer@test.com',
    password: 'Test123!',
    role: 'retailer',
    fullName: 'Test Retailer',
    businessName: 'The Corner Bookshop',
  },
  {
    email: 'admin@test.com',
    password: 'Test123!',
    role: 'admin',
    fullName: 'Test Admin',
  },
]

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Starting test user creation...')

    // Create admin client using service role key
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

    const results: { email: string; status: string; error?: string }[] = []

    for (const testUser of testUsers) {
      console.log(`Creating user: ${testUser.email}`)

      try {
        // Create auth user using admin API
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: testUser.email,
          password: testUser.password,
          email_confirm: true,
          user_metadata: {
            role: testUser.role,
            full_name: testUser.fullName,
          },
        })

        if (authError) {
          // Check if user already exists
          if (authError.message?.includes('already been registered') || 
              authError.message?.includes('already exists')) {
            console.log(`User ${testUser.email} already exists, skipping...`)
            results.push({ email: testUser.email, status: 'already_exists' })
            continue
          }
          throw authError
        }

        if (!authData.user) {
          throw new Error('No user returned from auth creation')
        }

        const userId = authData.user.id
        console.log(`Auth user created with ID: ${userId}`)

        // Create entry in public.users table
        const { error: userError } = await supabaseAdmin
          .from('users')
          .insert({
            id: userId,
            email: testUser.email,
            username: testUser.email.split('@')[0],
            role: testUser.role,
            password_hash: 'managed_by_supabase_auth',
            email_verified: true,
          })

        if (userError) {
          console.error(`Error creating user record: ${userError.message}`)
        }

        // Create profile
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .insert({
            user_id: userId,
            full_name: testUser.fullName,
            business_name: testUser.businessName,
          })

        if (profileError) {
          console.error(`Error creating profile: ${profileError.message}`)
        }

        // Create role-specific record
        if (testUser.role === 'publisher') {
          const { error: publisherError } = await supabaseAdmin
            .from('publishers')
            .insert({
              user_id: userId,
              company_name: testUser.businessName,
              verified: true,
              verified_at: new Date().toISOString(),
            })

          if (publisherError) {
            console.error(`Error creating publisher: ${publisherError.message}`)
          }
        } else if (testUser.role === 'retailer') {
          const { error: retailerError } = await supabaseAdmin
            .from('retailers')
            .insert({
              user_id: userId,
              shop_name: testUser.businessName,
              verified: true,
              verified_at: new Date().toISOString(),
            })

          if (retailerError) {
            console.error(`Error creating retailer: ${retailerError.message}`)
          }
        }

        results.push({ email: testUser.email, status: 'created' })
        console.log(`Successfully created user: ${testUser.email}`)

      } catch (userError) {
        console.error(`Failed to create user ${testUser.email}:`, userError)
        results.push({ 
          email: testUser.email, 
          status: 'failed', 
          error: userError instanceof Error ? userError.message : 'Unknown error' 
        })
      }
    }

    console.log('Test user creation completed')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Test users processed',
        results,
        credentials: testUsers.map(u => ({
          email: u.email,
          password: u.password,
          role: u.role,
        })),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in create-test-users:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
