// Shared layout for every Neesh transactional email.
//
// Built from the Neesh design system's site register: ink on paper, a band
// (#efeef6) ground, hairline borders instead of shadows, Archivo headings,
// Manrope body and IBM Plex Mono eyebrows, with the app's status pairs for
// badges. Markup is table-based with inline styles so it survives Gmail and
// Outlook; the Google Fonts link only takes effect in clients that load it,
// everything else falls back to Helvetica/Arial.
//
// No imports, so it runs in Deno edge functions and is also imported by the
// Vite app (src/lib/emailTemplates.ts) for emails the admin previews in-app.
//
// Interpolations in the `html` tag are escaped unless they are already Html,
// so user-supplied names and titles can never inject markup.

export const BRAND_URL = 'https://neesh.art'
export const SUPPORT_EMAIL = 'hi@neesh.art'
// Same operator address the newsletter footer carries.
const POSTAL_ADDRESS = 'Neesh is operated by WAU LLC, c/o Registered Agents Inc, 2355 State St STE 101, Salem, OR 97301, USA'

const C = {
  ink: '#000000',
  paper: '#ffffff',
  accent: '#7d3bbf',
  band: '#efeef6',
  border: '#d9d9d9',
  prose: '#2a2c33',
  muted: '#5c5f6b',
  muted2: '#71747f',
}

const FONT_DISPLAY = "Archivo, 'Helvetica Neue', Helvetica, Arial, sans-serif"
const FONT_BODY = "Manrope, 'Helvetica Neue', Helvetica, Arial, sans-serif"
const FONT_MONO = "'IBM Plex Mono', Menlo, Consolas, monospace"
const WIDE = "font-variation-settings: 'wdth' 114;"

export type Tone = 'success' | 'pending' | 'error' | 'neutral'

const TONES: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: '#d3fbe5', fg: '#0a7150' },
  pending: { bg: '#fdf1c4', fg: '#8a4b0d' },
  error: { bg: '#fee2e2', fg: '#b91c1c' },
  neutral: { bg: '#e5e7eb', fg: '#5c5f6b' },
}

// ---------------------------------------------------------------------------
// Escaping
// ---------------------------------------------------------------------------

export class Html {
  constructor(readonly value: string) {}
  toString() {
    return this.value
  }
}

type Interp = Html | string | number | null | undefined | false | Interp[]

export const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const interp = (v: Interp): string => {
  if (v === null || v === undefined || v === false) return ''
  if (v instanceof Html) return v.value
  if (Array.isArray(v)) return v.map(interp).join('')
  return escapeHtml(String(v))
}

export const html = (strings: TemplateStringsArray, ...values: Interp[]): Html =>
  new Html(strings.reduce((out, s, i) => out + s + (i < values.length ? interp(values[i]) : ''), ''))

// Plain text, or Html built with the `html` tag for inline bold or links.
export type Content = string | Html

export const strong = (text: string): Html =>
  html`<strong style="font-weight: 700; color: ${C.ink};">${text}</strong>`

export const link = (text: string, href: string): Html =>
  html`<a href="${href}" style="color: ${C.accent}; text-decoration: underline;">${text}</a>`

export const money = (amount: number): string => `$${amount.toFixed(2)}`

export const formatDate = (d: Date): string =>
  d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })

// ---------------------------------------------------------------------------
// Blocks. Each returns one full-width row of the card's body.
// ---------------------------------------------------------------------------

const row = (inner: Html, pad = '0 40px 24px'): Html =>
  html`<tr><td class="px" style="padding: ${pad};">${inner}</td></tr>`

const monoLabel = (text: string, color = C.muted2): Html =>
  html`<span style="font-family: ${FONT_MONO}; font-weight: 500; font-size: 11px; line-height: 16px; letter-spacing: 0.14em; text-transform: uppercase; color: ${color};">${text}</span>`

export const badge = (text: string, tone: Tone): Html => {
  const t = TONES[tone]
  return html`<span style="display: inline-block; padding: 4px 10px; border-radius: 4px; background-color: ${t.bg}; color: ${t.fg}; font-family: ${FONT_BODY}; font-size: 13px; line-height: 18px; font-weight: 600;">${text}</span>`
}

export const paragraph = (content: Content): Html =>
  row(html`<p style="margin: 0; font-family: ${FONT_BODY}; font-size: 16px; line-height: 1.55; color: ${C.prose};">${content}</p>`)

