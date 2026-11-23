// Automation 5 (demand-signal spec): the Monday demand rollup to Gem.
// Pure: takes rows the send-demand-rollup function already loaded and
// returns the email. Shared with the Vite tests.
//
// Requester emails and postcodes never appear in it. Postcodes are only
// turned into coarse areas (an NYC borough, or a ZIP3 like "ZIP 875xx").

import { button, details, html, link, paragraph, renderEmail, smallText, stats, subheading } from './email.ts'
import { isNycZip } from './demand-logic.ts'

export const ADMIN_DEMAND_URL = 'https://app.neesh.art/admin/demand'
const DAY = 86_400_000

export interface RollupRequest {
  title_id: string
  title_name: string
  title_state: string | null
  role: string | null
  postcode: string | null
  created_at: string
  /** City of the Neesh space the request was matched to, if any. */
  space_city?: string | null
}

export interface RollupInput {
  now: Date
  suggestionsToReview: { shop: string; city: string; title: string; confidence: string | null }[]
  draftsWaiting: { template: string; title: string | null; recipient_type: string }[]
  needsContact: string[]
  /** Stock and want-near requests from the last 30 days, any status. */
  requests: RollupRequest[]
  /** Shop suggestions from the last 30 days (their city counts as demand). */
  suggestions: { city: string; created_at: string }[]
  conversion: {
    signals: number
    publishersContacted: number
    claims: number
    nowSelling: number
    stockistsAdded: number
    requestersNotified: number
  }
}

export interface Rollup {
  empty: boolean
  subject: string
  html: string
  text: string
  shareable: string[]
}

const NYC_BOROUGH: [RegExp, string][] = [
  [/^10[0-2]/, 'Manhattan'],
  [/^103/, 'Staten Island'],
  [/^104/, 'the Bronx'],
  [/^112/, 'Brooklyn'],
  [/^11[0-46]/, 'Queens'],
]

/** A coarse, shareable place for a request: NYC borough, the matched space's city, or a ZIP3. */
export const areaFor = (postcode: string | null | undefined, spaceCity?: string | null): string => {
  const zip = /\b(\d{5})\b/.exec(postcode ?? '')?.[1]
  if (zip && isNycZip(zip)) return NYC_BOROUGH.find(([re]) => re.test(zip))?.[1] ?? 'New York'
  if (spaceCity?.trim()) return spaceCity.trim()
  if (zip) return `ZIP ${zip.slice(0, 3)}xx`
  return 'Unknown'
}

const STATE_LABEL: Record<string, string> = {
  unclaimed: 'Not claimed',
  claimed: 'Claimed, not selling',
  selling: 'Selling',
  out_of_stock: 'Out of stock',
}

