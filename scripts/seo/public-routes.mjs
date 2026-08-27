/**
 * The public surface of app.neesh.art, in one place.
 *
 * Four things read this file: the prerender step, the sitemap generator, the
 * generated llms.txt, and the CI crawlability check. Since the domain split,
 * the marketing pages live on neesh.art (the public_neesh repo); this app's
 * only crawlable surface is the publisher profiles, which come from the
 * database via publisherRoutes() in scripts/lib/catalog.mjs.
 */

export const SITE = 'https://app.neesh.art';

/** Routes rendered by the React app, snapshotted at build time. */
export const APP_ROUTES = [];

/** Public pages served as their own static HTML, outside the React app. */
export const STATIC_PAGES = [];

/** Every public path, for the sitemap and the crawlability check. */
export const publicPaths = () => [...APP_ROUTES.map((r) => r.path), ...STATIC_PAGES.map((r) => r.path)];

/**
 * Router paths that are public but deliberately not prerendered.
 * Used by the CI check so it can tell "intentionally excluded" from "forgotten".
 */
export const KNOWN_UNRENDERED = new Set([
  // Marketing paths redirect to neesh.art since the domain split.
  '/',
  '/explore',
  '/publishers',
  '/retailers',
  '/pricing',
  '/faq',
  '/legal/privacy',
  '/legal/terms',
  '/legal/publisher-agreement',
  '/legal/retailer-agreement',
  '/home', // redirect helper
  '/login',
  '/apply',
  '/apply/publisher',
  '/apply/retailer',
  '/apply/submitted',
  '/pending',
  '/rejected',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/auth/callback',
  '/onboarding/continue', // auth-gated; redirects straight to a Stripe account link
  '/onboarding/start', // auth-gated publisher pre-flight before the Stripe redirect
  '/error',
  '/offline',
  '/unauthorized',
  '/r/:slug', // retailer profiles, not a marketing surface
  '*',
]);
