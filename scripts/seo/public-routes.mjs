/**
 * The public surface of neesh.art, in one place.
 *
 * Four things read this file: the prerender step, the sitemap generator, the
 * generated llms.txt, and the CI crawlability check. A public page that is not
 * listed here is not prerendered, not in the sitemap, and fails the CI check,
 * so adding a route without its metadata is meant to be awkward.
 *
 * Titles and descriptions are drawn from the copy already on each page. Keep
 * them that way: they are what an AI assistant will quote back about Neesh.
 *
 * Publisher profiles are not listed here because they come from the database.
 * See publisherRoutes() in scripts/lib/catalog.mjs.
 */

export const SITE = 'https://neesh.art';

/** Routes rendered by the React app, snapshotted at build time. */
export const APP_ROUTES = [
  {
    path: '/',
    title: 'Neesh | The Marketplace for Independent Magazines',
    description:
      'Neesh is a wholesale marketplace for independent magazines. Publishers get discovered and paid faster. Retailers stock rare titles with zero risk.',
  },
  {
    path: '/explore',
    title: 'Explore the Catalog | Neesh',
    description:
      'A curated selection of independent magazines available through Neesh. Apply as a retailer to browse the full catalog and place orders.',
    // The catalog is the point of this page. Page furniture alone clears a text
    // length bar, so require actual titles to be present.
    minCatalogItems: 10,
  },
  {
    path: '/publishers',
    title: 'For Publishers | Neesh',
    description:
      'Traditional reach without traditional margins. List your magazine on Neesh to reach new retailers, keep creative control, and get paid faster.',
  },
  {
    path: '/retailers',
    title: 'For Retailers | Neesh',
    description:
      'Discover and stock hyper-niche indie magazines. Curated titles at wholesale, ordered in one place and shipped direct by the publisher.',
  },
  {
    path: '/pricing',
    title: 'Pricing | Neesh',
    description:
      'Simple, transparent terms for publishers and retailers. Keep creative control while Neesh handles discovery, orders, and payouts.',
  },
  {
    path: '/faq',
    title: 'Frequently Asked Questions | Neesh',
    description: 'Everything you need to know about selling and stocking with Neesh.',
  },
];

/**
 * Public pages served as their own static HTML, outside the React app.
 * They already carry their own metadata, so they are listed for the sitemap
 * and the CI check but are never prerendered or rewritten.
 */
export const STATIC_PAGES = [
  // The packs page carries the presale offer in full prose.
  { path: '/curatedpacks', minText: 2000, requireJsonLd: false },
  // A single-purpose signup form. Deliberately short, so it gets a lower bar.
  { path: '/newsletter', minText: 60, requireJsonLd: false },
];

/** Every public path, for the sitemap and the crawlability check. */
export const publicPaths = () => [...APP_ROUTES.map((r) => r.path), ...STATIC_PAGES.map((r) => r.path)];

/**
 * Router paths that are public but deliberately not prerendered.
 * Used by the CI check so it can tell "intentionally excluded" from "forgotten".
 */
export const KNOWN_UNRENDERED = new Set([
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
  '/error',
  '/offline',
  '/unauthorized',
  '/r/:slug', // retailer profiles, not a marketing surface
  '*',
]);
