#!/usr/bin/env node
/**
 * Generates dist/sitemap.xml at build time.
 *
 * Static paths come from the public route table, publisher paths from the
 * catalog. Both are shared with the prerender step and the crawlability check,
 * so the sitemap cannot drift from what is actually rendered.
 *
 * Title URLs are not emitted yet: there is no public route for an individual
 * magazine. They appear here automatically once that route exists.
 *
 * Fails the build if the catalog query fails, so a half-empty sitemap cannot
 * ship silently. Set SITEMAP_ALLOW_PARTIAL=1 to downgrade that to a warning.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, publicPaths } from './seo/public-routes.mjs';
import { publisherRoutes } from './lib/catalog.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'dist/sitemap.xml');
const ALLOW_PARTIAL = process.env.SITEMAP_ALLOW_PARTIAL === '1';

const xml = (urls) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(
      (u) =>
        `  <url>\n    <loc>${SITE}${u.loc}</loc>\n${u.lastmod ? `    <lastmod>${new Date(u.lastmod).toISOString().slice(0, 10)}</lastmod>\n` : ''}  </url>`,
    )
    .join('\n')}\n</urlset>\n`;

async function main() {
  const urls = publicPaths().map((loc) => ({ loc }));
  try {
    const publishers = await publisherRoutes();
    console.log(`  publishers: ${publishers.length} listed, ${publishers.skipped} skipped (no publicly visible titles)`);
    urls.push(...publishers.map((p) => ({ loc: p.path, lastmod: p.lastmod })));
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
