"""Private offline input -> bounded crawl proposals. No database write path."""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import shutil
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

from . import VERSION
from .contacts import safe_csv
from .crawler import Crawler, now_iso
from .network import CrawlError, CurlTransport, Resolver, normalize_url
from .qualification import assess
from .records import is_suppressed, metrics, normalized_city, reconcile
from .reporting import audit_summary, render_report

SEED = "nns-2026-10-14-v1"


def read_records(path: Path) -> list[dict]:
    if path.stat().st_size > 50_000_000:
        raise ValueError("Input exceeds the 50 MB pilot limit")
    if path.suffix.lower() == ".csv":
        with path.open(newline="", encoding="utf-8-sig") as f:
            rows = list(csv.DictReader(f))
    else:
        data = json.loads(path.read_text(encoding="utf-8"))
        rows = data.get("rows", data.get("records")) if isinstance(data, dict) else data
    if not isinstance(rows, list) or not all(isinstance(row, dict) for row in rows):
        raise ValueError("Input must be a record array, {rows:[...]}, {records:[...]}, or CSV")
    for row in rows:
        if any(row.get(k) is not None and not isinstance(row[k], str) for k in ("website", "city", "email", "phone", "country", "instagram_handle", "instagram_url")):
            raise ValueError("Contact, website, city and country fields must be strings or null")
    return rows


def atomic_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    with temp.open("w", encoding="utf-8") as f:
        temp.chmod(0o600)
        json.dump(value, f, ensure_ascii=False, indent=2)
        f.write("\n")
    temp.replace(path)


def select_records(rows: list[dict], limit=100, city="New York", seed=SEED) -> list[dict]:
    eligible = [r for r in rows if normalized_city(r.get("city") or "") == normalized_city(city) and (r.get("website") or "").strip() and not is_suppressed(r) and str(r.get("is_merged", "")).lower() not in {"true", "1", "yes"} and str(r.get("is_invalid", "")).lower() not in {"true", "1", "yes"}]
    if any(not (r.get("id") or r.get("legacy_id")) for r in eligible):
        raise ValueError("Every eligible row requires a stable id")
    ids = [str(r.get("id") or r.get("legacy_id")) for r in eligible]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate source ids; resolve import ambiguity before crawling")
    return sorted(eligible, key=lambda r: hashlib.md5((str(r.get("id") or r.get("legacy_id")) + ":" + seed).encode(), usedforsecurity=False).hexdigest())[:limit]


def export_csv(path: Path, rows: list[dict]) -> None:
    fields = ["id", "name", "city", "neighborhood", "website", "email", "phone", "phone_extension", "instagram", "email_state", "phone_state", "instagram_state", "email_source", "phone_source", "instagram_source", "contact_score", "observed_contact_score", "fit_score", "segment", "crawl_status", "review_reasons", "checked_at"]
    with path.open("w", encoding="utf-8", newline="") as f:
        path.chmod(0o600)
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            if row["do_not_contact"]:
                continue
            output = {k: row.get(k) for k in ("id", "name", "city", "neighborhood", "website", "contact_score", "observed_contact_score")}
            for kind in ("email", "phone", "instagram"):
                output[kind] = row["primary"][kind]
                c = next((c for c in row["contacts"] if c["kind"] == kind and c["is_primary"]), None)
                output[kind + "_state"] = c["quality_status"] if c else "not_found" if row["job"]["status"] == "completed" else row["job"]["status"]
                output[kind + "_source"] = c["evidence"][0]["source_url"] if c and c["evidence"] else "legacy import" if c else ""
                if kind == "phone":
                    output["phone_extension"] = c.get("extension") if c else None
            output.update(fit_score=row.get("fit", {}).get("score"), segment=row.get("fit", {}).get("segment"), crawl_status=row["job"]["status"], review_reasons="; ".join(sorted({reason for c in row["contacts"] for reason in c.get("review_reasons", [])})), checked_at=row["job"]["finished_at"])
            writer.writerow({k: safe_csv(v) for k, v in output.items()})


