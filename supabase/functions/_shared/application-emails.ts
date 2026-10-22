// Application lifecycle emails: received, approved, rejected.
//
// Used by the send-application-received-email and approve-application edge
// functions, and by the admin app (src/lib/emailTemplates.ts), which previews
// the approval and rejection emails before sending them through send-email.

import {
  SUPPORT_EMAIL,
  button,
  html,
  link,
  linkFallback,
  panel,
  renderEmail,
  smallText,
  steps,
  strong,
} from './email.ts'

type Role = 'publisher' | 'retailer'

export interface ApplicationReceivedEmailData {
  firstName: string
  businessName: string
  role: Role
  // Present when the application started from "Claim this profile" on the
  // public index; switches the email to the claim-received wording.
  claimTitle?: string
}

export const generateApplicationReceivedEmail = (data: ApplicationReceivedEmailData): string => {
  const claim = data.claimTitle
  return renderEmail({
    preheader: claim
      ? `A person reviews claims, usually within a day. We will email you when ${claim} is live.`
      : 'We review applications within 2-3 business days and will email you our decision.',
    label: claim ? 'Claim' : 'Application',
    eyebrow: claim ? 'Claim received' : 'Application received',
    heading: claim ? `We got your claim for ${claim}.` : 'We have your application.',
    intro: claim
      ? html`Hi ${data.firstName}, thanks for claiming ${strong(claim)}. A person reviews these, usually within a day. We will email you when it is live.`
      : html`Hi ${data.firstName}, thanks for applying to join Neesh as a ${data.role} with ${strong(data.businessName)}. Our team will review it and get back to you within ${strong('2-3 business days')}.`,
    blocks: [
      ...(claim
        ? [smallText('If you would rather the page came down instead of being claimed, reply and it is gone today.')]
        : []),
      steps('What happens next', [
        `Our team reviews your ${claim ? 'claim' : 'application'}.`,
        'We email you with our decision.',
        'If approved, you get a link to set your password and open your dashboard.',
        data.role === 'publisher' ? 'Start selling your magazines to stores.' : 'Start ordering indie magazines for your store.',
      ]),
      panel(
        data.role === 'publisher'
          ? 'Gather anything else you would like to share about your publication. Good cover images and clear descriptions help retailers discover your work.'
          : 'Browse neesh.art to get a sense of the independent magazines you will soon be able to order.',
        'While you wait',
      ),
    ],
  })
}

export interface ApprovalEmailData {
  firstName: string
  businessName: string
  role: Role
  recoveryLinkUrl: string
  forgotPasswordUrl: string
}

export const generateApprovalEmail = (data: ApprovalEmailData): string =>
  renderEmail({
    preheader: `${data.businessName} is approved. Set your password to open your ${data.role} dashboard.`,
    label: 'Application',
    badge: { text: 'Approved', tone: 'success' },
    heading: `Welcome to Neesh, ${data.firstName}.`,
    intro: html`Your application for ${strong(data.businessName)} has been approved. We have created your account: set your password to open your ${data.role} dashboard.`,
    blocks: [
      button('Set your password', data.recoveryLinkUrl),
      smallText(html`This link expires in 24 hours. Expired? ${link('Request a new one', data.forgotPasswordUrl)}.`),
      steps(
        'What to do next',
        data.role === 'publisher'
          ? [
              'Add your magazine titles to the catalog.',
              'Set up payouts so we can pay you for orders.',
              'Start receiving orders from retailers.',
              'Track your sales and earnings.',
            ]
          : [
              'Browse the catalog of independent magazines.',
              'Add titles to your wishlist.',
              'Place your first order.',
              'Track shipments and manage inventory.',
            ],
      ),
      linkFallback(data.recoveryLinkUrl),
    ],
  })

export interface RejectionEmailData {
  firstName: string
  businessName: string
  role: Role
  reason: string
}

export const generateRejectionEmail = (data: RejectionEmailData): string =>
  renderEmail({
    preheader: `An update on your ${data.role} application for ${data.businessName}.`,
    label: 'Application',
    eyebrow: 'Application update',
    heading: 'We cannot approve your application right now.',
    intro: html`Hi ${data.firstName}, thank you for applying to join Neesh with ${strong(data.businessName)}. After review, we are unable to approve your ${data.role} application at this time.`,
    blocks: [
      panel(data.reason, 'Reason'),
      smallText(html`If something was misunderstood, or you would like to share more, reply to this email or write to ${link(SUPPORT_EMAIL, `mailto:${SUPPORT_EMAIL}`)}. We are happy to talk it through and look again in the future.`),
    ],
  })

export const EMAIL_SUBJECTS = {
  approval: (businessName: string) => `Welcome to Neesh: ${businessName} is approved`,
  rejection: (businessName: string) => `Application update for ${businessName}`,
  applicationReceived: (businessName: string) => `We received your application for ${businessName}`,
  claimReceived: (claimTitle: string) => `We got your claim for ${claimTitle}`,
}
