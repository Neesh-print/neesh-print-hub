import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  EMAIL_SUBJECTS,
  generateApprovalEmail,
  generateClaimApprovalEmail,
  generateSellApprovalEmail,
} from '../_shared/application-emails.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ApproveApplicationRequest {
  applicationId: string
  type: 'publisher' | 'retailer'
  redirectUrl?: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const PRODUCTION_SITE_URL = 'https://neesh.art'

// Picks the base URL for links in the approval email. Approvals run from the
// database (admin_ops.approve_application) send no redirectUrl, so this used
// to fall through to the SITE_URL secret, which was set to a local dev
// address (http://localhost:8081) and put unusable links in real emails.
// Only public https origins are accepted; anything else falls back to prod.
const resolveSiteUrl = (...candidates: (string | undefined | null)[]): string => {
  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      const url = new URL(candidate)
      const host = url.hostname
      const isLocal = host === 'localhost' || host.endsWith('.local') ||
        /^(127\.|10\.|192\.168\.|0\.0\.0\.0)/.test(host)
      if (url.protocol === 'https:' && !isLocal) return url.origin
      console.warn(`Ignoring non-public site URL for approval email: ${url.origin}`)
    } catch {
      console.warn(`Ignoring malformed site URL for approval email: ${candidate}`)
    }
  }
  return PRODUCTION_SITE_URL
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Admin client with service role key (used for the key path and for user creation)
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

    // ============================================================
    // SECURITY: Require admin authentication.
    // Two accepted paths:
    //   1. Admin dashboard: an admin user's JWT (original path, unchanged)
    //   2. Server-side: x-admin-approval-key matching the key stored in the
    //      database vault (checked via verify_admin_approval_key), plus
    //      x-admin-reviewer-id naming an admin user. Used by the
    //      admin_ops.approve_application database function.
    // ============================================================
    let reviewerId: string | null = null
    const approvalKeyHeader = req.headers.get('x-admin-approval-key')

    if (approvalKeyHeader) {
      // The key lives in the database vault; only the service role can check it.
      const { data: keyValid, error: keyError } = await supabaseAdmin
        .rpc('verify_admin_approval_key', { p_key: approvalKeyHeader })
      if (keyError || keyValid !== true) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized - Invalid approval key' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const reviewerHeader = req.headers.get('x-admin-reviewer-id') ?? ''
      if (!UUID_RE.test(reviewerHeader)) {
        return new Response(
          JSON.stringify({ error: 'Forbidden - Missing or invalid reviewer id' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: reviewer, error: reviewerError } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', reviewerHeader)
        .single()

      if (reviewerError || !reviewer || reviewer.role !== 'admin') {
        return new Response(
          JSON.stringify({ error: 'Forbidden - Reviewer is not an admin' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      reviewerId = reviewerHeader
    } else {
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

      reviewerId = user.id
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

    // Claiming and selling are separate (claim-without-selling spec). The
    // applicant's answer to "Do you want to sell on Neesh?" decides what
    // approval creates. Applications from before the question existed all
    // went through the selling steps, so a missing answer means selling.
    const appInfo = (application.additional_info ?? {}) as Record<string, unknown>
    const wantsToSell: boolean = type !== 'publisher'
      ? true
      : typeof application.wants_to_sell === 'boolean'
        ? application.wants_to_sell
        : typeof appInfo.wantsToSell === 'boolean'
          ? appInfo.wantsToSell
          : true
    const claimOnly = type === 'publisher' && !wantsToSell
    const claimSlug = typeof appInfo.claimSlug === 'string' && appInfo.claimSlug.trim()
      ? appInfo.claimSlug.trim()
      : null

    // Claim only: mark the Index page claimed for this email first. It is
    // what gives the account edit rights (directory_owned_publisher_ids reads
    // claimed_email), and if the page is already someone else's we stop here
    // before creating an account.
    if (claimOnly) {
      const { error: claimError } = await supabaseAdmin.rpc('directory_claim_for_account', {
        p_title_slug: claimSlug,
        p_email: email,
        p_publisher_name: application.business_name || null,
        p_title_name: application.magazine_title || null,
        p_website: application.social_website_link || null,
        p_description: application.description || null,
      })
      if (claimError) {
        console.error('Could not claim the Index page:', claimError)
        return new Response(
          JSON.stringify({ error: `Could not claim the Index page: ${claimError.message}` }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    let userId = application.user_id

    // Step 1: Create auth user if they don't have one
    if (!userId) {
      const randomPassword = crypto.randomUUID()

      const { data: authData, error: authUserError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: randomPassword,
        email_confirm: true,
        // handle_new_user reads the role from app_metadata, which only the
        // service role can set; user_metadata is writable by the user.
        app_metadata: { role: type },
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
          // public.users shares ids with auth.users, so check it first. listUsers()
          // only returns the first page, which misses users once there are many.
          const { data: existingRow } = await supabaseAdmin
            .from('users')
            .select('id')
            .ilike('email', email)
            .maybeSingle()
          if (existingRow?.id) {
            userId = existingRow.id
            console.log(`Found existing user row with ID: ${userId}`)
          } else {
            // Look up existing user by email
            const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
            if (!listError && existingUsers) {
              const existingUser = existingUsers.users.find(u => u.email === email)
              if (existingUser) {
                userId = existingUser.id
                console.log(`Found existing user with ID: ${userId}`)
              }
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
      }
    }

    // Validate we have a userId at this point
    if (!userId) {
      console.error('No userId available after user lookup/creation')
      return new Response(
        JSON.stringify({ error: 'Could not resolve user identity' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Proceeding with userId: ${userId}`)

    // Step 2: Ensure user record exists (upsert for both new and existing auth users)
    const fullName = application.first_name && application.last_name
      ? `${application.first_name} ${application.last_name}`
      : application.buyer_name || email.split('@')[0]

    // Keep a username the row already has. The auth signup trigger may have
    // created the row with a de-duplicated username (e.g. "hello-7b2c"), and
    // overwriting it with the bare email prefix collides with other users who
    // share that prefix (hello@, info@, ...). New rows get the email prefix,
    // suffixed if it is already taken.
    const { data: existingUserRow } = await supabaseAdmin
      .from('users')
      .select('username')
      .eq('id', userId)
      .maybeSingle()

    let username: string | null = existingUserRow?.username ?? null
    if (!username) {
      const base = email.split('@')[0]
      const { data: takenRows } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('username', base)
        .limit(1)
      username = takenRows && takenRows.length > 0
        ? `${base}-${crypto.randomUUID().slice(0, 4)}`
        : base
    }

    const { error: userUpsertError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: userId,
        email: email,
        username: username,
        role: type,
        password_hash: 'managed_by_supabase_auth',
      }, { onConflict: 'id' })

    if (userUpsertError) {
      console.error('Error upserting user record:', userUpsertError)
      return new Response(
        JSON.stringify({ error: `Failed to create user record: ${userUpsertError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // An approved claim-only publisher applying to sell ("Start selling on
    // Neesh"). They already have an account and an Index page.
    const { data: existingPublisher } = type === 'publisher'
      ? await supabaseAdmin
          .from('publishers')
          .select('id, application_status, sells_on_neesh, sell_opt_in_at')
          .eq('user_id', userId)
          .maybeSingle()
      : { data: null }
    const isSellUpgrade = type === 'publisher' && wantsToSell &&
      existingPublisher?.application_status === 'approved' && existingPublisher?.sells_on_neesh === false

    // Step 3: Ensure profile exists (upsert for both new and existing auth users).
    // An upgrading publisher keeps their profile as it is.
    const { error: profileUpsertError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        user_id: userId,
        full_name: fullName,
        has_set_password: false,
      }, { onConflict: 'user_id', ignoreDuplicates: isSellUpgrade })

    if (profileUpsertError) {
      console.error('Error upserting profile:', profileUpsertError)
      // Non-fatal — profile is not strictly required for login
    }

    // Step 5: Create/update role-specific record
    if (type === 'publisher') {
      const { data: publisherRecord, error: upsertError } = await supabaseAdmin
        .from('publishers')
        .upsert({
          user_id: userId,
          company_name: application.business_name || application.magazine_title,
          description: application.description,
          website_url: application.social_website_link,
          instagram_handle: application.instagram_handle?.replace('@', ''),
          application_status: 'approved',
          verified: true,
          verified_at: new Date().toISOString(),
          // Selling is recorded only when they chose it. A claim-only
          // approval leaves sells_on_neesh alone: false for a new publisher
          // (the column default), unchanged for anyone already selling.
          ...(claimOnly
            ? {}
            : {
                sells_on_neesh: true,
                sell_opt_in_at: existingPublisher?.sells_on_neesh && existingPublisher?.sell_opt_in_at
                  ? existingPublisher.sell_opt_in_at
                  : new Date().toISOString(),
              }),
          // shipping_v2: where they ship from (application stores an ISO code)
          ...(!claimOnly && /^[A-Za-z]{2}$/.test(application.shipping_country ?? '')
            ? { ships_from_country: String(application.shipping_country).toUpperCase() }
            : {}),
        }, {
          onConflict: 'user_id',
        })
        .select('id')
        .single()

      if (upsertError) {
        console.error('Error creating/updating publisher:', upsertError)
        return new Response(
          JSON.stringify({ error: `Failed to create publisher record: ${upsertError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // shipping_v2: carry the ships-from address from the application into
      // the private shipping settings, so onboarding doesn't ask again. Never
      // overwrites an address the publisher already saved. Non-fatal.
      const info = (application.additional_info ?? {}) as Record<string, unknown>
      const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
      const shipsFrom = {
        name: application.business_name || application.magazine_title || '',
        line1: text(info.shipFromLine1),
        line2: text(info.shipFromLine2),
        city: text(application.shipping_city),
        state: text(application.shipping_state || info.shippingState),
        postal_code: text(info.shipFromPostalCode),
        country: /^[A-Za-z]{2}$/.test(application.shipping_country ?? '')
          ? String(application.shipping_country).toUpperCase()
          : '',
        phone: text(info.shipFromPhone),
      }
      // Claim only: no shipping settings and no magazine, so nothing can
      // reach the marketplace (the database also keeps a non-seller's
      // magazines inactive).
      if (!claimOnly && publisherRecord?.id && shipsFrom.line1 && shipsFrom.city && shipsFrom.postal_code && shipsFrom.country) {
        const { data: existingShipping } = await supabaseAdmin
          .from('publisher_shipping_settings')
          .select('ships_from_address')
          .eq('publisher_id', publisherRecord.id)
          .maybeSingle()
        if (!(existingShipping?.ships_from_address as { line1?: string } | null)?.line1) {
          const { error: shipsFromError } = await supabaseAdmin
            .from('publisher_shipping_settings')
            .upsert({ publisher_id: publisherRecord.id, ships_from_address: shipsFrom }, { onConflict: 'publisher_id' })
          if (shipsFromError) console.error('Error saving ships-from address:', shipsFromError)
        }
      }

      // Create initial magazine from application data if magazine_title exists
      if (!claimOnly && publisherRecord?.id && application.magazine_title) {
        // A title with no wholesale price can be added to a cart but not bought
        // (create-checkout rejects it), so only list it publicly once it's
        // priced. It still shows in the publisher's dashboard either way.
        const wholesalePrice = application.wholesale_price ?? null
        const { data: newMagazine, error: magError } = await supabaseAdmin
          .from('magazines')
          .insert({
            title: application.magazine_title,
            publisher_id: publisherRecord.id,
            cover_image_url: application.cover_image_url || null,
            description: application.description || null,
            issue_frequency: application.issue_frequency || null,
            publication_type: application.publication_type || null,
            wholesale_price: wholesalePrice,
            price: wholesalePrice,
            suggested_retail_price: application.suggested_retail_price ?? null,
            inventory_count: application.available_quantity ?? null,
            // Weight is collected on the application (shipping_v2) and kept in additional_info.
            weight_grams: Number(application.additional_info?.weightGrams) > 0
              ? Math.round(Number(application.additional_info.weightGrams))
              : null,
            is_active: wholesalePrice !== null,
          })
          .select('id')
          .single()

        if (magError) {
          // Don't fail the approval if magazine creation fails (e.g. duplicate)
          console.error('Error creating magazine from application:', magError)
        } else {
          console.log(`Created magazine "${application.magazine_title}" for publisher ${publisherRecord.id}`)
        }

        // Starting to sell from a claimed page: link the new magazine to the
        // Index title they already own instead of leaving it to name matching.
        if (isSellUpgrade && newMagazine?.id) {
          try {
            const { data: ownedRows } = await supabaseAdmin.rpc('directory_owned_publisher_ids', { p_user: userId })
            const ownedIds = ((ownedRows ?? []) as unknown[]).map((row) =>
              typeof row === 'string' ? row : (row as Record<string, string>).directory_owned_publisher_ids
            ).filter(Boolean)
            if (ownedIds.length > 0) {
              const { data: titles } = await supabaseAdmin
                .from('directory_titles')
                .select('id, slug, name')
                .in('publisher_id', ownedIds)
                .eq('removed', false)
              const list = (titles ?? []) as { id: string; slug: string; name: string }[]
              const key = (v: string | null | undefined) => (v ?? '').trim().toLowerCase()
              const match = list.find((t) => claimSlug && t.slug === claimSlug) ??
                list.find((t) => key(t.name) === key(application.magazine_title)) ??
                (list.length === 1 ? list[0] : undefined)
              if (match) {
                const { error: linkError } = await supabaseAdmin.rpc('directory_sync_force_link', {
                  p_mag: newMagazine.id,
                  p_title: match.id,
                })
                if (linkError) console.error('Error linking magazine to Index title:', linkError)
              } else {
                console.log('No single Index title to link; left to the Index review queue')
              }
            }
          } catch (linkErr) {
            console.error('Error linking magazine to Index title:', linkErr)
          }
        }
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
        return new Response(
          JSON.stringify({ error: `Failed to create retailer record: ${upsertError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Step 6: Update application status. Only the request that moves the
    // application to 'approved' goes on to send the welcome email: a second
    // request for the same application (a double click on Approve) updates no
    // rows here and stops, instead of minting a second password link.
    const { data: claimed, error: updateError } = await supabaseAdmin
      .from(table)
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewerId,
      })
      .eq('id', applicationId)
      .or('status.is.null,status.neq.approved')
      .select('id')

    if (updateError) {
      console.error('Error updating application status:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update application status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!claimed || claimed.length === 0) {
      console.log(`${type} application ${applicationId} was already approved; not sending another email`)
      return new Response(
        JSON.stringify({ success: true, userId, alreadyApproved: true, message: `${type} application already approved` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Successfully approved ${type} application: ${applicationId}`)

    // Step 7: Send the welcome email. We send this AFTER everything else succeeds.
    //   - claim only: "Your page is yours", a one-time sign-in link that opens
    //     their Index listing; no password.
    //   - starting to sell from a claimed page: a sign-in link to the dashboard.
    //   - everyone else: the set-password email, plus the email-link line.
    // Links point at OUR app with the token_hash as a query parameter, so
    // email clients that pre-fetch links can't use up the single-use token;
    // the app calls verifyOtp() when the person opens it.
    const siteUrl = resolveSiteUrl(redirectUrl, Deno.env.get('SITE_URL'))
    const loginUrl = `${siteUrl}/login`
    const firstName = application.first_name || application.buyer_name?.split(' ')[0] || 'there'
    const businessName = type === 'publisher'
      ? (application.business_name || application.magazine_title || 'Your Business')
      : (application.shop_name || 'Your Shop')

    const sendEmail = async (subject: string, emailHtml: string) => {
      const resendApiKey = Deno.env.get('RESEND_API_KEY')
      if (!resendApiKey) {
        console.error('RESEND_API_KEY not found, cannot send approval email')
        return
      }
      console.log(`Sending approval email to ${email}...`)
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Neesh <hi@neesh.art>',
          to: email,
          subject,
          reply_to: 'hi@neesh.art',
          html: emailHtml,
        }),
      })
      if (!resendResponse.ok) {
        console.error('Error sending approval email:', await resendResponse.json())
      } else {
        console.log('Approval email sent successfully')
      }
    }

    const signInLink = async (next: string): Promise<string | null> => {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}` },
      })
      if (linkError || !linkData?.properties?.hashed_token) {
        console.error('Error generating sign-in link:', linkError)
        return null
      }
      return `${siteUrl}/auth/callback?token_hash=${linkData.properties.hashed_token}&type=magiclink&next=${encodeURIComponent(next)}`
    }

    try {
      if (claimOnly) {
        const editPageUrl = await signInLink('/publisher/index-listing')
        if (editPageUrl) {
          const titleName = application.magazine_title || application.business_name || 'Your title'
          await sendEmail(
            EMAIL_SUBJECTS.claimApproval(titleName),
            generateClaimApprovalEmail({
              firstName,
              titleName,
              editPageUrl,
              loginUrl,
              startSellingUrl: `${siteUrl}/apply/publisher?sell=1`,
            }),
          )
        }
      } else if (isSellUpgrade) {
        const dashboardUrl = await signInLink('/publisher')
        if (dashboardUrl) {
          await sendEmail(
            EMAIL_SUBJECTS.sellApproval(businessName),
            generateSellApprovalEmail({ firstName, businessName, dashboardUrl, loginUrl }),
          )
        }
      } else {
        console.log('Generating recovery link for approval email...')
        const { data: linkData, error: recoveryLinkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email: email,
          options: {
            redirectTo: `${siteUrl}/reset-password`,
          },
        })

        if (recoveryLinkError) {
          console.error('Error generating recovery link:', recoveryLinkError)
        } else if (linkData?.properties?.hashed_token) {
          const recoveryUrl = `${siteUrl}/reset-password?token_hash=${linkData.properties.hashed_token}&type=recovery`
          await sendEmail(
            EMAIL_SUBJECTS.approval(businessName),
            generateApprovalEmail({
              firstName,
              businessName,
              role: type,
              recoveryLinkUrl: recoveryUrl,
              forgotPasswordUrl: `${siteUrl}/forgot-password`,
              loginUrl,
            }),
          )
        }
      }
    } catch (emailError) {
      console.error('Error with sign-in link / email:', emailError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        claimOnly,
        sellUpgrade: isSellUpgrade,
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