def audit_selection(rows: list[dict], size=20) -> list[dict]:
    yes = [r for r in rows if any(c["kind"] == "email" and c["quality_status"] == "observed_on_website" and not c.get("review_reasons") for c in r["contacts"])]
    yes_ids = {r["id"] for r in yes}
    no = [r for r in rows if r["id"] not in yes_ids]
    order = lambda r: hashlib.sha256((r["id"] + ":source-audit-v1").encode()).hexdigest()
    chosen = sorted(yes, key=order)[:size // 2] + sorted(no, key=order)[:size // 2]
    chosen_ids = {r["id"] for r in chosen}
    chosen += sorted([r for r in rows if r["id"] not in chosen_ids], key=order)[:size - len(chosen)]
    output = []
    for row in chosen:
        reviews = []
        for contact in row["contacts"]:
            if contact["quality_status"] == "observed_on_website":
                e = contact["evidence"][0]
                reviews.append({"contact_id": contact["id"], "kind": contact["kind"], "value": contact["value"], "source_url": e["source_url"], "content_hash": e["content_hash"], "verdict": "pending", "reviewed_at": None, "notes": ""})
        output.append({"id": row["id"], "name": row["name"], "website": row["website"], "stratum": "email_found" if row["id"] in yes_ids else "email_not_found", "reviewer": None, "contact_reviews": reviews, "pages_reviewed": [], "missed_emails": None, "notes": "Review business/location attribution, exact source evidence, and missed email on permitted pages."})
    return output


def not_attempted(website: str) -> dict:
    return {"website": website, "status": "not_attempted", "started_at": None, "finished_at": None, "contacts": [], "site_signals": [], "pages": [], "pages_fetched": 0, "errors": [], "http_requests": 0, "dns_requests": 0, "billable_requests": 0, "additional_cost_usd": 0, "next_eligible_at": None}


def preflight(rows: list[dict], resolver: Resolver, denied_hosts=()) -> dict:
    probes, seen = [], set()
    for row in rows:
        try:
            host = urlsplit(normalize_url(row["website"])).hostname
        except CrawlError:
            continue
        if any(host == d or host.endswith("." + d) for d in denied_hosts):
            continue
        if host in seen:
            continue
        seen.add(host)
        try:
            resolver.resolve(host)
            probes.append({"host": host, "status": "resolved"})
            return {"passed": True, "probes": probes}
        except CrawlError as exc:
            probes.append({"host": host, "status": exc.code})
        if len(probes) == 3:
            break
    # Unsafe URLs get individual job results instead of an infrastructure error.
    return {"passed": not probes or any(not p["status"].startswith("dns_") for p in probes), "probes": probes}


def run_batch(rows: list[dict], output: Path, crawler: Crawler, manifest: dict, execution_mode="live") -> dict:
    output.mkdir(parents=True, exist_ok=True)
    output.chmod(0o700)
    previous = output / "manifest.json"
    if previous.exists():
        old = json.loads(previous.read_text())
        for key in ("source_sha256", "selected_ids", "policy_sha256", "version"):
            if old.get(key) != manifest.get(key):
                raise ValueError("Existing output belongs to a different input, selection, policy or version; choose a new output directory")
        archive = output / "history" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        archive.mkdir(parents=True)
        for filename in ("manifest.json", "results.json", "summary.json", "audit.json", "report.md", "contacts.csv"):
            if (output / filename).exists():
                shutil.copy2(output / filename, archive / filename)
    atomic_json(previous, manifest)
    cache_dir = output / "cache"
    cache_dir.mkdir(exist_ok=True)
    proposals, jobs, cache_hits = [], {}, 0
    start = time.monotonic()
    for i, record in enumerate(rows):
        try:
            url = normalize_url(record["website"])
        except CrawlError:
            url = record["website"]
        country = record.get("country") or "US"
        cache_key = hashlib.sha256((VERSION + "|" + manifest["policy_sha256"] + "|" + country + "|" + url).encode()).hexdigest()
        cache_path = cache_dir / (cache_key + ".json")
        job, cached = None, False
        if execution_mode == "live" and cache_path.exists():
            candidate = json.loads(cache_path.read_text())
            next_eligible = candidate.get("next_eligible_at")
            if next_eligible is None or datetime.fromisoformat(next_eligible) > datetime.now(timezone.utc):
                job, cached = candidate, True
                cache_hits += 1
        if job is None:
            if execution_mode != "live":
                job = not_attempted(record["website"])
            else:
                if cache_path.exists():
                    archive_cache = cache_dir / "history" / (cache_key + "-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ") + ".json")
                    archive_cache.parent.mkdir(exist_ok=True)
                    shutil.copy2(cache_path, archive_cache)
                job = crawler.crawl(record["website"], country)
                atomic_json(cache_path, job)
                jobs[cache_key] = job
        proposal = reconcile(record, job)
        proposal["job"]["cache_hit"] = cached
        proposal["fit"] = assess(record, job.get("site_signals", []))
        proposals.append(proposal)
        atomic_json(output / "results.json", {"schema_version": VERSION, "manifest": manifest, "records": proposals})
        if execution_mode == "live":
            print(f"{i + 1}/{len(rows)} {job['status']} email={bool(proposal['primary']['email'])} cached={cached}", flush=True)
    summary = metrics(proposals)
    summary.update(execution_mode=execution_mode, started_at=manifest["started_at"], finished_at=now_iso(), elapsed_seconds=round(time.monotonic() - start, 2), http_requests=sum(j["http_requests"] for j in jobs.values()), dns_requests=sum(j["dns_requests"] for j in jobs.values()), pages_fetched=sum(j["pages_fetched"] for j in jobs.values()), cache_hits=cache_hits, website_jobs_this_run=len(jobs), source_sample_sha256=manifest["source_sha256"])
    audit_path = output / "audit.json"
    if execution_mode == "live" and not audit_path.exists():
        atomic_json(audit_path, audit_selection(proposals))
    summary["accuracy"] = audit_summary(proposals, json.loads(audit_path.read_text()) if audit_path.exists() else [])
    atomic_json(output / "summary.json", summary)
    report = output / "report.md"
    report.write_text(render_report(summary), encoding="utf-8")
    report.chmod(0o600)
    export_csv(output / "contacts.csv", proposals)
    return summary


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--city", default="New York")
    parser.add_argument("--require-count", type=int)
    parser.add_argument("--offline", action="store_true", help="Validate imports and preservation only; make zero network requests.")
    parser.add_argument("--denylist", type=Path, help="JSON array of domains with terms/access restrictions.")
    parser.add_argument("--evidence-dir", type=Path, help="Optional temporary private HTML cache for source audit.")
    args = parser.parse_args(argv)
    if not 1 <= args.limit <= 100:
        parser.error("Pilot limit must be 1–100")
    os.umask(0o077)
    try:
        rows = select_records(read_records(args.input), args.limit, args.city)
        if args.require_count is not None and len(rows) != args.require_count:
            parser.error(f"Expected {args.require_count} eligible prospects; found {len(rows)}. No requests made.")
        denied = json.loads(args.denylist.read_text()) if args.denylist else []
        if not isinstance(denied, list) or any(not isinstance(x, str) for x in denied):
            parser.error("Denylist must be an array of domains")
        resolver = Resolver()
        crawler = Crawler(CurlTransport(resolver), denied_hosts=denied, evidence_dir=args.evidence_dir)
        manifest = {"version": VERSION, "started_at": now_iso(), "source_sha256": hashlib.sha256(args.input.read_bytes()).hexdigest(), "selection": "md5(id + ':' + seed), NYC aliases, website, nonmerged, noninvalid, nonsuppressed", "seed": SEED, "selected_ids": [r.get("id") or r.get("legacy_id") for r in rows], "policy_sha256": hashlib.sha256(json.dumps(sorted(denied)).encode()).hexdigest(), "database_writes": 0, "billable_requests": 0}
        mode = "offline_preservation_check" if args.offline else "live"
        if not args.offline:
            check = preflight(rows, resolver, crawler.denied_hosts)
            if not check["passed"]:
                mode = "network_preflight_failed"
            manifest["preflight"] = check
        summary = run_batch(rows, args.output, crawler, manifest, mode)
        print(json.dumps(summary, indent=2))
        return 2 if mode == "network_preflight_failed" else 0
    except (ValueError, OSError) as exc:
        parser.error(str(exc))


if __name__ == "__main__":
    sys.exit(main())
