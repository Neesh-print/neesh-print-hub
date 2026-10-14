# Nustand NYC pilot results

2026-10-14. The live 100-record pilot is complete. The draft remains a proof of
concept: location attribution and mailbox purpose need review before production.

## Yield after source-driven corrections (version 0.2.2)

| Channel | Imported | Retained plus accepted | Unflagged website-observed records |
| --- | ---: | ---: | ---: |
| Email | 0 | 19 | 19 |
| Phone | 88 | 90 | 36 |
| Instagram | 0 | 35 | 35 |
| Email or phone | 88 | 91 | 40 |

Counts are records out of 100, not unique businesses or verified deliverable
addresses. 38 records have at least one email candidate; 19 have a currently
unflagged primary, and the remaining 19 require review. Imported phones alone
already exceeded the directional 70% email-or-phone gate, so retained coverage
must not be presented as email-enrichment success.

All 100 complete original records, notes and status histories are preserved,
as are all 88 populated original phone fields. No database writes or outreach.

## Crawl and cost

- 45 completed, 5 partial, 41 failed and 9 blocked jobs.
- Main batch: 430 HTTP requests, 147 newly fetched pages, 2 cache hits,
  98 fresh website jobs and 1,853.02 seconds (30.9 minutes).
- The cache hits include the prior smoke test and a repeat website within the
  batch. Smoke test: 6 requests, 2 pages, approximately 20.6 seconds.
  Combined actual requests: 436; actual page fetches: 149.
- Errors can overlap jobs: 43 timeouts, 6 unavailable robots files, 4 oversized
  responses, 2 cross-site redirects, 1 HTTP error and 1 excluded provider.
- Additional billable API calls: 0. Additional vendor charges: $0.
- Managed-proxy mode used the runtime's existing approved egress. Local DNS
  counts exclude proxy resolution. No proxy bypass or alternate DNS resolver.

A failed/blocked crawl is not evidence that a business has no published email.
Successful HTML retrieval also does not prove complete site coverage: one root
page only contained a meta-refresh, which this crawler does not yet follow.

## Fixed source audit

The original balanced sample selected 20 records: ten original email successes
and ten misses. Codex reviewed saved HTML for 12 records; eight had no fetched
evidence and remain unassessed. The same 20 records remain in the corrected
review, including difficult chain/location cases. This is an assistant source
review, not a human approval or deliverability test.

| Corrected candidate channel, including held items | Correct | Incorrect | Uncertain | Precision of decisive judgments |
| --- | ---: | ---: | ---: | ---: |
| Email | 16 | 41 | 0 | 28.1% |
| Phone | 9 | 130 | 5 | 6.5% |
| Instagram | 10 | 0 | 2 | 100.0% |

The low raw-candidate precision is material: chain-wide location pages provide
many valid contacts for the wrong physical branch, and fax numbers enter the
phone candidate pool. These candidates require attribution, not blind import.

Among the corrected unflagged primaries actually reviewed, email was 6 correct /
0 incorrect, phone 8 / 0, and Instagram 7 / 0. These tiny purposive counts,
including two records from one chain, do not estimate population accuracy.
Published functional mailboxes are not necessarily purchasing contacts.

Missed-email inspection covered permitted saved pages for only three records;
no missed email was found on those pages. Site-level recall remains unknown.

## Corrections demonstrated without another crawl

The original 0.2.0 run proposed 36 email primaries. Source review found an
incorrect branch primary and ordinary prose converted into false addresses.
The separate corrected revision:

- Requires explicit written obfuscation markers; removed six false candidates
  across six records. Bare `at` prose no longer creates addresses.
- Holds multiple plausible emails when no imported primary exists. This removes
  the alphabetical branch-selection failure, at the cost of holding valid
  general/contact pairs until reviewed. No candidates or originals are erased
  from the historical run.
- Verifies saved HTML hashes and preserves page timestamps and original crawl
  states. This revision made zero additional network requests.
- Keeps the audit sample fixed and records all 21 changed records separately.

## Validation and remaining work

84 tests pass, including a synthetic 100-record batch, preservation, suppression,
robots/redirect protections, managed proxy boundaries, source-audit validation,
false-email regression, ambiguous email holds and tamper-resistant offline
reparsing. Passing tests are not evidence of production extraction precision.

Before production: improve branch attribution and mailbox-purpose ranking,
separate fax from phone, reduce overbroad vendor holds, handle safe meta-refresh
explicitly, and review failed-crawl coverage. Fit scoring remains provisional;
the original buyer 2x2 mapping remains unknown.

Offline discovery checks recognized all 100 repeated source identities, proposed
zero new records and retained every original row and phone. Neighborhood labels
exist on 20 records and are absent on 80. These checks do not establish real
neighborhood discovery yield or duplicate-detection precision/recall.

The public PR includes code, synthetic fixtures and aggregate results only.
Actual prospect IDs, private notes, contacts and source evidence stay private.
Branch deployment is disabled. Nothing was merged or deployed.
