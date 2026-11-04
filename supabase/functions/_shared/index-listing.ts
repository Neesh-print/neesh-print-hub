// Validation for a publisher's edits to their Neesh Index listing (the
// index-listing edge function). No imports, so it runs in Deno and in the
// app's vitest suite.
//
// Every field the form sends replaces the stored value: an empty string or
// null clears it, except the names, which are required. Slugs are never
// editable, so renaming a title keeps its Index URL.

export const FREQUENCIES = [
  'weekly', 'monthly', 'bimonthly', 'quarterly', 'triannual', 'biannual', 'annual', 'irregular', 'evergreen',
] as const
export const STATUSES = ['active', 'dormant', 'ceased'] as const
export const MAX_OTHER_NICHES = 2
export const MAX_COVER_BYTES = 4 * 1024 * 1024

export type Frequency = (typeof FREQUENCIES)[number]
export type TitleStatus = (typeof STATUSES)[number]

export interface PublisherEdit {
  name: string
  website: string | null
  city: string | null
  country: string | null
  stockist_page_url: string | null
}

export interface TitleEdit {
  name: string
  description: string | null
  frequency: Frequency | null
  cover_price: number | null
  currency: string | null
  trim_size: string | null
  page_count: number | null
  country: string | null
  city: string | null
  status: TitleStatus
  last_issue_date: string | null
  subscribe_url: string | null
}

export interface NicheEdit {
  primary: string
  others: string[]
  identity: string[]
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

class Invalid extends Error {}

function text(raw: unknown, max: number, label: string): string | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'string' && typeof raw !== 'number') throw new Invalid(`Check the ${label}.`)
  const v = String(raw).trim()
  if (!v) return null
  if (v.length > max) throw new Invalid(`Keep the ${label} under ${max.toLocaleString('en')} characters.`)
  return v
}

function required(raw: unknown, max: number, label: string): string {
  const v = text(raw, max, label)
  if (!v) throw new Invalid(`The ${label} is required.`)
  return v
}

function url(raw: unknown, label: string): string | null {
  const v = text(raw, 500, label)
  if (!v) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error()
    if (!u.hostname.includes('.')) throw new Error()
    return u.toString()
  } catch {
    throw new Invalid(`The ${label} needs to be a web address.`)
  }
}

function country(raw: unknown): string | null {
  const v = text(raw, 2, 'country')
  if (!v) return null
  const up = v.toUpperCase()
  if (!/^[A-Z]{2}$/.test(up)) throw new Invalid('Pick a country from the list.')
  return up
}

function num(raw: unknown, label: string, min: number, max: number, integer: boolean): number | null {
  if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) return null
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
    throw new Invalid(`Check the ${label}.`)
  }
  return n
}

function oneOf<T extends string>(raw: unknown, options: readonly T[], label: string, allowNull: boolean): T | null {
  if ((raw === null || raw === undefined || raw === '') && allowNull) return null
  if (typeof raw === 'string' && (options as readonly string[]).includes(raw)) return raw as T
  throw new Invalid(`Choose a ${label} from the list.`)
}

function run<T>(fn: () => T): Result<T> {
  try {
    return { ok: true, value: fn() }
  } catch (err) {
    if (err instanceof Invalid) return { ok: false, error: err.message }
    throw err
  }
}

export function parsePublisher(input: Record<string, unknown>): Result<PublisherEdit> {
  return run(() => ({
    name: required(input.name, 200, 'publisher name'),
    website: url(input.website, 'website'),
    city: text(input.city, 100, 'city'),
    country: country(input.country),
    stockist_page_url: url(input.stockist_page_url, 'stockist list link'),
  }))
}

export function parseTitle(input: Record<string, unknown>): Result<TitleEdit> {
  return run(() => {
    const cover_price = num(input.cover_price, 'cover price', 0, 10_000, false)
    const currencyRaw = text(input.currency, 3, 'currency')
    const currency = currencyRaw ? currencyRaw.toUpperCase() : null
    if (currency && !/^[A-Z]{3}$/.test(currency)) throw new Invalid('Use a three-letter currency code, like USD.')
    if (cover_price !== null && !currency) throw new Invalid('Add the currency for the cover price.')
    const date = text(input.last_issue_date, 10, 'latest issue date')
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)))) {
      throw new Invalid('Check the latest issue date.')
    }
    return {
      name: required(input.name, 200, 'title name'),
      description: text(input.description, 3000, 'description'),
      frequency: oneOf(input.frequency, FREQUENCIES, 'frequency', true),
      cover_price,
      currency,
      trim_size: text(input.trim_size, 60, 'trim size'),
      page_count: num(input.page_count, 'page count', 1, 5000, true),
      country: country(input.country),
      city: text(input.city, 100, 'city'),
      status: oneOf(input.status, STATUSES, 'status', false) as TitleStatus,
      last_issue_date: date,
      subscribe_url: url(input.subscribe_url, 'subscription link'),
    }
  })
}

/**
 * Niches against the controlled vocabulary: one main subject niche, up to
 * two more subject niches, and any identity tags. Nothing outside the list.
 */
export function parseNiches(
  input: { primary?: unknown; others?: unknown; identity?: unknown },
  vocab: { id: string; category: string | null }[],
): Result<NicheEdit> {
  return run(() => {
    const category = new Map(vocab.map((t) => [t.id, t.category]))
    const ids = (raw: unknown): string[] => {
      if (raw === undefined || raw === null) return []
      if (!Array.isArray(raw) || !raw.every((v) => typeof v === 'string' && UUID.test(v))) {
        throw new Invalid('One of those niches is not on the list.')
      }
      return [...new Set(raw as string[])]
    }
    const primary = typeof input.primary === 'string' ? input.primary : ''
    if (category.get(primary) !== 'subject') throw new Invalid('Choose the main niche the title belongs in.')
    const others = ids(input.others).filter((id) => id !== primary)
    if (!others.every((id) => category.get(id) === 'subject')) throw new Invalid('One of those niches is not on the list.')
    if (others.length > MAX_OTHER_NICHES) throw new Invalid('Pick up to two other niches besides the main one.')
    const identity = ids(input.identity)
    if (!identity.every((id) => category.has(id) && category.get(id) !== 'subject')) {
      throw new Invalid('One of those tags is not on the list.')
    }
    return { primary, others, identity }
  })
}

/** Changed fields as { field: { from, to } }; unchanged ones are left out. */
export function diff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {}
  for (const [key, to] of Object.entries(after)) {
    const from = before[key] ?? null
    const same = Array.isArray(from) && Array.isArray(to)
      ? from.length === to.length && from.every((v, i) => v === to[i])
      : from === to || (from != null && to != null && String(from) === String(to))
    if (!same) out[key] = { from, to }
  }
  return out
}

/** JPEG, PNG or WebP, recognised by the first bytes, not the file name. */
export function imageType(bytes: Uint8Array): { ext: string; mime: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { ext: 'png', mime: 'image/png' }
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return { ext: 'webp', mime: 'image/webp' }
  return null
}
