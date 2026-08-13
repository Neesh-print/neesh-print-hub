#!/usr/bin/env node
/**
 * Generates dist/sitemap.xml at build time.
 *
 * Publisher URLs come from Supabase, queried with the publishable (anon) key so
 * the result matches exactly what an anonymous visitor can see under RLS.
 *
 * A publisher is listed only when it has at least one publicly visible title.
 * A profile with nothing to order is a dead end for a retailer and a thin page
 * for a crawler, and this rule also keeps internal, duplicate, and abandoned
 * records out without maintaining a blocklist of them. Publishers reappear on
 * their own once they list a title, because this runs on every build.
 *
 * Title URLs are not emitted yet: there is no public route for an individual
 * magazine. Add them here when that route lands.
 *
 * Fails the build if the catalog query fails, so a half-empty sitemap cannot
 * ship silently. Set SITEMAP_ALLOW_PARTIAL=1 to downgrade that to a warning.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.SITE_URL || 'https://neesh.art';
const OUT = resolve(ROOT, 'dist/sitemap.xml');
const ALLOW_PARTIAL = process.env.SITEMAP_ALLOW_PARTIAL === '1';

// Public routes served to anyone. Authenticated app routes are deliberately absent.
const STATIC_ROUTES = [
  '/',
  '/explore',
  '/publishers',
  '/retailers',
  '/pricing',
  '/faq',
  '/curatedpacks',
  '/newsletter',
];

// Publisher records that exist in the database but are not public brands.
// Anything listed here is kept out of the sitemap.
const EXCLUDE_PUBLISHER_IDS = new Set([
  '00000000-0000-0000-0000-000000000001', // neesh-imports, internal import bucket
]);

function env(name) {
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

async function publisherUrls() {
  const base = env('VITE_SUPABASE_URL');
  const key = env('VITE_SUPABASE_PUBLISHABLE_KEY');
  if (!base || !key) throw new Error('VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY is not set');

  const [publishers, magazines] = await Promise.all([
    fetchJson(`${base}/rest/v1/publishers?select=id,profile_slug,description,updated_at&profile_slug=not.is.null`, key),
    fetchJson(`${base}/rest/v1/magazines?select=publisher_id,updated_at`, key),
  ]);

  // Latest title update per publisher, used as lastmod when it beats the profile's own.
  const titleTouch = new Map();
  for (const m of magazines) {
    const prev = titleTouch.get(m.publisher_id);
    if (!prev || (m.updated_at || '') > prev) titleTouch.set(m.publisher_id, m.updated_at || '');
  }

  const urls = [];
  let skipped = 0;
  for (const p of publishers) {
    if (EXCLUDE_PUBLISHER_IDS.has(p.id) || !titleTouch.has(p.id)) {
      skipped++;
      continue;
    }
    const lastmod = [p.updated_at, titleTouch.get(p.id)].filter(Boolean).sort().pop();
    urls.push({ loc: `/p/${p.profile_slug}`, lastmod });
  }
  console.log(`  publishers: ${urls.length} listed, ${skipped} skipped (no publicly visible titles)`);
  return urls;
}

const xml = (urls) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(
      (u) =>
        `  <url>\n    <loc>${SITE}${u.loc}</loc>\n${u.lastmod ? `    <lastmod>${new Date(u.lastmod).toISOString().slice(0, 10)}</lastmod>\n` : ''}  </url>`,
    )
    .join('\n')}\n</urlset>\n`;

async function main() {
  const urls = STATIC_ROUTES.map((loc) => ({ loc }));
  try {
    urls.push(...(await publisherUrls()));
  } catch (err) {
    const msg = `sitemap: catalog query failed: ${err.message}`;
    if (!ALLOW_PARTIAL) {
      console.error(`\n${msg}\nRefusing to ship a sitemap missing publisher pages.`);
      console.error('Set SITEMAP_ALLOW_PARTIAL=1 to build anyway with static routes only.\n');
      process.exit(1);
    }
    console.warn(`${msg} (continuing with static routes only)`);
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, xml(urls));
  console.log(`  wrote dist/sitemap.xml with ${urls.length} urls`);
}

main();
