# Nustand private review milestone

Implemented on the existing draft branch; not deployed. Route: `/admin/nustand`.

## What works

- Reuses marketplace authentication and admin navigation; explicit null-role
  denial in the Nustand page. The workspace mounts only after owner-checked RPC
  access succeeds. Account changes immediately unmount private records.
- Corrected `0.2.2` pilot JSON import with a confirmation step, 10 MB / 100-record
  limits, stable identity checks, and no overwrite of existing reviews.
- Search name/address/neighborhood; filter segment, review state, accepted email,
  missing email, due follow-ups and suppression. Shows crawl failures separately
  from absent email and observed fit separately from manual fit.
- Review all contact candidates with original source URLs, excerpts, timestamps,
  quality labels and reasons for review. Accept/reject decisions are explicit;
  crawler-proposed primaries never imply human approval.
- Manual stage, segment, fit score, notes, next-follow-up date and suppression.
  Raw source, original notes/history and original phones remain unchanged.
- CSV exports only qualified, nonsuppressed spaces with accepted contacts.
  Spreadsheet formula prefixes are escaped. JSON review backups preserve all
  source and review state; restore from those backups is not yet a UI feature.
- Draft private schema and owner-checked RPCs for list, import and review. No
  direct client table access, no public policies, one explicitly enrolled owner,
  atomic imports, immutable source snapshots, optimistic locking and append-only
  review history. Imports are capped at 100 rows until pagination is built.

## Database review boundary

`sql/nustand_review_draft.sql` is deliberately outside `supabase/migrations`.
It has not been run against production. It creates a new private schema, with
no owner enrolled by default. Before production approval:

1. Inspect the live shared Supabase schema, grants, `public.is_admin()` and auth
   identity; confirm Gem's exact auth UUID and existing capacity.
2. Validate the draft against a disposable copy of the live schema. Local tests
   use an isolated PostgreSQL-compatible PGlite database with auth/role stubs;
   this verifies function behavior, not live Supabase/PostgREST configuration.
3. Back up the target and verify anonymous, retailer, publisher and other-admin
   denial through the actual API. Keep `nustand_private` out of exposed schemas.
4. Review the migration and owner enrollment together with Gem. Only then apply
   it, regenerate Supabase types, import the private corrected pilot and deploy.
5. Preserve legacy data and the source packet. Disable the route and revoke RPC
   access if rollback is needed; do not drop the new tables or review history.

The client uses the existing authenticated Supabase client through a narrow RPC
adapter. It contains no service-role secret or fixed owner identity. Source
IDs are legacy pilot IDs for this slice; canonical Index/retailer linking is
still pending live schema verification and full-export reconciliation.

## Validation

- 12 focused frontend tests: source preservation, import identity validation,
  explicit acceptance, suppression, qualified export, CSV safety, URL schemes,
  save failure, filtering, null-role denial, denied RPC and account changes.
- Disposable database checks: deny anonymous/other-admin/non-admin access; deny
  direct table reads and owner self-enrollment; preserve source on reimport;
  retain imported suppression; reject stale saves and invalid decisions; append
  review history; atomically reject malformed or over-capacity batches.
- Vite production bundle builds. New modules pass ESLint. Full-app TypeScript
  still reports existing errors outside Nustand (including stale generated
  profile types and existing application/bulk-import code).
- Actual 100-record corrected pilot used locally for visual/integration review.
  Desktop and 390px mobile views inspected; no browser exceptions or document
  overflow. No private records, screenshots, notes or contact values are committed.

Run frontend tests:

    npx vitest run src/features/nustand src/pages/admin/AdminNustand.test.tsx

Run database checks with a separately installed validation-only PGlite package:

    NUSTAND_PGLITE_MODULE=/absolute/path/to/pglite/dist/index.js \
      node tools/nns/sql/test_review_db.mjs

## Next work

Contact extraction accuracy improvements, canonical linking, open-data discovery,
worker queue/scheduling, backup restore, advanced qualification and outreach
logging remain separate milestones. This slice does not trigger crawls or send
messages. Buyer 2x2 remains manual/unknown. No new provider or paid fallback.
