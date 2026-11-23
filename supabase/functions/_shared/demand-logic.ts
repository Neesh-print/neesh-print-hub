// Pure rules for the demand-signal automations (spec: Demand-signal
// automations, Automations 1 and 2). No imports, so the Deno edge functions
// and the Vite tests share one copy.

// ---------------------------------------------------------------------------
// Automation 1: shop suggestions
// ---------------------------------------------------------------------------

/** Same normalisation as directory_stores.match_key: lowercase letters and digits only. */
export const matchKey = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

const LEADING_ARTICLE = /^(the|la|le|les|el|il|der|die|das)(?=[a-z0-9]{3,})/

/** True when two shop names are the same shop, allowing "The", extra words, small typos. */
export const sameShop = (a: string, b: string): boolean => {
  const x = matchKey(a).replace(LEADING_ARTICLE, '')
  const y = matchKey(b).replace(LEADING_ARTICLE, '')
  if (!x || !y) return false
  if (x === y) return true
  const [short, long] = x.length <= y.length ? [x, y] : [y, x]
  if (short.length >= 5 && long.startsWith(short)) return true
  return short.length >= 6 && editDistance(x, y) <= 1
}

export const sameCity = (a: string | null | undefined, b: string | null | undefined): boolean =>
  !!a && !!b && matchKey(a) === matchKey(b)

