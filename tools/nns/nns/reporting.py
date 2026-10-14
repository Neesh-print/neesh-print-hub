"""Coverage and source-audit reports. Never infer precision from test passes."""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def audit_summary(rows: list[dict], audit: list[dict]) -> dict:
    contacts = {c["id"]: c for row in rows for c in row["contacts"] if c["quality_status"] == "observed_on_website"}
    owners = {c["id"]: row["id"] for row in rows for c in row["contacts"]}
    counts = {kind: {"correct": 0, "incorrect": 0, "uncertain": 0, "precision_percent": None} for kind in ("email", "phone", "instagram")}
    seen, reviewed_records, misses, audit_rows = set(), set(), 0, set()
    missed_email_review_records = 0
    for row in audit:
        if row.get("id") in audit_rows:
            raise ValueError("Duplicate prospect in audit")
        audit_rows.add(row.get("id"))
        for review in row.get("contact_reviews", []):
            contact = contacts.get(review.get("contact_id"))
            if review.get("verdict", "pending") == "pending":
                continue
            if not contact or owners[contact["id"]] != row.get("id"):
                raise ValueError("Audit contact does not belong to this prospect")
            if contact["id"] in seen:
                raise ValueError("Duplicate contact judgment in audit")
            seen.add(contact["id"])
            verdict = review.get("verdict")
            if verdict not in {"correct", "incorrect", "uncertain"}:
                raise ValueError("Audit verdict must be correct, incorrect, uncertain, or pending")
            if not row.get("reviewer") or not review.get("reviewed_at"):
                raise ValueError("Completed audit judgments need reviewer and reviewed_at")
            if not any(e["source_url"] == review.get("source_url") and e["content_hash"] == review.get("content_hash") for e in contact["evidence"]):
                raise ValueError("Audit judgment must reference the extracted source URL and content hash")
            counts[contact["kind"]][verdict] += 1
            reviewed_records.add(row["id"])
        if row.get("missed_emails") is not None:
            if not row.get("reviewer") or not row.get("pages_reviewed"):
                raise ValueError("Missed-email review needs reviewer and permitted pages reviewed")
            if not isinstance(row["missed_emails"], list):
                raise ValueError("missed_emails must be an array or null (not assessed)")
            misses += len(row["missed_emails"])
            missed_email_review_records += 1
            reviewed_records.add(row["id"])
    for group in counts.values():
        decisive = group["correct"] + group["incorrect"]
        if decisive:
            group["precision_percent"] = round(100 * group["correct"] / decisive, 1)
    return {"status": "source_audited_sample" if reviewed_records else "not_measured_until_source_audit", "reviewed_records": len(reviewed_records), "per_channel": counts, "missed_email_review_records": missed_email_review_records, "missed_emails_in_reviewed_pages": misses if missed_email_review_records else None, "sampling_note": "Purposive balanced successes/misses; precision describes reviewed contacts only, not the population or deliverability.", "deliverability_verified": False}


def render_report(summary: dict, audit: dict | None = None) -> str:
    live = summary.get("execution_mode") in {"live", "offline_reparse"}
    observed = summary.get("website_observed_contact_records", {})
    before = summary.get("baseline_contact_records", {})
    after = summary.get("retained_plus_accepted_contact_records", {})
    total = summary.get("prospects", 0)
    coverage = summary.get("coverage_percent", {})
    table = []
    for kind, title in (("email", "Email"), ("phone", "Phone"), ("instagram", "Instagram"), ("email_or_phone", "Email or phone")):
        measured = str(observed.get(kind, 0)) if live else "Not measured"
        table.append(f"| {title} | {before.get(kind, 0)} | {after.get(kind, 0)} | {coverage.get(kind, 0)}% | {measured} |")
    audit = audit or summary.get("accuracy", {})
    lines = [
        "# Nustand pilot report", "",
        f"Execution: **{summary.get('execution_mode', 'unspecified')}**. Selected prospects: **{total}**.", "",
        "Imported contacts are unconfirmed. Retained coverage is not evidence of enrichment success or current reachability.", "",
        "| Channel | Baseline records | Retained plus accepted | Retained coverage | Website-observed records |",
        "| --- | ---: | ---: | ---: | ---: |", *table, "",
        f"Pages fetched: {summary.get('pages_fetched', 0)}. HTTP requests: {summary.get('http_requests', 0)}. Cache hits: {summary.get('cache_hits', 0)}.",
        f"Elapsed: {summary.get('elapsed_seconds', 0)} seconds. Database writes: 0. Billable API requests: 0. Additional vendor charges: $0.", "",
        f"Crawl states: {json.dumps(summary.get('crawl_status', {}), sort_keys=True)}.",
        f"Errors: {json.dumps(summary.get('error_codes', {}), sort_keys=True)}.", "",
        f"Source-audit status: **{audit.get('status', 'not_measured_until_source_audit')}**.",
    ]
    if not live:
        lines += ["", "**No live extraction accuracy or contact-coverage uplift can be concluded from this run.** Offline preservation and network preflight checks do not measure website contact availability."]
    if summary.get("execution_mode") == "offline_reparse":
        crawl = summary["source_crawl"]
        lines += ["", f"Contacts were re-extracted from hash-verified HTML saved by the original live crawl. This revision made zero network requests. Original batch: {crawl.get('http_requests', 0)} HTTP requests, {crawl.get('pages_fetched', 0)} newly fetched pages, {crawl.get('cache_hits', 0)} cached jobs and {crawl.get('elapsed_seconds', 0)} seconds. Original results and parser changes are retained separately."]
    if audit.get("per_channel"):
        lines += ["", "Candidate audit includes held contacts from other branches and fax numbers; it is not a table of approved outreach contacts.", "", "| Audited channel | Correct | Incorrect | Uncertain | Sample precision |", "| --- | ---: | ---: | ---: | ---: |"]
        for kind, group in audit["per_channel"].items():
            precision = str(group["precision_percent"]) + "%" if group["precision_percent"] is not None else "Not measured"
            lines.append(f"| {kind} | {group['correct']} | {group['incorrect']} | {group['uncertain']} | {precision} |")
    if audit.get("audited_unflagged_primary_counts"):
        lines += ["", f"Fixed audit sample: {audit.get('selected_records', 0)} records; {audit.get('reviewed_records', 0)} source-reviewed by Codex, {audit.get('records_without_fetched_evidence', 0)} without fetched evidence. This is not human approval.", "", "| Audited unflagged primary | Correct | Incorrect | Uncertain |", "| --- | ---: | ---: | ---: |"]
        for kind, group in audit["audited_unflagged_primary_counts"].items():
            lines.append(f"| {kind} | {group['correct']} | {group['incorrect']} | {group['uncertain']} |")
        lines += ["", "These small, purposive counts are not population precision estimates. Published business contact does not establish purchasing authority."]
    lines += ["", "No SMTP probing or deliverability verification. Email, phone and Instagram are scored separately. Raw source records and history are preserved; these files are proposals only.", "", "Fit scores are provisional evidence signals. Missing website evidence remains unknown. The original buyer 2x2 mapping requires confirmation before automatic sales-motion recommendations.", ""]
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Regenerate a report after reviewing audit.json, without any network requests.")
    parser.add_argument("--results", type=Path, required=True)
    parser.add_argument("--summary", type=Path, required=True)
    parser.add_argument("--audit", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(argv)
    rows = json.loads(args.results.read_text())["records"]
    summary = json.loads(args.summary.read_text())
    audit = audit_summary(rows, json.loads(args.audit.read_text()))
    args.output.write_text(render_report(summary, audit), encoding="utf-8")
    args.output.chmod(0o600)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
