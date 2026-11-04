/**
 * Normalizes the optional "Subscription link" on the publisher application.
 * Blank stays blank, a bare domain gets https:// in front, and anything that
 * already names a scheme is left alone so validation can reject non-http(s)
 * links. The result is copied onto directory_titles.subscribe_url, whose
 * check constraint only allows null or ^https?://.
 */
export function normalizeSubscribeUrl(raw: string | undefined | null): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return s;
  return `https://${s.replace(/^\/+/, "")}`;
}

/** True when the value is blank or an http(s) URL with a dotted host. */
export function isValidSubscribeUrl(raw: string | undefined | null): boolean {
  const s = normalizeSubscribeUrl(raw);
  if (!s) return true;
  return /^https?:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::\d+)?(?:[/?#]\S*)?$/i.test(s);
}
