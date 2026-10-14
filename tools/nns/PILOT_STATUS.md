# NYC pilot status

2026-10-14. The live enrichment pilot is **not yet complete**.

## Completed

- Read-only export of 100 existing NYC prospects with websites.
- Deterministic sample, stable IDs and source-file hash.
- Offline processing and deep equality check of all 100 complete original rows,
  including status_history and notes.
- All 88 populated source phone numbers preserved.
- 73 passing tests, including a synthetic 100-record batch, repeat-site caching,
  audit metrics, malformed pages, robots, unsafe redirects, suppression and
  phone conflicts.
- Reproducible CLI, CSV/JSON/Markdown outputs, audit worksheet, provisional
  evidence-based fit rules and documentation.
- Offline discovery/import preview for local legacy, Index and manual exports:
  geographic/segment filters, namespaced stable IDs, duplicate candidates,
  suppression holds and full original-row preservation.
- Compared the real 100-row sample with itself: all 100 identities recognized,
  zero proposed new records, 99 matched-existing decisions and one website
  provider issue held for review. All original records and 88 phones retained.
- Confirmed 20 records have neighborhood labels and 80 do not. A Lower East
  Side + Catalog filter produced 46 review rows and 54 exclusions, with no
  confirmed selection. This is a filter check, not a discovery-yield claim.

## Baseline, not enrichment results

| Measure | Count / 100 |
| --- | ---: |
| Imported email | 0 |
| Imported phone | 88 |
| Imported Instagram | 0 |
| Imported email or phone | 88 |
| Real sample website pages fetched | 0 |
| Real contacts source-audited | 0 |

The baseline already exceeds the directional 70% email-or-phone gate because
of imported phones. That does not demonstrate email-enrichment success.
New email yield, real extraction precision, website-confirmed phone coverage
and live batch duration remain **not measured**.

## Execution blocker

The runtime failed OS DNS resolution for the first sample website and two
independent public domains. The smoke job returned dns_failed before HTTP.
No alternate resolver, proxy bypass, paid service or production worker was
activated. The 100-record run was explicitly offline, not 100 website failures
and not evidence that these businesses publish no email.

## Required acceptance work

Run the README command on an approved computer with permitted public web
access, using the private sample. Complete the source audit. Report email
coverage separately from phone and email-or-phone coverage before production
integration or declaring the engine validated.

The public PR contains code, synthetic tests and this aggregate report only.
Actual prospects, IDs, notes and contact outputs remain private.

The preview has not run against a full legacy export or a live canonical Index
export. It does not establish duplicate-detection precision/recall, import
readiness or actual neighborhood/segment accuracy. No record was imported or
merged by these checks.
