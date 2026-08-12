/**
 * Normalizes the retailer signup "Website" field, which accepts either a
 * website URL or an Instagram handle, into a full URL for `shop_url`.
 */
export function normalizeWeb(raw: string): string {
  const s = raw.trim();
  if (s.startsWith("@")) return `https://instagram.com/${s.slice(1)}`;
  if (!s.includes(".")) return `https://instagram.com/${s.replace(/^\/+/, "")}`;
  if (!/^https?:\/\//i.test(s)) return `https://${s}`;
  return s;
}
