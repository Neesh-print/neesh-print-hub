import {
  type ApplicationReceivedEmailData,
  EMAIL_SUBJECTS,
  generateApplicationReceivedEmail,
} from '../_shared/application-emails.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ApplicationReceivedRequest extends ApplicationReceivedEmailData {
  email: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Parse request body
    const requestData: ApplicationReceivedRequest = await req.json()

    // Validate required fields
    if (!requestData.email || !requestData.firstName || !requestData.businessName || !requestData.role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, firstName, businessName, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(requestData.email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate role
    if (!['publisher', 'retailer'].includes(requestData.role)) {
      return new Response(
        JSON.stringify({ error: 'Role must be either "publisher" or "retailer"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Resend API key from environment
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate email HTML
    const emailHtml = generateApplicationReceivedEmail(requestData)
    const subject = requestData.claimTitle
      ? EMAIL_SUBJECTS.claimReceived(requestData.claimTitle)
      : EMAIL_SUBJECTS.applicationReceived(requestData.businessName)

    console.log(`Sending application received email to ${requestData.email}`)

    // Send email via Resend API
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Neesh <hi@neesh.art>',
        to: requestData.email,
        subject: subject,
        html: emailHtml,
        reply_to: 'hi@neesh.art',
      }),
    })

    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
      console.error('Resend API error:', resendData)
      return new Response(
        JSON.stringify({
          error: 'Failed to send email',
          details: resendData,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Application received email sent successfully:', resendData)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Application received email sent successfully',
        emailId: resendData.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in send-application-received-email function:', error)
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