export const smallText = (content: Content): Html =>
  row(html`<p style="margin: 0; font-family: ${FONT_BODY}; font-size: 14px; line-height: 1.55; color: ${C.muted};">${content}</p>`)

export const subheading = (text: string): Html =>
  row(html`<h2 style="margin: 0; font-family: ${FONT_DISPLAY}; ${WIDE} font-weight: 700; font-size: 20px; line-height: 1.2; letter-spacing: -0.02em; color: ${C.ink};">${text}</h2>`, '8px 40px 12px')

export const button = (text: string, href: string): Html =>
  row(html`<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius: 8px; background-color: ${C.ink};"><a href="${href}" style="display: inline-block; padding: 14px 24px; border-radius: 8px; background-color: ${C.ink}; color: #ffffff; font-family: ${FONT_DISPLAY}; ${WIDE} font-weight: 600; font-size: 15px; line-height: 20px; text-decoration: none;">${text}</a></td></tr></table>`, '8px 40px 28px')

// Plain URL under a button, for clients that strip buttons.
export const linkFallback = (url: string, intro = 'Button not working? Paste this link into your browser:'): Html =>
  row(html`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-top: 20px; border-top: 1px solid ${C.border};">
    <p style="margin: 0 0 6px; font-family: ${FONT_BODY}; font-size: 13px; line-height: 1.5; color: ${C.muted};">${intro}</p>
    <a href="${url}" style="font-family: ${FONT_MONO}; font-size: 12px; line-height: 1.5; color: ${C.accent}; word-break: break-all;">${url}</a>
  </td></tr></table>`)

export interface Stat {
  label: string
  value?: string
  badge?: { text: string; tone: Tone }
}

// Two to four figures side by side in one hairline box.
export const stats = (items: Stat[]): Html => {
  const cells = items.map((s, i) => {
    const border = i < items.length - 1 ? `border-right: 1px solid ${C.border};` : ''
    const value = s.badge
      ? html`<div style="padding-top: 6px;">${badge(s.badge.text, s.badge.tone)}</div>`
      : html`<div style="padding-top: 6px; font-family: ${FONT_DISPLAY}; ${WIDE} font-weight: 700; font-size: 26px; line-height: 30px; letter-spacing: -0.02em; color: ${C.ink};">${s.value ?? ''}</div>`
    return html`<td valign="top" style="padding: 16px 18px; ${border}">${monoLabel(s.label)}${value}</td>`
  })
  return row(html`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid ${C.border}; border-radius: 8px; border-collapse: separate;"><tr>${cells}</tr></table>`, '4px 40px 28px')
}

export interface LineItem {
  title: string
  subtitle?: string
  quantity: number
  amount: number
}

// Title / Qty / Amount table with an optional total row.
export const lineItems = (
  items: LineItem[],
  opts: { amountLabel?: string; total?: { label: string; amount: number } } = {},
): Html => {
  const head = html`<tr>
    <td style="padding: 0 0 10px; border-bottom: 1px solid ${C.ink};">${monoLabel('Title', C.muted)}</td>
    <td width="56" align="center" style="padding: 0 0 10px; border-bottom: 1px solid ${C.ink};">${monoLabel('Qty', C.muted)}</td>
    <td width="96" align="right" style="padding: 0 0 10px; border-bottom: 1px solid ${C.ink};">${monoLabel(opts.amountLabel ?? 'Amount', C.muted)}</td>
  </tr>`
  const rows = items.map((it) => html`<tr>
    <td style="padding: 14px 12px 14px 0; border-bottom: 1px solid ${C.border}; font-family: ${FONT_BODY}; font-size: 15px; line-height: 1.4; font-weight: 600; color: ${C.ink};">${it.title}${it.subtitle ? html`<br><span style="font-size: 13px; font-weight: 400; color: ${C.muted2};">${it.subtitle}</span>` : ''}</td>
    <td width="56" align="center" style="padding: 14px 0; border-bottom: 1px solid ${C.border}; font-family: ${FONT_BODY}; font-size: 15px; color: ${C.prose};">${it.quantity}</td>
    <td width="96" align="right" style="padding: 14px 0; border-bottom: 1px solid ${C.border}; font-family: ${FONT_BODY}; font-size: 15px; font-weight: 600; color: ${C.ink};">${money(it.amount)}</td>
  </tr>`)
  const total = opts.total
    ? html`<tr>
        <td colspan="2" style="padding: 16px 0 0;">${monoLabel(opts.total.label, C.muted)}</td>
        <td align="right" style="padding: 16px 0 0; font-family: ${FONT_DISPLAY}; ${WIDE} font-weight: 700; font-size: 22px; letter-spacing: -0.02em; color: ${C.accent};">${money(opts.total.amount)}</td>
      </tr>`
    : ''
  return row(html`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${head}${rows}${total}</table>`, '4px 40px 28px')
}