const TEMPLATE_LABEL: Record<string, string> = {
  A: 'publisher, not claimed',
  B: 'publisher, claimed',
  C: 'publisher, out of stock',
  D: 'suggester thanks',
  E: 'reader, stockist nearby',
  F: 'space, now orderable',
  G: 'space, back in stock',
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

interface TitleCount {
  name: string
  state: string | null
  r7: number
  s7: number
  r30: number
  s30: number
}

export function buildRollup(input: RollupInput): Rollup {
  const now = input.now.getTime()
  const within = (iso: string, days: number) => now - new Date(iso).getTime() <= days * DAY

  // 2. Most requested titles
  const byTitle = new Map<string, TitleCount>()
  for (const r of input.requests) {
    if (!within(r.created_at, 30)) continue
    const t = byTitle.get(r.title_id) ?? { name: r.title_name, state: r.title_state, r7: 0, s7: 0, r30: 0, s30: 0 }
    const space = r.role === 'space'
    if (space) t.s30++
    else t.r30++
    if (within(r.created_at, 7)) {
      if (space) t.s7++
      else t.r7++
    }
    byTitle.set(r.title_id, t)
  }
  const topTitles = [...byTitle.values()]
    .sort((a, b) => b.r30 + b.s30 - (a.r30 + a.s30) || b.r7 + b.s7 - (a.r7 + a.s7) || a.name.localeCompare(b.name))
    .slice(0, 10)

  // 3. Demand by area
  const byArea = new Map<string, number>()
  const areaTitles = new Map<string, Map<string, number>>()
  for (const r of input.requests) {
    if (!within(r.created_at, 30)) continue
    const area = areaFor(r.postcode, r.space_city)
    byArea.set(area, (byArea.get(area) ?? 0) + 1)
    const titles = areaTitles.get(area) ?? new Map<string, number>()
    titles.set(r.title_name, (titles.get(r.title_name) ?? 0) + 1)
    areaTitles.set(area, titles)
  }
  for (const s of input.suggestions) {
    if (!within(s.created_at, 30) || !s.city.trim()) continue
    const area = s.city.trim()
    byArea.set(area, (byArea.get(area) ?? 0) + 1)
  }
  const topAreas = [...byArea.entries()]
    .filter(([a]) => a !== 'Unknown')
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)

  // 5. Shareable lines: aggregate facts only, and only when the count is 2 or more.
  const shareable: string[] = []
  const top = topTitles[0]
  if (top && top.r30 + top.s30 >= 2) {
    shareable.push(`${top.name} was the most requested magazine on the Neesh Index this month.`)
  }
  for (const [area, titles] of areaTitles) {
    if (area.startsWith('ZIP') || area === 'Unknown') continue
    const [name, n] = [...titles.entries()].sort((a, b) => b[1] - a[1])[0]
    if (n >= 2) shareable.push(`Most requested in ${area} this month: ${name}.`)
  }
  const monthRequests = input.requests.filter((r) => within(r.created_at, 30)).length
  if (monthRequests >= 3) {
    shareable.push(`${monthRequests} readers and spaces asked Neesh where to find a magazine this month.`)
  }
  if (input.conversion.stockistsAdded >= 2) {
    shareable.push(`Reader tips added ${input.conversion.stockistsAdded} new places to find magazines to the Neesh Index this month.`)
  }

  const waiting = input.suggestionsToReview.length + input.draftsWaiting.length + input.needsContact.length
  const c = input.conversion
  const conversionEmpty = Object.values(c).every((v) => !v)
  const empty = waiting === 0 && topTitles.length === 0 && topAreas.length === 0 && conversionEmpty

  const week = input.now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })
  const subject = waiting
    ? `Demand rollup: ${plural(waiting, 'thing')} waiting on you`
    : `Demand rollup, week of ${week}`

  // ---- HTML ----------------------------------------------------------------
  const blocks = []
  blocks.push(subheading('1. Waiting on you'))
  if (waiting === 0) {
    blocks.push(smallText('Nothing. The queues are clear.'))
  } else {
    const pairs: [string, string][] = []
    if (input.suggestionsToReview.length) {
      const confirmed = input.suggestionsToReview.filter((s) => s.confidence === 'confirmed').length
      pairs.push([
        'Suggestions',
        `${input.suggestionsToReview.length} to review${confirmed ? `, ${confirmed} confirmed` : ''}: ` +
          input.suggestionsToReview.slice(0, 6).map((s) => `${s.shop} (${s.city}) for ${s.title}`).join('; ') +
          (input.suggestionsToReview.length > 6 ? '; ...' : ''),
      ])
    }
    if (input.draftsWaiting.length) {
      pairs.push([
        'Email drafts',
        `${input.draftsWaiting.length} to approve: ` +
          input.draftsWaiting.slice(0, 6).map((d) => `${d.title ?? 'untitled'} (${TEMPLATE_LABEL[d.template] ?? d.template})`).join('; ') +
          (input.draftsWaiting.length > 6 ? '; ...' : ''),
      ])
    }
    if (input.needsContact.length) {
      pairs.push(['Needs contact', `No publisher email for ${input.needsContact.join(', ')}`])
    }
    blocks.push(details(pairs))
    blocks.push(button('Open the demand queue', ADMIN_DEMAND_URL))
  }

  blocks.push(subheading('2. Most requested titles'))
  if (topTitles.length === 0) {
    blocks.push(smallText('No stock requests in the last 30 days.'))
  } else {
    blocks.push(details(topTitles.map((t) => [
      t.name,
      `30 days: ${plural(t.r30, 'reader')}, ${plural(t.s30, 'space')} · 7 days: ${t.r7 + t.s7} · ${STATE_LABEL[t.state ?? ''] ?? 'Unknown'}`,
    ])))
  }

  blocks.push(subheading('3. Demand by area, last 30 days'))
  if (topAreas.length === 0) {
    blocks.push(smallText('No requests or suggestions with a location.'))
  } else {
    blocks.push(details(topAreas.map(([a, n]) => [a, plural(n, 'request')])))
    blocks.push(smallText('Requests count with suggestions. Areas are NYC boroughs, the matched space\'s city, or a ZIP prefix.'))
  }

  blocks.push(subheading('4. Conversion, last 30 days'))
  blocks.push(stats([
    { label: 'Signals', value: String(c.signals) },
    { label: 'Publishers contacted', value: String(c.publishersContacted) },
    { label: 'Claims (all)', value: String(c.claims) },
  ]))
  blocks.push(stats([
    { label: 'Now selling (all)', value: String(c.nowSelling) },
    { label: 'Stockists added', value: String(c.stockistsAdded) },
    { label: 'Requesters told', value: String(c.requestersNotified) },
  ]))

  blocks.push(subheading('5. Shareable lines'))
  blocks.push(
    shareable.length
      ? paragraph(html`${shareable.map((l, i) => html`${i ? html`<br><br>` : ''}${l}`)}`)
      : smallText('Not enough this week for a line worth posting.'),
  )

  const htmlBody = renderEmail({
    preheader: waiting ? `${plural(waiting, 'thing')} waiting on you, plus this week's demand.` : "This week's demand on the Index.",
    label: 'Admin · Demand',
    eyebrow: `Week of ${week}`,
    heading: 'Demand this week',
    intro: html`Requests, suggestions and what came of them. Reader and space details stay in the ${link('demand queue', ADMIN_DEMAND_URL)}.`,
    blocks,
    footerNote: 'Sent to Gem every Monday at 9am ET by send-demand-rollup. No email goes out on a week with nothing in it.',
  })

  // ---- Text ----------------------------------------------------------------
  const lines: string[] = ['Demand this week', '', '1. Waiting on you']
  if (waiting === 0) lines.push('Nothing. The queues are clear.')
  if (input.suggestionsToReview.length) lines.push(`- ${plural(input.suggestionsToReview.length, 'suggestion')} to review`)
  if (input.draftsWaiting.length) lines.push(`- ${plural(input.draftsWaiting.length, 'email draft')} to approve`)
  if (input.needsContact.length) lines.push(`- No publisher email: ${input.needsContact.join(', ')}`)
  if (waiting) lines.push(ADMIN_DEMAND_URL)
  lines.push('', '2. Most requested titles')
  if (!topTitles.length) lines.push('None in the last 30 days.')
  for (const t of topTitles) {
    lines.push(`- ${t.name}: ${plural(t.r30, 'reader')}, ${plural(t.s30, 'space')} in 30 days (${t.r7 + t.s7} this week), ${STATE_LABEL[t.state ?? ''] ?? 'unknown'}`)
  }
  lines.push('', '3. Demand by area, last 30 days')
  if (!topAreas.length) lines.push('None with a location.')
  for (const [a, n] of topAreas) lines.push(`- ${a}: ${n}`)
  lines.push(
    '',
    '4. Conversion, last 30 days',
    `Signals ${c.signals} · Publishers contacted ${c.publishersContacted} · Claims (all titles) ${c.claims} · Now selling (all titles) ${c.nowSelling} · Stockists added ${c.stockistsAdded} · Requesters told ${c.requestersNotified}`,
    '',
    '5. Shareable lines',
    ...(shareable.length ? shareable.map((l) => `- ${l}`) : ['Not enough this week.']),
  )

  return { empty, subject, html: htmlBody, text: lines.join('\n'), shareable }
}
