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
  // Claimed the page without signing up to sell: nothing about selling,
  // passwords or orders.
  claimOnly?: boolean
  // A claim-only publisher applying to sell from their dashboard.
  sellUpgrade?: boolean
}

export const generateApplicationReceivedEmail = (data: ApplicationReceivedEmailData): string => {
  const claim = data.claimTitle
  if (data.claimOnly && claim) {
    return renderEmail({
      preheader: `A person checks every claim, usually within a day. We will email you when ${claim} is yours.`,
      label: 'Claim',
      eyebrow: 'Claim received',
      heading: `We got your claim for ${claim}.`,
      intro: html`Hi ${data.firstName}, thanks for claiming ${strong(claim)} on the Neesh Index. A person checks every claim, usually within a day.`,
      blocks: [
        steps('What happens next', [
          'We check the title is yours.',
          'We email you a link to edit your page. No password needed.',
          'Keep your page and issues up to date, and see who is looking.',
        ]),
        panel(
          'Claiming is free and does not sign you up to sell. If you want shops, cafés and hotels to order copies from you, you can start selling any time from your dashboard.',
          'Selling is separate',
        ),
        smallText('If you would rather the page came down instead of being claimed, reply and it is gone today.'),
      ],
    })
  }
  if (data.sellUpgrade) {
    return renderEmail({
      preheader: 'We review selling applications within 2-3 business days and will email you our decision.',
      label: 'Application',
      eyebrow: 'Application received',
      heading: 'We have your selling application.',
      intro: html`Hi ${data.firstName}, thanks for applying to sell ${strong(data.businessName)} on Neesh. Our team will review it and get back to you within ${strong('2-3 business days')}. Your Index page stays as it is in the meantime.`,
      blocks: [
        steps('What happens next', [
          'Our team reviews your pricing and fulfillment details.',
          'We email you with our decision.',
          'If approved, you connect Stripe from your dashboard and start taking orders.',
        ]),
      ],
    })
  }
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
  // The login page, where "Email me a sign-in link" lives.
  loginUrl?: string
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
      ...(data.loginUrl
        ? [smallText(html`You can also sign in any time with only your email: choose ${strong('Email me a sign-in link')} on the ${link('login page', data.loginUrl)}.`)]
        : []),
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

export interface ClaimApprovalEmailData {
  firstName: string
  titleName: string
  // Magic link that signs them in and opens their Index listing.
  editPageUrl: string
  loginUrl: string
  startSellingUrl: string
}

// Claim-only approval. No password to set: the button is a one-time sign-in
// link, and they can get another from the login page with only their email.
export const generateClaimApprovalEmail = (data: ClaimApprovalEmailData): string =>
  renderEmail({
    preheader: `${data.titleName} is yours on the Neesh Index. Edit your page with one click.`,
    label: 'Claim',
    badge: { text: 'Approved', tone: 'success' },
    heading: 'Your page is yours.',
    intro: html`Hi ${data.firstName}, your claim for ${strong(data.titleName)} is approved. The page on the Neesh Index is now yours to edit and keep up to date.`,
    blocks: [
      button('Edit your page', data.editPageUrl),
      smallText(html`This button signs you in and works once, for an hour. There is no password to set: sign in any time with only your email by choosing ${strong('Email me a sign-in link')} on the ${link('login page', data.loginUrl)}.`),
      steps('What you can do', [
        'Edit your description, cover and links.',
        'Keep your issues up to date.',
        'See who is looking at your page.',
      ]),
      panel(
        html`Claiming does not sign you up to sell. If you want shops, cafés and hotels to order copies from you at your wholesale price, ${link('start selling on Neesh', data.startSellingUrl)} whenever you like. Neesh takes 10% of wholesale on each order.`,
        'Selling is there if you want it',
      ),
      linkFallback(data.editPageUrl),
    ],
  })

export interface SellApprovalEmailData {
  firstName: string
  businessName: string
  // Magic link that signs them in and opens the dashboard.
  dashboardUrl: string
  loginUrl: string
}

// A claim-only publisher approved to sell. They already have an account, so
// no password step: the button signs them in.
export const generateSellApprovalEmail = (data: SellApprovalEmailData): string =>
  renderEmail({
    preheader: `${data.businessName} can now sell on Neesh. Connect Stripe to start taking orders.`,
    label: 'Application',
    badge: { text: 'Approved', tone: 'success' },
    heading: `You can now sell on Neesh, ${data.firstName}.`,
    intro: html`Your selling application for ${strong(data.businessName)} is approved. Connect Stripe from your dashboard and your titles go live for shops, cafés and hotels to order.`,
    blocks: [
      button('Open your dashboard', data.dashboardUrl),
      smallText(html`This button signs you in and works once, for an hour. Sign in any time with only your email from the ${link('login page', data.loginUrl)}.`),
      steps('What to do next', [
        'Connect Stripe so we can pay you for orders.',
        'Check your wholesale price and stock.',
        'Start receiving orders.',
      ]),
      linkFallback(data.dashboardUrl),
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
  claimApproval: (titleName: string) => `Your page is yours: ${titleName} on the Neesh Index`,
  sellApproval: (businessName: string) => `${businessName} can now sell on Neesh`,
  sellApplicationReceived: (businessName: string) => `We received your selling application for ${businessName}`,
}
