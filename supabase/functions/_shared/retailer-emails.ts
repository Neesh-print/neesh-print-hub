// Retailer emails: the confirm-email welcome sent at signup (signup-retailer)
// and its resend (verify-retailer-email), and the order confirmation sent
// after a paid checkout (stripe-webhook). Neesh is upfront payment only.

import {
  BRAND_URL,
  type LineItem,
  button,
  details,
  html,
  lineItems,
  linkFallback,
  money,
  renderEmail,
  smallText,
  steps,
  strong,
} from './email.ts'

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

export interface ShippingAddress {
  name?: string | null
  line1?: string | null
  line2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
}

export interface OrderConfirmationData {
  shopName: string | null
  // Retailer prices; subtitle is the publisher.
  lines: LineItem[]
  subtotal: number
  tax: number
  total: number
  shipTo: ShippingAddress | null
}

const formatAddress = (a: ShippingAddress): string =>
  [
    a.name,
    a.line1,
    a.line2,
    [[a.city, a.state].filter(Boolean).join(', '), a.postalCode].filter(Boolean).join(' '),
    a.country,
  ].filter(Boolean).join(', ')

export const generateOrderConfirmationEmail = (data: OrderConfirmationData): string => {
  const copies = data.lines.reduce((s, l) => s + l.quantity, 0)
  const copiesText = `${copies} ${copies === 1 ? 'copy' : 'copies'}`
  const publishers = new Set(data.lines.map((l) => l.subtitle).filter(Boolean)).size
  const fromText = publishers === 1 ? 'the publisher' : `${publishers} publishers`

  const summary: [string, string][] = []
  if (data.tax > 0) summary.push(['Subtotal', money(data.subtotal)], ['Tax', money(data.tax)])
  summary.push(['Total paid', money(data.total)])
  if (data.shipTo) summary.push(['Ship to', formatAddress(data.shipTo)])

  return renderEmail({
    preheader: `${copiesText} for ${money(data.total)}. Publishers ship directly and add tracking.`,
    label: 'Order',
    badge: { text: 'Paid', tone: 'success' },
    heading: 'Your order is in.',
    intro: html`${data.shopName ? html`Thanks, ${strong(data.shopName)}. ` : 'Thanks. '}We sent your order to ${fromText}. Each one ships directly to you and adds tracking as it goes out.`,
    blocks: [
      lineItems(data.lines),
      details(summary),
      steps('What happens next', [
        `${publishers === 1 ? 'The publisher packs' : 'Each publisher packs'} your copies and ships them.`,
        'Tracking appears on the order as soon as it is added.',
        'Something wrong with a delivery? Reply to this email.',
      ]),
      button('View your orders', `${BRAND_URL}/retailer/orders`),
    ],
    footerNote: 'You are getting this because you placed an order on Neesh.',
  })
}
