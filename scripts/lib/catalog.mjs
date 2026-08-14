/**
 * Catalog reads for build-time scripts.
 *
 * Queries Supabase with the publishable (anon) key so results match exactly what
 * an anonymous visitor can see under RLS. Anything invisible to anon is
 * invisible here, which is what keeps private rows out of the sitemap and out of
 * prerendered HTML.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// Publisher records that exist in the database but are not public brands.
const EXCLUDE_PUBLISHER_IDS = new Set([
  '00000000-0000-0000-0000-000000000001', // neesh-imports, internal import bucket
]);

export function env(name) {
  if (process.env[name]) return process.env[name];
  const dotenv = resolve(ROOT, '.env');
  if (existsSync(dotenv)) {
    const line = readFileSync(dotenv, 'utf8')
      .split('\n')
      .find((l) => l.startsWith(`${name}=`));
    if (line) return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
  }
  return undefined;
}

async function fetchJson(url, key) {
  const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

/** Titles of every magazine an anonymous visitor can see. */
export async function magazineTitles() {
  const base = env('VITE_SUPABASE_URL');
  const key = env('VITE_SUPABASE_PUBLISHABLE_KEY');
  if (!base || !key) throw new Error('VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY is not set');
  const rows = await fetchJson(`${base}/rest/v1/magazines?select=title`, key);
  return rows.map((r) => r.title).filter(Boolean);
}

/**
 * Publisher profiles worth indexing.
 *
 * A publisher is included only when it has at least one publicly visible title.
 * A profile with nothing to order is a dead end for a retailer and a thin page
 * for a crawler, and this rule also keeps internal, duplicate, and abandoned
 * records out without maintaining a blocklist. Publishers reappear on their own
 * once they list a title, because this runs on every build.
 *
 * @returns {Promise<Array<{path: string, slug: string, name: string|null, lastmod: string|undefined}>>}
 */
export async function publisherRoutes() {
  const base = env('VITE_SUPABASE_URL');
  const key = env('VITE_SUPABASE_PUBLISHABLE_KEY');
  if (!base || !key) throw new Error('VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY is not set');

  const [publishers, magazines] = await Promise.all([
    fetchJson(
      `${base}/rest/v1/publishers?select=id,profile_slug,company_name,description,updated_at&profile_slug=not.is.null`,
      key,
    ),
    fetchJson(`${base}/rest/v1/magazines?select=publisher_id,updated_at`, key),
  ]);

  // Latest title update per publisher, used as lastmod when it beats the profile's own.
  const titleTouch = new Map();
  for (const m of magazines) {
    const prev = titleTouch.get(m.publisher_id);
    if (!prev || (m.updated_at || '') > prev) titleTouch.set(m.publisher_id, m.updated_at || '');
  }

  const routes = [];
  let skipped = 0;
  for (const p of publishers) {
    if (EXCLUDE_PUBLISHER_IDS.has(p.id) || !titleTouch.has(p.id)) {
      skipped++;
      continue;
    }
    routes.push({
      path: `/p/${p.profile_slug}`,
      slug: p.profile_slug,
      name: p.company_name || null,
      description: typeof p.description === 'string' ? p.description.trim() : '',
      lastmod: [p.updated_at, titleTouch.get(p.id)].filter(Boolean).sort().pop(),
    });
  }
  routes.skipped = skipped;
  return routes;
}
