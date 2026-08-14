#!/usr/bin/env node
/**
 * Snapshots the public React routes to static HTML after the Vite build.
 *
 * Why a real browser rather than Vite's SSR build: src/integrations/supabase/client.ts
 * reads localStorage at module scope, which throws under Node. Rendering in Chromium
 * means no component has to be made SSR-safe, and the app code stays untouched.
 *
 * React mounts with createRoot, not hydrateRoot, so it discards this markup and
 * re-renders on boot. That means no hydration mismatches to manage: the snapshot
 * is purely what non-JavaScript clients read.
 *
 * Output goes to dist/<route>/index.html. Vercel serves the filesystem before
 * applying the SPA rewrite, which is the same mechanism /curatedpacks already uses.
 *
 * Env:
 *   PRERENDER_CHROMIUM  explicit browser path, for sandboxes without a download
 *   PRERENDER_ALLOW_THIN=1  warn instead of failing when a page renders no content
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, copyFileSync } from 'node:fs';
import { resolve, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { SITE, APP_ROUTES } from './seo/public-routes.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const PORT = 41739;
const ALLOW_THIN = process.env.PRERENDER_ALLOW_THIN === '1';
// Enough text that we know React rendered the page, not just a spinner.
const MIN_TEXT = 400;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

/** Serves dist the way Vercel does: real files first, SPA shell as fallback. */
function serveDist(shellPath) {
  const shell = readFileSync(shellPath);
  return createServer((req, res) => {
    const path = decodeURIComponent(req.url.split('?')[0]);
    let file = join(DIST, path);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (existsSync(file) && statSync(file).isFile()) {
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
      return res.end(readFileSync(file));
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(shell);
  });
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Replaces the shell's global title and description with this route's, and adds
 * a canonical. Everything else in the head (icons, JSON-LD, og:image, twitter:card)
 * is left exactly as the shell defined it.
 */
function applyMetadata(html, route) {
  const url = `${SITE}${route.path}`;
  let out = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(route.title)}</title>`)
    .replace(/<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${esc(route.description)}">`)
    .replace(/<meta\s+property="og:title"[^>]*>/i, `<meta property="og:title" content="${esc(route.title)}">`)
    .replace(/<meta\s+name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${esc(route.title)}">`)
    .replace(
      /<meta\s+property="og:description"[^>]*>/i,
      `<meta property="og:description" content="${esc(route.description)}">`,
    )
    .replace(
      /<meta\s+name="twitter:description"[^>]*>/i,
      `<meta name="twitter:description" content="${esc(route.description)}">`,
    );

  const canonical = `<link rel="canonical" href="${url}">`;
  const ogUrl = `<meta property="og:url" content="${url}">`;
  out = /<link\s+rel="canonical"/i.test(out)
    ? out.replace(/<link\s+rel="canonical"[^>]*>/i, canonical)
    : out.replace(/<\/head>/i, `  ${canonical}\n  ${ogUrl}\n</head>`);
  return out;
}

function outputPath(routePath) {
  return routePath === '/' ? join(DIST, 'index.html') : join(DIST, routePath, 'index.html');
}

export async function prerender(routes) {
  const shellPath = join(DIST, 'app.html');
  // app.html is the untouched shell. The SPA rewrite points at it, so prerendering
  // "/" into index.html cannot leak homepage markup into deep-linked app routes.
  if (!existsSync(shellPath)) copyFileSync(join(DIST, 'index.html'), shellPath);

  const server = serveDist(shellPath);
  await new Promise((r) => server.listen(PORT, r));

  const browser = await chromium.launch({
    executablePath: process.env.PRERENDER_CHROMIUM || undefined,
  });
  const page = await browser.newPage();
  const thin = [];

  for (const route of routes) {
    await page.goto(`http://localhost:${PORT}${route.path}`, { waitUntil: 'networkidle', timeout: 45000 });
    try {
      await page.waitForFunction((min) => (document.getElementById('root')?.innerText || '').length > min, MIN_TEXT, {
        timeout: 15000,
      });
    } catch {
      // fall through, reported below
    }
    const text = await page.evaluate(() => (document.getElementById('root')?.innerText || '').trim());
    const html = applyMetadata(await page.content(), route);
    const out = outputPath(route.path);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, html);
    const label = `${route.path.padEnd(32)} ${String(text.length).padStart(6)} chars`;
    if (text.length < MIN_TEXT) {
      thin.push(route.path);
      console.warn(`  THIN ${label}`);
    } else {
      console.log(`  ok   ${label}`);
    }
  }

  await browser.close();
  server.close();

  if (thin.length && !ALLOW_THIN) {
    console.error(`\nprerender: ${thin.length} route(s) rendered almost no text: ${thin.join(', ')}`);
    console.error('That HTML is what non-JavaScript crawlers would receive, so the build is stopping.');
    console.error('Set PRERENDER_ALLOW_THIN=1 to ship anyway.\n');
    process.exit(1);
  }
  return thin;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  prerender(APP_ROUTES).then((thin) => {
    console.log(`  prerendered ${APP_ROUTES.length} routes${thin.length ? `, ${thin.length} thin` : ''}`);
  });
}
