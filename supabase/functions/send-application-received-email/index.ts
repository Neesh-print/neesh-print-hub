import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ApplicationReceivedRequest {
  email: string
  firstName: string
  businessName: string
  role: 'publisher' | 'retailer'
}

// Generate the application received email HTML
const generateApplicationReceivedEmail = (data: ApplicationReceivedRequest): string => {
  const roleTitle = data.role === 'publisher' ? 'Publisher' : 'Retailer'

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Application Received</title>
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

              <!-- Confirmation Icon -->
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; width: 64px; height: 64px; background-color: #F5F5F0; border-radius: 50%; line-height: 64px; font-size: 32px;">
                  📬
                </div>
              </div>

              <h2 style="margin: 0 0 20px; color: #1A1A1A; font-size: 24px; font-weight: 600; text-align: center;">
                We've Received Your Application!
              </h2>

              <p style="margin: 0 0 16px; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
                Hi ${data.firstName},
              </p>

              <p style="margin: 0 0 16px; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
                Thank you for applying to join Neesh as a ${roleTitle.toLowerCase()} with <strong>${data.businessName}</strong>. We're excited to learn more about you!
              </p>

              <p style="margin: 0 0 24px; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
                Our team will review your application and get back to you within <strong>2-3 business days</strong>.
              </p>

              <!-- What to Expect Box -->
              <div style="margin: 32px 0; padding: 24px; background-color: #F8F8F6; border-radius: 8px;">
                <h3 style="margin: 0 0 16px; color: #1A1A1A; font-size: 16px; font-weight: 600;">
                  What Happens Next?
                </h3>
                <ol style="margin: 0; padding-left: 20px; color: #4A4A4A; font-size: 15px; line-height: 1.8;">
                  <li style="margin-bottom: 8px;">Our team reviews your application</li>
                  <li style="margin-bottom: 8px;">We'll email you with our decision</li>
                  <li style="margin-bottom: 8px;">If approved, you'll receive a link to access your dashboard</li>
                  <li>Start ${data.role === 'publisher' ? 'selling your magazines' : 'discovering indie magazines'}!</li>
                </ol>
              </div>

              <!-- Divider -->
              <div style="margin: 32px 0; height: 1px; background-color: #E5E5E5;"></div>

              <!-- While You Wait -->
              <h3 style="margin: 0 0 16px; color: #1A1A1A; font-size: 18px; font-weight: 600;">
                While You Wait
              </h3>

              <p style="margin: 0 0 16px; color: #4A4A4A; font-size: 15px; line-height: 1.6;">
                ${data.role === 'publisher'
                  ? `Take some time to gather any additional materials you'd like to share about your publication. High-quality cover images and compelling descriptions help retailers discover your work.`
                  : `Browse our website to get a sense of the incredible indie magazines you'll soon have access to. We curate the best in independent publishing.`
                }
              </p>

              <!-- Contact Box -->
              <div style="margin-top: 32px; padding: 20px; background-color: #F8F8F6; border-radius: 8px; border-left: 4px solid #C49A6C;">
                <p style="margin: 0; color: #4A4A4A; font-size: 14px; line-height: 1.6;">
                  <strong>Questions?</strong> We're here to help. Reply to this email or reach out to us at
                  <a href="mailto:hi@neesh.art" style="color: #C49A6C; text-decoration: none;">hi@neesh.art</a>
                </p>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8F8F6; padding: 30px 40px; text-align: center; border-top: 1px solid #E5E5E5;">
              <p style="margin: 0 0 8px; color: #6B6B6B; font-size: 14px;">
                Thanks for choosing Neesh.
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
    const subject = `We've Received Your Application - ${requestData.businessName}`

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