const editDistance = (a: string, b: string): number => {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

/** Why a shop name is junk, or null when it looks like a real name. */
export const spamReason = (shopName: string, city: string): string | null => {
  const name = shopName.trim()
  if (name.length < 2) return 'empty name'
  if (!/\p{L}/u.test(name)) return 'no letters in name'
  if (/https?:\/\/|www\.|\.(com|net|org|io|xyz|ru|shop|store)\b/i.test(name)) return 'URL in name'
  if (/(.)\1{5,}/.test(name)) return 'repeated characters'
  if (name.length > 120) return 'name too long'
  if (!city.trim() || /https?:\/\//i.test(city)) return 'bad city'
  return null
}

export const SPAM_IP_LIMIT = 10

/** Collapse a page's HTML to lowercase visible-ish text. */
export const pageText = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Where the title's name appears in the text, as a short snippet, or null.
 * Matches on word boundaries so "Slanted" does not hit "slanted roof" only
 * by luck of a substring like "Unslanted".
 */
export const findTitle = (text: string, title: string): string | null => {
  const t = title.trim()
  if (t.length < 3) return null
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
  const m = new RegExp(`(^|[^\\p{L}\\p{N}])(${esc})(?=$|[^\\p{L}\\p{N}])`, 'iu').exec(text)
  if (!m) return null
  const at = m.index + m[1].length
  return text.slice(Math.max(0, at - 80), Math.min(text.length, at + t.length + 80)).trim()
}

export type Confidence = 'confirmed' | 'likely' | 'unverified'

export const confidenceFor = (shopMatched: boolean, titleFound: boolean): Confidence =>
  !shopMatched ? 'unverified' : titleFound ? 'confirmed' : 'likely'

// ---------------------------------------------------------------------------
// Automation 2: publisher demand emails
// ---------------------------------------------------------------------------

export type TitleState = 'unclaimed' | 'claimed' | 'selling' | 'out_of_stock'
export type PublisherTemplate = 'A' | 'B' | 'C'

export interface TitleDemand {
  title_id: string
  title_name: string
  title_slug: string
  publisher_id: string | null
  publisher_name?: string | null
  title_state: TitleState
  publisher_email: string | null
  do_not_contact: boolean
  distributor_exclusive: boolean
  open_reader_30d: number
  open_space_30d: number
  reader_30d: number
  space_30d: number
  postcodes_90d: string[] | null
  publisher_outreach_count: number
  publisher_last_emailed_at: string | null
}

export const DEMAND_RULES = {
  minReaders: 2,
  minSpaces: 1,
  publisherCap: 2,
  quietDays: 45,
}

export type DraftDecision =
  | { action: 'draft'; template: PublisherTemplate }
  | { action: 'skip'; reason: string }
  | { action: 'needs_contact' }

/** What Automation 2 does with one title from v_title_demand. */
export const decideDraft = (
  d: TitleDemand,
  opts: { now: Date; publisherHasPending: boolean; recipientSent: number },
): DraftDecision => {
  const readers = Number(d.open_reader_30d) || 0
  const spaces = Number(d.open_space_30d) || 0
  if (readers < DEMAND_RULES.minReaders && spaces < DEMAND_RULES.minSpaces) {
    return { action: 'skip', reason: 'below threshold' }
  }
  if (d.title_state === 'selling') return { action: 'skip', reason: 'selling and in stock' }
  if (d.do_not_contact) return { action: 'skip', reason: 'do not contact' }
  if (d.distributor_exclusive) return { action: 'skip', reason: 'distributor exclusive' }

  let template: PublisherTemplate
  if (d.title_state === 'unclaimed') template = 'A'
  else if (d.title_state === 'out_of_stock') template = 'C'
  else if (spaces >= DEMAND_RULES.minSpaces) template = 'B'
  else return { action: 'skip', reason: 'claimed, reader demand only (rollup)' }

  if (!d.publisher_email) return { action: 'needs_contact' }
  if ((Number(d.publisher_outreach_count) || 0) >= DEMAND_RULES.publisherCap) {
    return { action: 'skip', reason: 'publisher cap reached' }
  }
  if (opts.recipientSent >= DEMAND_RULES.publisherCap) return { action: 'skip', reason: 'recipient cap reached' }
  if (opts.publisherHasPending) return { action: 'skip', reason: 'draft already waiting' }
  if (d.publisher_last_emailed_at) {
    const days = (opts.now.getTime() - new Date(d.publisher_last_emailed_at).getTime()) / 86_400_000
    if (days < DEMAND_RULES.quietDays) return { action: 'skip', reason: 'emailed in the last 45 days' }
  }
  return { action: 'draft', template }
}

// NYC ZIP prefixes: Manhattan 100-102, Staten Island 103, Bronx 104,
// Queens 110, 111, 113, 114, 116, Brooklyn 112.
const NYC_ZIP = /^(10[0-4]|11[0-46])\d{2}$/
const US_ZIP = /^\d{5}(-\d{4})?$/

/** " in New York", " in the US", or "" when the postcodes say nothing safe. */
export const placePhrase = (postcodes: string[] | null | undefined): string => {
  const codes = (postcodes ?? []).map((p) => p.trim()).filter(Boolean)
  if (codes.length === 0) return ''
  if (codes.every((p) => NYC_ZIP.test(p))) return ' in New York'
  if (codes.every((p) => US_ZIP.test(p))) return ' in the US'
  return ''
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const who = (readers: number, spaces: number): { text: string; one: boolean } => {
  if (spaces === 0) return { text: plural(readers, 'reader', 'readers'), one: readers === 1 }
  if (readers === 0) return { text: plural(spaces, 'space', 'spaces'), one: spaces === 1 }
  return { text: `${readers + spaces} readers and spaces`, one: false }
}

export const APP_URL = 'https://app.neesh.art'

export const withUtm = (url: string, template: string): string => {
  const u = new URL(url)
  u.searchParams.set('utm_source', 'email')
  u.searchParams.set('utm_medium', 'outreach')
  u.searchParams.set('utm_campaign', 'demand')
  u.searchParams.set('utm_content', template)
  return u.toString()
}

export interface DraftEmail {
  subject: string
  body: string
}

/**
 * Plain-text copy for templates A, B and C, word for word from the spec.
 * Never names a space, never mentions space-side pricing, always offers a
 * distributor exit in A and B, and uses no em dashes.
 */
export const publisherDraft = (template: PublisherTemplate, d: TitleDemand): DraftEmail => {
  const title = d.title_name.trim()
  const readers = Number(d.open_reader_30d) || 0
  const spaces = Number(d.open_space_30d) || 0
  const where = placePhrase(d.postcodes_90d)

  if (template === 'A') {
    const claim = new URL(`${APP_URL}/apply/publisher`)
    claim.searchParams.set('title', title)
    claim.searchParams.set('claim', d.title_slug)
    if (d.publisher_name) claim.searchParams.set('publisher', d.publisher_name)
    const w = who(readers, spaces)
    return {
      subject: `Readers are asking where to find ${title}`,
      body: [
        `${w.text}${where} asked where they can buy ${title} in person this month.`,
        `${title} already has a page on the Neesh Index, the database of independent magazines readers use to find titles and the spaces that stock them. Claiming it takes about four minutes, the basics are already filled in, and it's free.`,
        withUtm(claim.toString(), 'A'),
        `If ${title} goes through a distributor, just tell me who and I'll point people there.`,
        'Gem',
      ].join('\n\n'),
    }
  }

  if (template === 'B') {
    const opening = spaces === 1
      ? `A space${where} wants to order ${title} directly from you.`
      : `${spaces} spaces${where} want to order ${title} directly from you.`
    return {
      subject: spaces === 1
        ? `A new stockist wants to order ${title} directly`
        : `New stockists want to order ${title} directly`,
      body: [
        opening,
        `You can take the order on Neesh. Set your price and quantity, they pay at checkout, you ship. Neesh takes 10%, no lock-in, no other fees.`,
        withUtm(`${APP_URL}/apply/publisher?sell=1`, 'B'),
        `If a distributor handles your orders, send me their details and I'll pass the request along.`,
        'Gem',
      ].join('\n\n'),
    }
  }

  const total = Math.max(readers + spaces, Number(d.reader_30d) + Number(d.space_30d) || 0)
  return {
    subject: `${title} is sold out on Neesh, and people are asking`,
    body: [
      `${total} ${total === 1 ? 'person' : 'spaces and readers'} asked for ${title} in the last 30 days, and it's showing as out of stock.`,
      `If you have copies, updating your inventory puts it back in front of them. If a new issue is coming, add it and we'll let them know.`,
      withUtm(`${APP_URL}/publisher/titles`, 'C'),
      'Gem',
    ].join('\n\n'),
  }
}

/** Request roles each template counts, for linking demand_signal_ids. */
export const rolesFor = (template: PublisherTemplate): string[] =>
  template === 'B' ? ['space'] : ['reader', 'space']

// ---------------------------------------------------------------------------
// Automation 3: close the loop with requesters (templates D, E, F, G)
// ---------------------------------------------------------------------------

export type RequesterTemplate = 'D' | 'E' | 'F' | 'G'
export const INDEX_URL = 'https://neesh.art'
export const REQUESTER_CAP = 2
export const STALE_DAYS = 120

/** Plain-text copy for D to G, word for word from the spec, signed "Neesh". */
export const requesterDraft = (
  template: RequesterTemplate,
  v: { title: string; titleSlug?: string; shop?: string; city?: string | null; area?: string | null; storeSlug?: string; magazineId?: string; qty?: number },
): DraftEmail => {
  const title = v.title.trim()
  switch (template) {
    case 'D':
      return {
        subject: `${v.shop} is now on the Neesh Index for ${title}`,
        body: [
          `Thanks for the tip. ${v.shop}${v.city ? ` in ${v.city}` : ''} now shows up as a place to find ${title}.`,
          withUtm(`${INDEX_URL}/titles/${v.titleSlug}`, 'D'),
          'Neesh',
        ].join('\n\n'),
      }
    case 'E':
      return {
        subject: `${title} is at a shop near you`,
        body: [
          `You asked where to find ${title} in person. ${v.shop}${v.area ? ` in ${v.area}` : ''} has it.`,
          withUtm(`${INDEX_URL}/stores/${v.storeSlug}`, 'E'),
          'Neesh',
        ].join('\n\n'),
      }
    case 'F':
      return {
        subject: `You can order ${title} on Neesh now`,
        body: [
          `You asked about ${title}. The publisher is now taking orders directly on Neesh.`,
          withUtm(`${APP_URL}/retailer/catalogue/${v.magazineId}`, 'F'),
          'Neesh',
        ].join('\n\n'),
      }
    case 'G':
      return {
        subject: `${title} is back in stock`,
        body: [
          `${title} is back in stock on Neesh, ${v.qty} ${v.qty === 1 ? 'copy' : 'copies'} available.`,
          withUtm(`${APP_URL}/retailer/catalogue/${v.magazineId}`, 'G'),
          'Neesh',
        ].join('\n\n'),
      }
  }
}

/** The one-line unsubscribe added under every reader and space email at send time. */
export const unsubscribeLine = (url: string): string => `Don't want these emails? Unsubscribe: ${url}`

const zip5 = (s: string | null | undefined): string | null => {
  const m = /\b(\d{5})(?:-\d{4})?\b/.exec(s ?? '')
  return m ? m[1] : null
}

export const isNycZip = (zip: string | null | undefined): boolean => !!zip && NYC_ZIP.test(zip.trim().slice(0, 5))

/**
 * Is this store near the reader's postcode? Stores have no coordinates
 * (spec, known gaps), so v1 says yes when both are in New York City, or
 * when the store's address carries a ZIP with the same first three digits
 * (one USPS sectional center, roughly a metro area).
 */
export const storeNearPostcode = (
  postcode: string | null | undefined,
  store: { city: string | null; country: string; address: string | null },
): boolean => {
  const reader = zip5(postcode)
  if (!reader || store.country !== 'US') return false
  if (isNycZip(reader) && (store.city === 'New York' || isNycZip(zip5(store.address)))) return true
  const storeZip = zip5(store.address)
  return !!storeZip && storeZip.slice(0, 3) === reader.slice(0, 3)
}

// ---------------------------------------------------------------------------
// Automation 4: route space requests
// ---------------------------------------------------------------------------

// Mailbox providers: a match on these domains says nothing about the space.
const GENERIC_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'hey.com',
  'fastmail.com', 'gmx.com', 'mail.com', 'yandex.com', 'zoho.com', 'comcast.net', 'verizon.net',
])

/** The space's own domain from an email, or null for mailbox providers. */
export const businessDomain = (email: string | null | undefined): string | null => {
  const d = email?.split('@')[1]?.trim().toLowerCase()
  if (!d || !/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(d) || GENERIC_DOMAINS.has(d)) return null
  return d
}

/** Bare host of a URL, without www. */
export const hostOf = (url: string | null | undefined): string | null => {
  if (!url) return null
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

/** "flowersforsantafe.com" -> "flowersforsantafe", for a Places text search. */
export const domainStem = (domain: string): string => domain.replace(/\.(com|net|org|co|shop|store|studio|nyc|us)(\.[a-z]{2})?$/, '')

const SEGMENT_TYPES: [string, RegExp][] = [
  ['Wait', /hair|barber|nail|beauty|spa|dent|doctor|clinic|salon|tattoo/],
  ['Taste', /hotel|lodging|cowork|office|agency|studio|architect/],
  ['Catalog', /book|library|museum|newsstand|record|music_store|grocery/],
  ['Presence', /cafe|coffee|bar|bakery|restaurant|wine|tea|food|club/],
  ['Dwell', /clothing|boutique|home_goods|furniture|gallery|florist|gift|store|shop/],
]

/** ICP segment from Google place types, or null when nothing fits. */
export const inferSegment = (types: string[] | null | undefined): string | null => {
  const joined = (types ?? []).join(' ').toLowerCase()
  if (!joined) return null
  for (const [segment, re] of SEGMENT_TYPES) if (re.test(joined)) return segment
  return null
}
