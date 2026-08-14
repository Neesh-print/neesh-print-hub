#!/usr/bin/env node
/**
 * Fails the build when a public page would reach a crawler without content.
 *
 * Reads the built HTML straight off disk and never executes it, which is exactly
 * what GPTBot, ClaudeBot, PerplexityBot and CCBot do. If a page only renders
 * through React, it fails here rather than shipping as an empty div.
 *
 * Checks every public page for: substantive body text, a title, a meta
 * description, a canonical, and JSON-LD. Also compares the router against the
 * public route table, so a new marketing route added without metadata is caught
 * instead of silently going uncrawlable.
 *
 * Run: npm run check:crawlable
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_ROUTES, STATIC_PAGES, publicPaths, KNOWN_UNRENDERED } from './seo/public-routes.mjs';
import { publisherRoutes, magazineTitles } from './lib/catalog.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const DEFAULT_MIN_TEXT = 400;
// Routes under these prefixes sit behind auth and are never meant to be indexed.
const GATED_PREFIXES = ['/publisher', '/retailer', '/admin'];

const failures = [];
let catalogTitles = [];
const fail = (path, msg) => failures.push(`${path}: ${msg}`);

/** The visible text a crawler extracts: no scripts, styles, or markup. */
function bodyText(html) {
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? '';
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function checkPage(route) {
  const { path } = route;
  const file = path === '/' ? join(DIST, 'index.html') : join(DIST, path, 'index.html');
  if (!existsSync(file)) return fail(path, 'no static HTML was produced, so crawlers get the empty SPA shell');

  const html = readFileSync(file, 'utf8');
  const text = bodyText(html);
  const minText = route.minText ?? DEFAULT_MIN_TEXT;

  if (text.length < minText) fail(path, `only ${text.length} chars of body text, expected at least ${minText}`);

  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  if (!title) fail(path, 'no <title>');
  else if (route.title && title !== route.title) fail(path, `title is "${title}", route table says "${route.title}"`);

  const description = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1]?.trim();
  if (!description) fail(path, 'no meta description');
  else if (route.description && description !== route.description) fail(path, 'meta description does not match the route table');

  if (!/<link\s+rel="canonical"/i.test(html) && route.requireCanonical !== false) fail(path, 'no canonical link');

  if (route.requireJsonLd !== false) {
    const ld = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i)?.[1];
    if (!ld) fail(path, 'no JSON-LD');
    else {
      try {
        JSON.parse(ld);
      } catch {
        fail(path, 'JSON-LD does not parse');
      }
    }
  }

  // Data-driven pages can render their furniture and none of their content, which
  // still clears a text-length bar. Check for the real records instead of markup,
  // so this keeps working if the card layout changes.
  if (route.minCatalogItems) {
    const present = catalogTitles.filter((t) => html.includes(t)).length;
    if (present < route.minCatalogItems) {
      fail(
        path,
        `catalog looks empty: ${present} of ${catalogTitles.length} magazine titles present, expected at least ${route.minCatalogItems}`,
      );
    }
  }
}

/** A public route added to the router but not to the route table is a silent regression. */
function checkRouterDrift() {
  const app = readFileSync(join(ROOT, 'src/App.tsx'), 'utf8');
  const routerPaths = [...app.matchAll(/<Route\s+path="([^"]+)"/gs)].map((m) => m[1]);
  const known = new Set(publicPaths());
  for (const p of routerPaths) {
    if (known.has(p) || KNOWN_UNRENDERED.has(p)) continue;
    if (GATED_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`))) continue;
    if (p.startsWith('/p/')) continue; // publisher profiles come from the database
    failures.push(`${p}: in the router but not in scripts/seo/public-routes.mjs. Add it there with a title and description, or list it in KNOWN_UNRENDERED.`);
  }
}

async function main() {
  const routes = [...APP_ROUTES, ...STATIC_PAGES];
  try {
    const [publishers, titles] = await Promise.all([publisherRoutes(), magazineTitles()]);
    routes.push(...publishers.map((p) => ({ path: p.path })));
    catalogTitles = titles;
  } catch (err) {
    console.error(`\ncheck:crawlable: could not read the catalog: ${err.message}\n`);
    process.exit(1);
  }

  routes.forEach(checkPage);
  checkRouterDrift();

  if (failures.length) {
    console.error(`\ncheck:crawlable: ${failures.length} problem(s) found.\n`);
    failures.forEach((f) => console.error(`  ${f}`));
    console.error('\nThese pages would reach an AI crawler without readable content.\n');
    process.exit(1);
  }
  console.log(`  check:crawlable: ${routes.length} public pages all serve title, description, canonical, JSON-LD, and body text`);
}

main();
