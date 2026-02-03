// Email templates for Neesh notifications
// These generate HTML emails that can be sent via Resend

interface ApprovalEmailData {
  firstName: string
  businessName: string
  role: 'publisher' | 'retailer'
  magicLinkUrl: string
}

interface RejectionEmailData {
  firstName: string
  businessName: string
  role: 'publisher' | 'retailer'
  reason: string
}

/**
 * Generates HTML for application approval email
 */
export const generateApprovalEmail = (data: ApprovalEmailData): string => {
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

/**
 * Generates HTML for application rejection email
 */
export const generateRejectionEmail = (data: RejectionEmailData): string => {
  const roleTitle = data.role === 'publisher' ? 'Publisher' : 'Retailer'

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Application Update</title>
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
                Application Update
              </h2>

              <p style="margin: 0 0 16px; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
                Hi ${data.firstName},
              </p>

              <p style="margin: 0 0 16px; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
                Thank you for your interest in joining Neesh with <strong>${data.businessName}</strong>.
              </p>

              <p style="margin: 0 0 24px; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
                After careful review, we're unable to approve your ${roleTitle.toLowerCase()} application at this time.
              </p>

              <!-- Reason Box -->
              <div style="margin: 24px 0; padding: 20px; background-color: #FFF9F5; border-radius: 8px; border-left: 4px solid #E8B089;">
                <p style="margin: 0 0 8px; color: #1A1A1A; font-size: 14px; font-weight: 600;">
                  Reason:
                </p>
                <p style="margin: 0; color: #4A4A4A; font-size: 15px; line-height: 1.6;">
                  ${data.reason}
                </p>
              </div>

              <!-- Divider -->
              <div style="margin: 32px 0; height: 1px; background-color: #E5E5E5;"></div>

              <!-- Next Steps -->
              <h3 style="margin: 0 0 16px; color: #1A1A1A; font-size: 18px; font-weight: 600;">
                What Can You Do?
              </h3>

              <p style="margin: 0 0 16px; color: #4A4A4A; font-size: 15px; line-height: 1.6;">
                If you believe there's been a misunderstanding or if you'd like to provide additional information, we encourage you to reach out to us.
              </p>

              <p style="margin: 0 0 24px; color: #4A4A4A; font-size: 15px; line-height: 1.6;">
                We're happy to discuss your application and explore whether Neesh might be a good fit in the future.
              </p>

              <!-- Contact Box -->
              <div style="margin-top: 32px; padding: 20px; background-color: #F8F8F6; border-radius: 8px; border-left: 4px solid #C49A6C;">
                <p style="margin: 0; color: #4A4A4A; font-size: 14px; line-height: 1.6;">
                  <strong>Questions?</strong> Reply to this email or contact us at
                  <a href="mailto:hi@neesh.art" style="color: #C49A6C; text-decoration: none;">hi@neesh.art</a>
                </p>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8F8F6; padding: 30px 40px; text-align: center; border-top: 1px solid #E5E5E5;">
              <p style="margin: 0 0 8px; color: #6B6B6B; font-size: 14px;">
                Thank you for your interest in Neesh.
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

/**
 * Default email subjects
 */
export const EMAIL_SUBJECTS = {
  approval: (businessName: string) => `Welcome to Neesh - ${businessName} Approved! 🎉`,
  rejection: (businessName: string) => `Application Update - ${businessName}`,
}
