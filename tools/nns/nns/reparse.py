"""Re-extract a finished pilot from verified local HTML, with no network calls."""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import re
import time
from pathlib import Path

from . import VERSION
from .cli import atomic_json, audit_selection, export_csv
from .contacts import extract_contacts
from .crawler import now_iso
from .records import metrics, reconcile
from .reporting import audit_summary, render_report


def reparse(source: Path, evidence: Path, output: Path) -> dict:
    if output.exists():
        raise ValueError("Choose a new output directory; original runs are never overwritten")
    data = json.loads((source / "results.json").read_text())
    source_summary = json.loads((source / "summary.json").read_text())
    rows = data["records"]
    selected = data["manifest"]["selected_ids"]
    if source_summary.get("execution_mode") != "live" or len(rows) != len(selected) or source_summary.get("prospects") != len(rows) or [r["id"] for r in rows] != selected:
        raise ValueError("Reparse requires a complete, matching live batch")
    started = now_iso()
    timer = time.monotonic()
    proposals, changes = [], []
    for row in rows:
        job = copy.deepcopy(row["job"])
        contacts = {}
        for page in job["pages"]:
            digest = page["content_hash"]
            if not re.fullmatch(r"[a-f0-9]{64}", digest):
                raise ValueError("Invalid evidence hash")
            raw = (evidence / (digest + ".html")).read_bytes()
            if hashlib.sha256(raw).hexdigest() != digest:
                raise ValueError("Source evidence hash mismatch; refusing to reparse")
            parsed = extract_contacts(raw.decode("utf-8"), page["source_url"], page["checked_at"], row["original_record"].get("country") or "US")
            for contact in parsed["contacts"]:
                key = (contact["kind"], contact["value"], contact["extension"])
                if key in contacts:
                    contacts[key]["evidence"].extend(contact["evidence"])
                    contacts[key]["review_reasons"] = sorted(set(contacts[key]["review_reasons"]) & set(contact["review_reasons"]))
                else:
                    contacts[key] = contact
        job["contacts"] = list(contacts.values())
        proposal = reconcile(row["original_record"], job)
        proposal["fit"] = copy.deepcopy(row.get("fit", {}))
        proposals.append(proposal)
        old_contacts = {c["id"]: c for c in row["contacts"]}
        new_contacts = {c["id"]: c for c in proposal["contacts"]}
        removed = sorted(old_contacts.keys() - new_contacts.keys())
        added = sorted(new_contacts.keys() - old_contacts.keys())
        if removed or added or row["primary"] != proposal["primary"]:
            changes.append({"id": row["id"], "removed_contacts": [old_contacts[k] for k in removed], "added_contacts": [new_contacts[k] for k in added], "primary_before": row["primary"], "primary_after": proposal["primary"]})
    source_hash = hashlib.sha256((source / "results.json").read_bytes()).hexdigest()
    manifest = {"version": VERSION, "execution_mode": "offline_reparse", "started_at": started, "source_results_sha256": source_hash, "source_manifest": data["manifest"], "selected_ids": selected, "additional_network_requests": 0, "reason": "Require explicit written email markers; hold ambiguous multiple emails for source/location review"}
    summary = metrics(proposals)
    summary.update(execution_mode="offline_reparse", started_at=started, finished_at=now_iso(), elapsed_seconds=round(time.monotonic() - timer, 2), http_requests=0, dns_requests=0, pages_fetched=0, cache_hits=0, source_crawl=source_summary, source_results_sha256=source_hash, changed_records=len(changes))
    # Keep the original fixed sample so a parser correction cannot silently
    # remove difficult records from the audit. Rebuild only contact worksheets.
    original_audit = json.loads((source / "audit.json").read_text())
    all_worksheets = {a["id"]: a for a in audit_selection(proposals, size=len(proposals))}
    audit = []
    for previous in original_audit:
        item = all_worksheets[previous["id"]]
        item["stratum"] = previous["stratum"]
        item["selection_basis"] = "Original live-run balanced sample; fixed before parser corrections"
        audit.append(item)
    summary["accuracy"] = audit_summary(proposals, [])
    output.mkdir(parents=True, mode=0o700)
    for name, value in (("manifest.json", manifest), ("results.json", {"schema_version": VERSION, "manifest": manifest, "records": proposals}), ("summary.json", summary), ("audit.json", audit), ("parser_changes.json", changes)):
        atomic_json(output / name, value)
    export_csv(output / "contacts.csv", proposals)
    report = output / "report.md"
    report.write_text(render_report(summary), encoding="utf-8")
    report.chmod(0o600)
    return summary


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--evidence-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(argv)
    os.umask(0o077)
    summary = reparse(args.source, args.evidence_dir, args.output)
    print(json.dumps({k: summary[k] for k in ("prospects", "changed_records", "http_requests", "retained_plus_accepted_contact_records")}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
