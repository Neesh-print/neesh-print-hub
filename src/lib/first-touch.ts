// First-touch attribution shared by neesh.art and app.neesh.art.
//
// The first time a browser lands on any Neesh page, we record where it came
// from (UTM tags if present, otherwise the referring site) in a cookie scoped
// to .neesh.art, so the marketing site and the app read the same value. The
// cookie is never overwritten, so an application submitted days later still
// carries the visit that started it. The same file lives in public_neesh at
// src/lib/first-touch.ts; keep the two copies identical.

export type FirstTouch = {
  source: string;
  medium: string;
  campaign: string | null;
  referrer: string | null;
  landingPage: string;
  at: string;
};

const COOKIE = 'neesh_ft';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

const clip = (value: string | null | undefined, max = 200): string | null =>
  value ? value.slice(0, max) : null;

function cookieDomain(hostname: string): string {
  return hostname === 'neesh.art' || hostname.endsWith('.neesh.art') ? '; domain=.neesh.art' : '';
}

function isNeeshHost(hostname: string): boolean {
  return hostname === 'neesh.art' || hostname.endsWith('.neesh.art');
}

export function readFirstTouch(): FirstTouch | null {
  if (typeof document === 'undefined') return null;
  try {
    const raw = document.cookie
      .split('; ')
      .find((part) => part.startsWith(`${COOKIE}=`));
    if (!raw) return null;
    return JSON.parse(decodeURIComponent(raw.slice(COOKIE.length + 1))) as FirstTouch;
  } catch {
    return null;
  }
}

/** Record this visit as the first touch unless one is already stored. */
export function captureFirstTouch(): void {
  if (typeof window === 'undefined') return;
  try {
    if (readFirstTouch()) return;

    const url = new URL(window.location.href);
    const params = url.searchParams;

    let referrerHost: string | null = null;
    if (document.referrer) {
      try {
        referrerHost = new URL(document.referrer).hostname.replace(/^www\./, '');
      } catch {
        referrerHost = null;
      }
    }
    const externalReferrer = referrerHost && !isNeeshHost(referrerHost) ? referrerHost : null;

    const utmSource = params.get('utm_source');
    const touch: FirstTouch = {
      source: clip(utmSource) ?? externalReferrer ?? '(direct)',
      medium: clip(params.get('utm_medium')) ?? (utmSource ? '(none)' : externalReferrer ? 'referral' : '(none)'),
      campaign: clip(params.get('utm_campaign')),
      referrer: clip(externalReferrer ? document.referrer : null, 300),
      landingPage: clip(`${url.hostname}${url.pathname}`, 300) ?? url.pathname,
      at: new Date().toISOString(),
    };

    document.cookie =
      `${COOKIE}=${encodeURIComponent(JSON.stringify(touch))}` +
      `; max-age=${MAX_AGE_SECONDS}; path=/; SameSite=Lax` +
      (window.location.protocol === 'https:' ? '; Secure' : '') +
      cookieDomain(url.hostname);
  } catch {
    // Attribution is best-effort; never block the page on it.
  }
}

/**
 * Answers for "How did you hear about Neesh?" on both application forms.
 * Values are stored as-is, so keep them stable once live.
 */
export const REFERRAL_SOURCES = [
  { value: 'ai_assistant', label: 'ChatGPT or another AI assistant' },
  { value: 'search', label: 'Google or another search engine' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'publisher_or_shop', label: 'A magazine or shop that uses Neesh' },
  { value: 'word_of_mouth', label: 'A friend or colleague' },
  { value: 'neesh_outreach', label: 'An email or message from Neesh' },
  { value: 'event', label: 'An event or in person' },
  { value: 'other', label: 'Somewhere else' },
] as const;