// Numbered steps on a band panel.
export const steps = (title: string, items: Content[]): Html => {
  const rows = items.map((it, i) => html`<tr>
    <td width="32" valign="top" style="padding-top: ${i === 0 ? '0' : '12px'}; font-family: ${FONT_MONO}; font-size: 12px; line-height: 23px; color: ${C.accent};">${String(i + 1).padStart(2, '0')}</td>
    <td valign="top" style="padding-top: ${i === 0 ? '0' : '12px'}; font-family: ${FONT_BODY}; font-size: 15px; line-height: 1.5; color: ${C.prose};">${it}</td>
  </tr>`)
  return row(html`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${C.band}; border-radius: 8px;"><tr><td style="padding: 22px 24px;">
    <div style="padding-bottom: 14px;">${monoLabel(title, C.muted)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
  </td></tr></table>`, '4px 40px 28px')
}

// A band panel holding a short paragraph: help lines, terms notes.
export const panel = (content: Content, title?: string): Html =>
  row(html`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${C.band}; border-radius: 8px;"><tr><td style="padding: 20px 24px;">
    ${title ? html`<div style="padding-bottom: 10px;">${monoLabel(title, C.muted)}</div>` : ''}
    <p style="margin: 0; font-family: ${FONT_BODY}; font-size: 15px; line-height: 1.55; color: ${C.prose};">${content}</p>
  </td></tr></table>`, '4px 40px 28px')

// Label / value pairs in a mono box (alerts, invoice details).
export const details = (pairs: [string, string][]): Html => {
  const rows = pairs.map(([k, v], i) => html`<tr>
    <td valign="top" width="140" style="padding: ${i === 0 ? '0' : '8px'} 12px 0 0; font-family: ${FONT_MONO}; font-size: 11px; line-height: 20px; letter-spacing: 0.14em; text-transform: uppercase; color: ${C.muted2};">${k}</td>
    <td valign="top" style="padding: ${i === 0 ? '0' : '8px'} 0 0; font-family: ${FONT_MONO}; font-size: 13px; line-height: 20px; color: ${C.prose}; word-break: break-word; overflow-wrap: anywhere;">${v}</td>
  </tr>`)
  return row(html`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid ${C.border}; border-radius: 8px; border-collapse: separate;"><tr><td style="padding: 18px 22px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
  </td></tr></table>`, '4px 40px 28px')
}

export interface TitleRow {
  title: string
  subtitle?: string
  coverUrl?: string | null
  badge?: { text: string; tone: Tone }
  href?: string
  linkText?: string
}

// Magazine list with a 3:4 cover thumbnail (band placeholder when missing).
export const titleList = (items: TitleRow[]): Html => {
  const rows = items.map((t, i) => {
    const cover = t.coverUrl
      ? html`<img src="${t.coverUrl}" width="48" height="64" alt="" style="display: block; width: 48px; height: 64px; object-fit: cover; border-radius: 4px; background-color: ${C.band};">`
      : html`<div style="width: 48px; height: 64px; border-radius: 4px; background-color: ${C.band};"></div>`
    const top = i === 0 ? `border-top: 1px solid ${C.border};` : ''
    return html`<tr>
      <td width="64" valign="middle" style="padding: 14px 0; ${top} border-bottom: 1px solid ${C.border};">${cover}</td>
      <td valign="middle" style="padding: 14px 12px 14px 0; ${top} border-bottom: 1px solid ${C.border}; font-family: ${FONT_BODY}; font-size: 15px; line-height: 1.4;">
        <span style="font-weight: 600; color: ${C.ink};">${t.title}</span>
        ${t.subtitle ? html`<br><span style="font-size: 13px; color: ${C.muted2};">${t.subtitle}</span>` : ''}
        ${t.href ? html`<br><a href="${t.href}" style="font-size: 13px; color: ${C.accent}; text-decoration: underline;">${t.linkText ?? 'Open'}</a>` : ''}
      </td>
      <td valign="middle" align="right" style="padding: 14px 0; ${top} border-bottom: 1px solid ${C.border};">${t.badge ? badge(t.badge.text, t.badge.tone) : ''}</td>
    </tr>`
  })
  return row(html`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`, '4px 40px 28px')
}

