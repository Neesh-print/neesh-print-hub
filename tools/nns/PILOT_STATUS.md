# NYC pilot status

2026-10-14. Network access is unblocked; the live enrichment pilot is **running**.

## Completed

- Read-only export of 100 existing NYC prospects with websites.
- Deterministic sample, stable IDs and source-file hash.
- Offline processing and deep equality check of all 100 complete original rows,
  including status_history and notes.
- All 88 populated source phone numbers preserved.
- 80 passing tests, including a synthetic 100-record batch, repeat-site caching,
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

## Network correction

OS DNS resolution failed even after Work network access was enabled. A normal
HTTPS request then succeeded through the runtime's existing managed proxy.
The earlier DNS-only preflight did not establish whether this proxy connection
was usable; describing all live access as blocked was too broad.

Version 0.2.0 adds explicit managed-proxy mode. It uses the already-configured
egress route and delegates DNS/IP restrictions to that managed policy, while
retaining local URL/redirect checks, TLS, robots, rate limits and bounded jobs.
No alternate resolver, proxy bypass or paid fallback was used. Default pinned
mode still requires local validated DNS and pins the connection.

A real-site smoke test completed: two pages, six requests and one website-linked
Instagram candidate, without an email. Its cache/evidence was reused for the
full 100-record run. The baseline table above describes the earlier offline
check; it is not the current in-progress live total.

## Required acceptance work

Finish the live batch and complete the source audit. Report email
coverage separately from phone and email-or-phone coverage before production
integration or declaring the engine validated.

The public PR contains code, synthetic tests and this aggregate report only.
Actual prospects, IDs, notes and contact outputs remain private.

The preview has not run against a full legacy export or a live canonical Index
export. It does not establish duplicate-detection precision/recall, import
readiness or actual neighborhood/segment accuracy. No record was imported or
merged by these checks.
