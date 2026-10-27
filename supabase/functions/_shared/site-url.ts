// Base URL for links in emails that name a caller-supplied redirectUrl.
// Only Neesh origins (and localhost, for development) are accepted: an open
// redirectUrl would let anyone have hi@neesh.art email a link to their own
// site. Anything else falls back to the SITE_URL secret if it is a public
// Neesh origin (it has been set to a local dev address before), then
// production.

export const PRODUCTION_SITE_URL = 'https://neesh.art'

const ALLOWED_HOSTS = new Set(['neesh.art', 'www.neesh.art', 'app.neesh.art'])

export const isAllowedSiteOrigin = (candidate: string, { allowLocal = true } = {}): boolean => {
  try {
    const url = new URL(candidate)
    if (url.protocol === 'https:' && ALLOWED_HOSTS.has(url.hostname)) return true
    return allowLocal && url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  } catch {
    return false
  }
}

export const resolveEmailSiteUrl = (
  requested: string | undefined | null,
  fallback: string | null | undefined = Deno.env.get('SITE_URL'),
): string => {
  if (requested && isAllowedSiteOrigin(requested)) return new URL(requested).origin
  if (requested) console.warn(`Ignoring redirectUrl outside the allowlist: ${requested.slice(0, 200)}`)
  if (fallback && isAllowedSiteOrigin(fallback, { allowLocal: false })) return new URL(fallback).origin
  return PRODUCTION_SITE_URL
}