// Small mono label over a mono value, for IDs worth keeping but not leading with.
export const reference = (label: string, value: string): Html =>
  row(html`${monoLabel(label)}<div style="padding-top: 4px; font-family: ${FONT_MONO}; font-size: 12px; line-height: 1.5; color: ${C.muted}; word-break: break-all;">${value}</div>`)

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export interface EmailOptions {
  // Inbox preview line; also shown above the card.
  preheader: string
  // Mono label at the right of the header ("Admin · Order").
  label: string
  // Accent mono line above the heading. Ignored when `badge` is set.
  eyebrow?: string
  badge?: { text: string; tone: Tone }
  heading: string
  // Lead paragraph under the heading.
  intro?: Content
  blocks: Html[]
  // Why the reader got this email. Defaults to a reply-for-help line.
  footerNote?: Content
}

export const renderEmail = (o: EmailOptions): string => {
  const kicker = o.badge
    ? badge(o.badge.text, o.badge.tone)
    : o.eyebrow
      ? monoLabel(o.eyebrow, C.accent)
      : ''
  const footerNote = o.footerNote ?? html`Questions? Reply to this email or write to ${link(SUPPORT_EMAIL, `mailto:${SUPPORT_EMAIL}`)}.`

  const doc = html`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${o.heading}</title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=IBM+Plex+Mono:wght@400;500&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  body { margin: 0; padding: 0; }
  a:hover { color: ${C.accent} !important; }
  @media (max-width: 620px) {
    .outer { padding: 24px 12px !important; }
    .px { padding-left: 24px !important; padding-right: 24px !important; }
    .h1 { font-size: 28px !important; }
  }
</style>
</head>
<body style="margin: 0; padding: 0; background-color: ${C.band};">
<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: ${C.band};">${o.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${C.band};">
<tr><td class="outer" align="center" style="padding: 40px 20px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">
    <tr><td align="center" style="padding: 0 0 16px; font-family: ${FONT_BODY}; font-size: 13px; line-height: 1.5; color: ${C.muted};">${o.preheader}</td></tr>
    <tr><td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${C.paper}; border: 1px solid ${C.border}; border-radius: 8px; border-collapse: separate;">
        <tr><td class="px" style="padding: 26px 40px; border-bottom: 1px solid ${C.border};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td valign="middle"><a href="${BRAND_URL}" style="text-decoration: none; color: ${C.ink};"><span style="font-family: Archivo, 'Arial Black', 'Helvetica Neue', Arial, sans-serif; font-variation-settings: 'wdth' 125; font-weight: 900; font-size: 22px; line-height: 22px; letter-spacing: -0.02em; color: ${C.ink};">NEESH</span><span style="display: inline-block; width: 6px; height: 6px; margin-left: 3px; vertical-align: top; background-color: ${C.ink};"></span></a></td>
            <td valign="middle" align="right">${monoLabel(o.label)}</td>
          </tr></table>
        </td></tr>
        <tr><td class="px" style="padding: 40px 40px 14px;">${kicker}</td></tr>
        <tr><td class="px" style="padding: 0 40px 16px;"><h1 class="h1" style="margin: 0; font-family: ${FONT_DISPLAY}; ${WIDE} font-weight: 800; font-size: 32px; line-height: 1.08; letter-spacing: -0.02em; color: ${C.ink};">${o.heading}</h1></td></tr>
        ${o.intro ? paragraph(o.intro) : ''}
        ${o.blocks}
        <tr><td style="padding: 16px 0 0;"></td></tr>
        <tr><td class="px" style="padding: 22px 40px; background-color: ${C.band}; border-top: 1px solid ${C.border}; border-radius: 0 0 8px 8px;">
          <p style="margin: 0 0 6px; font-family: ${FONT_BODY}; font-size: 13px; line-height: 1.5; color: ${C.muted};">${footerNote}</p>
          <p style="margin: 0 0 6px; font-family: ${FONT_MONO}; font-size: 11px; line-height: 16px; letter-spacing: 0.14em; text-transform: uppercase; color: ${C.muted};">Neesh &middot; The OS for indie print &middot; <a href="${BRAND_URL}" style="color: ${C.muted}; text-decoration: none;">neesh.art</a></p>
          <p style="margin: 0; font-family: ${FONT_BODY}; font-size: 11px; line-height: 1.5; color: ${C.muted};">${POSTAL_ADDRESS}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`
  return doc.value
}
