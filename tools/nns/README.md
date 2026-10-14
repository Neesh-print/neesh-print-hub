# New Newsstand enrichment and discovery previews

A standalone Python worker that reads a private prospect export and produces
reviewable contact proposals. It has no database client, credentials, sending
path, paid API, scheduler, or deployment dependency.

Status: parser, policy controls, preservation, reports and synthetic batch tests
pass. The 100-prospect legacy NYC export was validated offline. The live pilot
and source-accuracy audit remain blocked by the runtime's unavailable public
DNS. Imported phone coverage is not enrichment yield.

## Run

Requires Python 3.11+ and curl on a computer with permitted public web access.
No pip installation, account signup or API key is required.

From the repository root:

    PYTHONPATH=tools/nns python3 -m unittest discover -s tools/nns/tests -v

Validate the private export without network requests:

    PYTHONPATH=tools/nns python3 -m nns.cli \
      --input /absolute/private/path/nyc-100-source.json \
      --output /absolute/private/path/import-check \
      --require-count 100 --offline

Run the actual pilot where public website access is permitted:

    PYTHONPATH=tools/nns python3 -m nns.cli \
      --input /absolute/private/path/nyc-100-source.json \
      --output /absolute/private/path/live-pilot \
      --evidence-dir /absolute/private/path/temporary-evidence \
      --require-count 100

The preflight checks up to three source hosts using bounded OS DNS lookups.
If all fail DNS resolution, it exits 2 and writes an explicitly unmeasured
report. It does not invent website blocks, switch resolvers or invoke a paid
fallback. Offline mode makes zero DNS or HTTP requests.

Use --limit 1 for a smoke test, then a new output folder for the full run.
Use --denylist /path/domains.json for an operator-reviewed JSON array of domains
whose terms prohibit crawling. Denial covers subdomains too.

## Input and selection

Accepts a JSON array, {"records":[...]}, {"rows":[...]}, or UTF-8 CSV. Every
eligible record needs id (or legacy_id), city and website. Optional contact
strings: email, phone, instagram_handle, instagram_url. Name, business_type,
category, neighborhood, country and manual_overrides are used when present.
Use ISO country codes; the pilot defaults to US. All other fields are preserved
exactly in original_record.

NYC, New York, New York City and the five boroughs normalize to New York.
Suppression flags/stages, merged rows and invalid rows are excluded. Selection
is the first 100 sorted by md5(id + ':nns-2026-10-14-v1'); reproducible, not a
representative random sample of all NYC businesses. Duplicate IDs are rejected.

[export_nyc_sample.sql](sql/export_nyc_sample.sql) is a read-only query. Use an
already authorized database connection. Keep the export outside the public
repository. Never commit prospects, notes, contacts, full pages or private logs.

## Extraction and preservation

- Published role emails including hello, info, contact, shop and buying.
  Sources: mailto, visible text, written obfuscation, entities, basic Cloudflare
  email obfuscation, and business JSON-LD.
- Published phones, US/Canada E.164 normalization, explicit international
  numbers, and extensions. Existing primary numbers stay primary; conflicts
  go to review.
- Website-published Instagram profile links. No social profile is fetched.

Every new contact has exact URL, method, checked timestamp, bounded excerpt and
content hash. No guessed employee emails, SMTP probes or deliverability claims.
Mail-domain status stays not_checked in this pilot. Name-shaped addresses
remain unknown rather than claimed named buyers.

Different-domain email, designer credits, non-reply mailboxes, and ambiguous
multiple-location phone/Instagram candidates remain review items, ineligible
for automatic new-primary selection. Published free-mail addresses are
accepted subject to source audit. Imported primaries are preserved and remain
unconfirmed unless observed.

## Fetch policy

- Homepage plus up to three relevant same-site pages. Robots, redirects and
  one server-error retry also count against a separate request budget.
- Serial requests; at least one second per host. Robots delays up to 30 seconds
  are honored; longer delays stop for scheduling.
- Required robots check. 404/410 permit ordinary fetching. Authentication,
  denials, limits, challenges and ambiguous/unreachable robots fail closed.
  This is stricter than RFC 9309's optional treatment of some 4xx responses.
- Same host apart from www equivalence. Cross-domain changes require review.
  No HTTPS-to-HTTP downgrade from an HTTPS input.
- Validate every DNS answer, including IPv6. Pin curl's connection while
  retaining original Host/SNI/certificate checks. No automatic redirects.
  Keep system proxy/access rules in effect.
- Bound DNS duration, request time/size, job time and total requests.
  Block local/private/link-local/transition addresses and credentialed URLs.
- Stop for detected explicit automated-access prohibitions and operator
  denylist entries. This is not a comprehensive legal/terms audit; check source
  terms before running a batch.

Successful/partial jobs cool down for 30 days, failed jobs for one day. Blocked
jobs do not retry automatically. Repeated websites reuse the cache. Reuse the
same private output directory to resume the same sample; source/policy/version
or selection changes require a new one. Earlier results and refreshed cache
entries are archived. Production tier-based 90/180-day scheduling comes later.

## Outputs and source audit

| File | Purpose |
| --- | --- |
| manifest.json | Input hash, seed, selected IDs, policy, version, preflight |
| results.json | Original records, proposed contacts, evidence, jobs, fit signals |
| contacts.csv | Nonsuppressed rows, channel states/sources, phone extension |
| summary.json and report.md | Baseline, retained and website-observed coverage; errors and cost |
| audit.json | Deterministic pending source judgments by contact |
| history/ and cache/ | Prior results and bounded-job cache |

