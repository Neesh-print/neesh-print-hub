# Nustand discovery and research

Nustand can propose new spaces from public OpenStreetMap data and research
public business contact details for imported spaces. Results are evidence-backed
candidates, not verified contacts or automatically approved prospects.

## Owner workflow

1. Discover by area and segment, then select candidates to add and research.
2. Research existing spaces, or supply/correct an official website and retry.
3. Review website identity, contact evidence, fit, and suppression flags.
4. Explicitly accept contacts before copying or exporting them. No outreach is sent.

Original imports and manual review decisions are preserved. Research is stored
separately. New evidence increments the record version so an unsaved older review
cannot silently overwrite newer state. Name matches never automatically merge
entities. Unresolved websites remain an attention state, not a successful crawl.

## Lead discovery and tags

Discovery searches Google Places for one ICP segment in an area or neighborhood
(three searches per run, up to about 60 places) and shows the places you don't
already have, matched by ID, name or website. Adding them queues research.
Without a Google key it falls back to OpenStreetMap.

Every researched space is tagged from its Google listing with a neighborhood
(or borough), a readable space type and an ICP segment (Wait, Presence, Dwell,
Taste, Catalog; see `nns/icp.py`). An owner-set segment is never overwritten.
Tags are a starting point to confirm, not verified facts. Lookups share the
database cap of 1,000 a month.

## Speed

Queueing research or a lead search calls the owner-only `nustand-start` function,
which starts the worker immediately (GitHub token `GITHUB_DISPATCH_TOKEN` in
Supabase secrets, scoped to this repository's Actions). Without the token the
5-minute schedule still runs. Each run researches 5 spaces at once and keeps
claiming batches until the queue is empty or about 11 minutes pass.

Lead searches run five queries per ICP with up to two pages each (up to 10
Google lookups), drop closed places and chains (known chain domains, or one
domain repeated three or more times), and rank places with a website and phone
first. The database caps lookups at 600 a day and 2,000 a month.

## Sources and limits

- Geographic discovery and missing-site lookup use OpenStreetMap / Overpass.
- Eligible publisher stockist pages can supply exact-name external website candidates.
- Business websites are crawled subject to robots, terms, throttling, DNS/SSRF,
  response-size, request-count and time limits.
- Site identity inferred from a name or map listing requires owner review.
- Business crawl: at most four pages and sixteen requests per job. Stockist lookup:
  at most two pages and eight requests. At most ten jobs are claimed per run.
- Overpass requests share a database-enforced fifty-request daily limit. Discovery
  is bounded to one hundred returned candidates, with a ten-job daily discovery cap.
- When open data finds no site, the broker can look the space up in Foursquare
  Places and Google Places (keys `FOURSQUARE_API_KEY` and `GOOGLE_PLACES_API_KEY`
  are Supabase secrets; the runner never sees them). A listing is used only when
  its name matches the imported name after removing branch suffixes and
  punctuation, and every resulting contact still needs website-identity review.
  Foursquare is preferred when both match. Calls are capped in the database at
  600 a day and 1,000 a calendar month across providers (`sql/provider_budget.sql`),
  which keeps both inside their free tiers. Remove either secret to switch that
  provider off. Google's terms restrict storing Places content, so treat Google
  results as leads to the business's own site and review that before relying on them.
- No email guessing or AI service is required.
- Published data can be stale or incomplete. Missing contact details, unknown fit,
  ambiguous location and blocked crawls are surfaced rather than fabricated.

Map data: [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright),
available under ODbL. Respect the public endpoint's
[usage policy](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html).

## Worker boundary

A scheduled GitHub Actions runner authenticates to the Edge broker with a
short-lived GitHub OIDC token. The broker checks signature, issuer, audience,
repository identity, public visibility, main branch, workflow path, event and
expiry. GitHub does not receive the database service key, internal notes, manual
review decisions or review history. Do not log broker credentials or job payloads.
Public Actions logs must never contain prospect/contact data.

Database access remains owner-gated. Queue claim, source budget and job completion
RPCs are restricted to the broker's service role. Leases and completion payloads
are validated, suppression is rechecked, and client table access remains revoked.

## Rollout gate

This release requires explicit production approval. In order:

1. Apply `sql/research_jobs_draft.sql`; research is disabled by default.
2. Deploy `supabase/functions/nustand-worker` with the shared OIDC verifier. Its
   platform JWT check is disabled because it validates GitHub OIDC itself.
3. Merge the reviewed branch to deploy the UI and enable the scheduled workflow.
4. Confirm unauthenticated broker rejection and disabled-worker behavior.
5. Enable the private research setting, run a bounded smoke job, then verify
   results, ownership, source preservation and contact-review requirements.

The hosted OIDC/broker/scheduler path must be smoke-tested after deployment;
local tests alone do not establish that integration. Disable the private research
setting and the workflow to pause processing. Already running leases may finish.

Standard public-repository runners are used. Existing hosting/database usage
allowances still apply; no claim is made that account-level overages are impossible.
