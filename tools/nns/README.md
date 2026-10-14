# New Newsstand contact-enrichment pilot

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
