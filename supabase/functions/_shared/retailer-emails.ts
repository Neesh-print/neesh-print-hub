// Retailer confirm-email messages: the welcome sent at signup
// (signup-retailer) and the resend from checkout (verify-retailer-email).

import { button, html, linkFallback, renderEmail, smallText, steps, strong } from './email.ts'

export interface ConfirmEmailData {
  firstName: string
  shopName: string | null
  verifyEmailUrl: string
  // true for the signup welcome, false for a resent link.
  welcome: boolean
}

export const generateConfirmEmail = (data: ConfirmEmailData): string => {
  const hi = data.firstName ? `Hi ${data.firstName}, ` : ''
  const shop = data.shopName ? html` for ${strong(data.shopName)}` : ''

  return renderEmail({
    preheader: 'One click and you can start ordering from indie publishers.',
    label: 'Account',
    eyebrow: data.welcome ? 'Welcome to Neesh' : 'Confirm your email',
    heading: 'Confirm your email to start ordering.',
    intro: data.welcome
      ? html`${hi}your account${shop} is live and the catalog is open. Confirm this address so order updates reach you, and ordering unlocks.`
      : html`${hi}confirm this address to unlock ordering${shop} on Neesh.`,
    blocks: [
      button('Confirm email', data.verifyEmailUrl),
      ...(data.welcome
        ? [
            smallText('You can browse the catalog right away. Need a fresh link? Resend one from checkout at any time.'),
            steps('What to do next', [
              'Browse the catalog of independent magazines.',
              'Order titles that fit your store.',
              'Track orders and manage your inventory.',
            ]),
          ]
        : []),
      linkFallback(data.verifyEmailUrl),
    ],
    footerNote: 'Did not sign up? You can ignore this email.',
  })
}