CSV cells are escaped against spreadsheet formulas. JSON retains raw values.
Files/directories are private by default.

Email, phone, Instagram and email-or-phone coverage are separate. Contact score
uses 60/30/10 weights. Observed contact score counts only an unambiguous
website-observed primary. Neither changes thesis fit.

Inspect 20 audit records: up to ten email successes and ten misses, filled from
the remaining group if one is small. Check exact page and business/location
attribution; inspect permitted pages for missed email. Fill reviewer,
reviewed_at, verdict (correct/incorrect/uncertain), pages_reviewed and
missed_emails (null means unassessed). Retain the source URL and content hash.

    PYTHONPATH=tools/nns python3 -m nns.reporting \
      --results /absolute/private/path/live-pilot/results.json \
      --summary /absolute/private/path/live-pilot/summary.json \
      --audit /absolute/private/path/live-pilot/audit.json \
      --output /absolute/private/path/live-pilot/audited-report.md

Precision = correct / (correct + incorrect), separately per channel. Uncertain
cases remain visible. This purposive sample does not estimate population
accuracy or email recall. No reviewed contacts means **not measured**.
Delete temporary full HTML after review; retain bounded evidence and hashes.

## Qualification foundation

The provisional 30/25/20/15/10 rubric uses sourced signals of space use,
culture, print affinity, merchandising and buyer accessibility. Missing evidence
is unknown; no website evidence produces a null score. Categories suggest a
segment but cannot establish available shelf space.

Manual overrides contain explicit values, e.g.
{"segment":"Wait","fit_score":82,"budget_type":"decor"}. True also locks the
existing record field. Decor maps to packs; inventory to the marketplace on
standard terms with no Net30. The supplied specs do not define the original
buyer 2x2 mapping: quadrant/motion remain unset unless manually supplied.
This heuristic is not yet validated on real websites.

## Offline discovery and import preview

Filter permitted local exports by city, country, borough, neighborhood, segment
and optional phrases, then compare them with an existing export. This command
makes no network requests and writes no database records. It is an import
review foundation, not a live place-search service.

    PYTHONPATH=tools/nns python3 -m nns.discovery \
      --input /absolute/private/path/incoming.csv \
      --source manual --namespace master-prospect-list \
      --existing /absolute/private/path/legacy-leads.json \
      --existing-source legacy --existing-namespace lovable-leads \
      --city 'New York' --neighborhood 'Lower East Side' \
      --segment Catalog --segment Dwell \
      --output /absolute/private/path/discovery-preview

Source types are legacy, index and manual. Use a consistent namespace for each
source system/table across runs. Source IDs are scoped by source and namespace;
identical strings from different systems are not the same identity. Legacy
records use id or legacy_id. Index records use the UUID id of directory_stores
in the shared Neesh database. An explicit directory_store_id can link another
source to that canonical store. Export one store per row; publisher/title
relationships, when included, remain in the original record without cloning.
This adapter does not validate the live Index schema or query its database.

Manual CSV/JSON records can omit id; their complete content produces a stable
key. A changed row then needs duplicate review, so supply your own stable id
for evolving lists. A URL import is a row with website, plus known city/name
metadata; absent geography stays unknown. JSON supports structured overrides
and histories. CSV preserves every cell as text. Duplicate IDs within a file
stop the preview instead of discarding either row.

All incoming and existing rows participate in duplicate checking, including
filtered, suppressed, merged and invalid records. Only an unambiguous stable
identifier can propose an existing link. Shared website hosts, phone numbers,
normalized names or addresses produce review candidates, including duplicates
within the incoming file. Separate branches of a chain are never combined by
domain or phone alone. Conflicting canonical IDs and possible suppressed
duplicates are held for review; a suppressed exact match stays blocked.
Matching remains conservative and is not fuzzy, geospatial or exhaustive.

Each filter dimension combines with AND; repeated neighborhoods, boroughs,
segments or phrases within a dimension use OR. Geography is case-insensitive
and accent-normalized, with NYC city aliases; neighborhood aliases and
boundaries are not inferred. Unknown required geography needs review.
Category-derived segments remain hypotheses; conflicting/unknown categories
need review when a segment is selected. Manual segment overrides stay sticky.
Index stockist membership alone does not assign Catalog.

Outputs: preview.json includes complete incoming/existing snapshots, match
evidence, changed source fields and per-row decisions; review.csv is a
formula-escaped review queue; manifest.json, summary.json and report.md record
inputs, filters and aggregate results. Every decision has outreach_authorized
false. Proposed_new only means no duplicate detected in the supplied files.
Nothing is imported, merged, overwritten or approved for outreach.

Use a new output folder for each preview; existing review work is never
overwritten. Limits: 50 MB / 5,000 records per source, 500 candidates per row,
50,000 candidate links per run. Excessively broad keys stop the preview for
review. Keep the complete relevant existing comparison set; do not omit
suppressed records to fit a limit. Downloading/adapting open place datasets,
neighborhood boundaries and an authenticated UI remain later work.

## Development and limitations

Root vercel.json disables Git deployments for this exact feature branch,
preserving its existing rewrite and other branches. No workflow, scheduler,
app route or database migration is enabled. See [AUDIT.md](AUDIT.md) and
[PILOT_STATUS.md](PILOT_STATUS.md).

Static HTML only. JavaScript-only contacts, images, gated/disallowed pages and
cross-domain ownership changes need review. Phone formatting does not prove
reachability or local attribution. A four-page cap may miss contacts.
No real yield/accuracy claim is justified until the live pilot and audit run.

References: [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html),
[Vercel branch deployment controls](https://vercel.com/docs/project-configuration/git-configuration).
