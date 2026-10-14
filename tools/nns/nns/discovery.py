"""Offline, preview-only discovery and reconciliation. Never imports into a DB."""
from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from uuid import UUID

from .cli import atomic_json, read_records
from .contacts import phone_value, safe_csv
from .network import CrawlError, normalize_url, site_key
from .qualification import SEGMENTS, assess
from .records import is_suppressed, normalized_city

PREVIEW_VERSION = "nns-discovery-preview-0.1"
SOURCES = ("legacy", "index", "manual")
BOROUGHS = {"manhattan", "brooklyn", "queens", "bronx", "the bronx", "staten island"}


def folded(value: str) -> str:
    text = unicodedata.normalize("NFKD", value.casefold())
    return " ".join("".join(c for c in text if not unicodedata.combining(c)).split())


def words(value: str) -> str:
    return " ".join(re.findall(r"\w+", folded(value)))


def digest(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def scalar(record: dict, *keys: str) -> str:
    for key in keys:
        value = record.get(key)
        if value is not None and not isinstance(value, str):
            raise ValueError(f"{key} must be a string or null")
        if value and value.strip():
            return value.strip()
    return ""


def identifier(record: dict, *keys: str) -> str:
    for key in keys:
        value = record.get(key)
        if value is not None and type(value) not in (str, int):
            raise ValueError(f"{key} must be a string, integer or null")
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def normalize(record: dict, source: str, namespace: str) -> dict:
    if source not in SOURCES or not re.fullmatch(r"[a-z0-9][a-z0-9._-]{0,79}", namespace):
        raise ValueError("Use source legacy/index/manual and a stable lowercase namespace (1–80 letters, digits, dot, dash, underscore)")
    source_id = identifier(record, "id", "legacy_id") if source == "legacy" else identifier(record, "id")
    if not source_id and source != "manual":
        raise ValueError(f"{source} records require stable source IDs")
    derived = not bool(source_id)
    source_id = source_id or "sha256:" + digest(record)
    # An ID is meaningful only within its source system/table. A manual row
    # without an ID has a content key; editing it intentionally creates review.
    identity = [source, namespace, source_id]
    strong = {"source_identity:" + digest(identity)}
    issues = []
    directory_id = scalar(record, "directory_store_id")
    if source == "index":
        if directory_id and directory_id != source_id:
            issues.append("conflicting_directory_store_ids")
        directory_id = source_id
    if directory_id:
        try:
            directory_id = str(UUID(directory_id))
            strong.add("directory_store:" + directory_id)
        except ValueError:
            issues.append("invalid_directory_store_id")
            directory_id = None
    city_raw = scalar(record, "city")
    city = normalized_city(city_raw)
    country = scalar(record, "country").upper()
    # The NYC pilot has a declared market. Do not guess other countries.
    country = country or ("US" if city == "New York" else "")
    country = {"USA": "US", "UNITED STATES": "US", "UNITED STATES OF AMERICA": "US"}.get(country, country)
    name = scalar(record, "business_name", "name")
    address = scalar(record, "address")
    borough = scalar(record, "borough") or (city_raw if folded(city_raw) in BOROUGHS else "")
    neighborhood = scalar(record, "neighborhood", "neighbourhood")
    website = scalar(record, "website")
    domain = None
    if website:
        try:
            website = normalize_url(website)
            domain = site_key(website)
        except CrawlError as exc:
            issues.append("website_" + exc.code)
    phone_raw = scalar(record, "phone")
    phone = phone_value(phone_raw, country) if phone_raw else None
    if phone_raw and not phone:
        issues.append("unparsed_phone")
    if not name and not website:
        issues.append("missing_name_and_website")
    fit = assess(record, [])
    weak = set()
    if domain:
        weak.add("shared_website_host:" + domain)
    if phone:
        weak.add("shared_phone:" + phone[0])
    # City-only keys deliberately over-include candidates when country is
    # missing. They never merge records; all weak matches require review.
    if name and city:
        weak.add("same_normalized_name_city:" + digest([words(name), folded(city)]))
    if address and city:
        weak.add("same_normalized_address_city:" + digest([words(address), folded(city)]))
    blocked = []
    if is_suppressed(record):
        blocked.append("suppressed_source_record")
    for field in ("is_merged", "is_invalid"):
        if str(record.get(field, "")).strip().lower() in {"true", "1", "yes"}:
            blocked.append(field)
    return {
        "key": digest(identity), "source": source, "namespace": namespace,
        "source_id": source_id, "id_is_content_derived": derived,
        "directory_store_id": directory_id or None,
        "name": name or None, "city": city or None, "country": country or None,
        "borough": borough or None, "neighborhood": neighborhood or None,
        "address": address or None, "website": website or None, "domain": domain,
        "phone": phone[0] if phone else None, "phone_extension": phone[1] if phone else None,
        "segment": fit["segment"], "segment_candidates": fit["segment_candidates"],
        "segment_state": fit["segment_state"], "segment_source": fit["segment_source"],
        "suppressed": is_suppressed(record), "blocked_reasons": blocked,
        "normalization_issues": sorted(issues), "strong_keys": sorted(strong),
        "review_keys": sorted(weak), "original_record": copy.deepcopy(record),
    }


def normalize_all(rows: list[dict], source: str, namespace: str) -> list[dict]:
    if len(rows) > 5000:
        raise ValueError("Preview limit is 5,000 rows per source; no output written")
    normalized = [normalize(row, source, namespace) for row in rows]
    if len({row["key"] for row in normalized}) != len(normalized):
        raise ValueError("Duplicate source IDs/content keys within one file; resolve them before previewing")
    return sorted(normalized, key=lambda row: row["key"])


def select(row: dict, filters: dict) -> dict:
    excluded, unknown = [], []
    for field in ("city", "country", "borough", "neighborhood"):
        wanted = filters.get(field) or []
        if isinstance(wanted, str):
            wanted = [wanted]
        if not wanted:
            continue
        current = row.get(field)
        normalize_filter = lambda v: folded(normalized_city(v)) if field == "city" else folded(v)
        if not current:
            unknown.append("unknown_" + field)
        elif normalize_filter(current) not in {normalize_filter(v) for v in wanted}:
            excluded.append(field + "_outside_filter")
    selected_segments = filters.get("segments") or []
    if selected_segments:
        if row["segment"]:
            if row["segment"] not in selected_segments:
                excluded.append("segment_outside_filter")
        else:
            unknown.append("ambiguous_segment" if row["segment_candidates"] else "unknown_segment")
    phrases = filters.get("phrases") or []
    haystack = folded(" ".join(str(row["original_record"].get(k) or "") for k in ("business_name", "name", "business_type", "category", "description")))
    if phrases and not any(folded(phrase) in haystack for phrase in phrases):
        excluded.append("search_phrase_not_found")
    return {"state": "excluded" if excluded else "needs_review" if unknown else "selected", "reasons": sorted(excluded + unknown)}


def preview(incoming: list[dict], existing: list[dict], *, source: str, namespace: str,
            existing_source: str | None = None, existing_namespace: str | None = None,
            filters: dict | None = None) -> dict:
    filters = copy.deepcopy(filters or {})
    if set(filters.get("segments") or []) - set(SEGMENTS):
        raise ValueError("Unknown segment filter")
    proposed = normalize_all(incoming, source, namespace)
    current = normalize_all(existing, existing_source or source, existing_namespace or namespace)
    # Index every existing and incoming row before filtering. An excluded or
    # suppressed duplicate must not disappear from identity checks.
    index = defaultdict(list)
    for side, rows in (("existing", current), ("incoming", proposed)):
        for row in rows:
            for key in row["strong_keys"] + row["review_keys"]:
                index[key].append((side, row["key"]))
    lookup = {(side, row["key"]): row for side, rows in (("existing", current), ("incoming", proposed)) for row in rows}
    decisions = []
    total_candidates = 0
    for row in proposed:
        matches = defaultdict(set)
        for token in row["strong_keys"] + row["review_keys"]:
            for ref in index[token]:
                if ref != ("incoming", row["key"]):
                    matches[ref].add(token)
            if len(matches) > 500:
                raise ValueError("More than 500 duplicate candidates for one row; review broad shared identifiers before previewing")
        total_candidates += len(matches)
        if total_candidates > 50000:
            raise ValueError("More than 50,000 duplicate candidate links; review broad shared identifiers before previewing")
        strong_keys = set(row["strong_keys"])
        exact = [ref for ref, tokens in matches.items() if strong_keys.intersection(tokens)]
        exact_existing = [ref for ref in exact if ref[0] == "existing"]
        exact_incoming = [ref for ref in exact if ref[0] == "incoming"]
        candidates = [{"side": ref[0], "key": ref[1], "strength": "stable_identifier" if ref in exact else "review_only", "reasons": sorted({token.split(":", 1)[0] for token in tokens}), "suppressed": lookup[ref]["suppressed"]} for ref, tokens in sorted(matches.items())]
        selection = select(row, filters)
        reasons = set(row["normalization_issues"] + row["blocked_reasons"] + selection["reasons"])
        matched = exact_existing[0] if len(exact_existing) == 1 and not exact_incoming else None
        if len(exact_existing) > 1 or exact_incoming:
            reasons.add("conflicting_stable_identity_matches")
        if matched and row["directory_store_id"] and lookup[matched]["directory_store_id"] and row["directory_store_id"] != lookup[matched]["directory_store_id"]:
            reasons.add("conflicting_directory_store_ids")
            matched = None
        blocked = bool(row["blocked_reasons"])
        if matched and lookup[matched]["blocked_reasons"]:
            blocked = True
            reasons.add("blocked_existing_identity")
        # Only an unambiguous stable identity disambiguates weak matches. A
        # possible suppressed duplicate cannot re-enter a proposed-new list.
        possible_suppressed = not matched and any(lookup[ref]["suppressed"] for ref in matches)
        if possible_suppressed:
            reasons.add("possible_suppressed_duplicate")
        if blocked:
            decision = "blocked"
        elif selection["state"] == "excluded":
            decision = "excluded"
        elif reasons:
            decision = "needs_review"
        elif matched:
            decision = "matched_existing"
        elif matches:
            decision = "needs_review"
            reasons.add("ambiguous_duplicate_candidates")
        else:
            decision = "proposed_new"
        previous = lookup[matched]["original_record"] if matched else None
        changed = sorted(k for k in set(previous or {}) | set(row["original_record"]) if previous is not None and (k not in previous or k not in row["original_record"] or previous[k] != row["original_record"][k]))
        decisions.append({"key": row["key"], "decision": decision, "selection": selection,
                          "reasons": sorted(reasons), "matched_existing_key": matched[1] if matched else None,
                          "changed_source_fields": changed, "candidates": candidates,
                          "contact_hold": blocked or possible_suppressed or decision == "needs_review",
                          "outreach_authorized": False, "record": row})
    counts = Counter(d["decision"] for d in decisions)
    return {
        "preview_version": PREVIEW_VERSION, "mode": "offline_preview_only", "filters": filters,
        "summary": {"incoming_records": len(proposed), "existing_records": len(current),
                    "decisions": {key: counts[key] for key in ("proposed_new", "matched_existing", "needs_review", "blocked", "excluded")},
                    "missing_neighborhood": sum(not row["neighborhood"] for row in proposed),
                    "contact_hold": sum(d["contact_hold"] for d in decisions),
                    "http_requests": 0, "database_writes": 0, "additional_cost_usd": 0},
        "records": decisions, "existing_records": current,
    }


def write_preview(result: dict, output: Path, manifest: dict) -> None:
    # Never overwrite another preview or partially replace review work.
    if output.exists() and any(output.iterdir()):
        raise ValueError("Output directory is not empty; choose a new preview directory")
    output.mkdir(parents=True, exist_ok=True)
    output.chmod(0o700)
    atomic_json(output / "preview.json", result)
    atomic_json(output / "manifest.json", manifest)
    atomic_json(output / "summary.json", result["summary"])
    fields = ["key", "decision", "name", "city", "borough", "neighborhood", "website", "segment", "segment_state", "matched_existing_key", "candidate_count", "reasons", "contact_hold"]
    with (output / "review.csv").open("w", newline="", encoding="utf-8") as f:
        os.chmod(f.name, 0o600)
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for item in result["records"]:
            row = {**{key: item.get(key) for key in fields}, **{key: item["record"].get(key) for key in ("name", "city", "borough", "neighborhood", "website", "segment", "segment_state")}, "candidate_count": len(item["candidates"]), "reasons": "; ".join(item["reasons"])}
            writer.writerow({key: safe_csv(value) for key, value in row.items()})
    summary = result["summary"]
    report = output / "report.md"
    report.write_text("# NNS discovery import preview\n\nOffline preview only. No records imported, merged or sent outreach.\n\n"
                      + "| Decision | Records |\n| --- | ---: |\n"
                      + "".join(f"| {key} | {count} |\n" for key, count in summary["decisions"].items())
                      + f"\nIncoming records: {summary['incoming_records']}. Existing comparison records: {summary['existing_records']}. Missing neighborhood: {summary['missing_neighborhood']}.\n\n"
                      + "Stable identifiers may propose an existing link; all source records and changed fields remain visible. Website, phone, name and address matches require review. Category segments are hypotheses. Unknown neighborhoods do not count as neighborhood matches.\n\n"
                      + "Proposed new means no duplicate detected in these supplied files, not proven unique or outreach-ready. This preview does not measure discovery recall, extraction yield or contact accuracy.\n", encoding="utf-8")
    report.chmod(0o600)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--source", choices=SOURCES, required=True)
    parser.add_argument("--namespace", required=True)
    parser.add_argument("--existing", type=Path)
    parser.add_argument("--existing-source", choices=SOURCES)
    parser.add_argument("--existing-namespace")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--city", default="New York")
    parser.add_argument("--country", default="US")
    parser.add_argument("--borough", action="append", default=[])
    parser.add_argument("--neighborhood", action="append", default=[])
    parser.add_argument("--segment", action="append", choices=tuple(SEGMENTS), default=[])
    parser.add_argument("--phrase", action="append", default=[])
    args = parser.parse_args(argv)
    os.umask(0o077)
    try:
        if not args.existing and (args.existing_source or args.existing_namespace):
            raise ValueError("Existing source options require --existing")
        incoming = read_records(args.input)
        existing = read_records(args.existing) if args.existing else []
        filters = {"city": args.city, "country": args.country, "borough": args.borough, "neighborhood": args.neighborhood, "segments": args.segment, "phrases": args.phrase}
        result = preview(incoming, existing, source=args.source, namespace=args.namespace,
                         existing_source=args.existing_source, existing_namespace=args.existing_namespace, filters=filters)
        manifest = {"preview_version": PREVIEW_VERSION, "source_sha256": hashlib.sha256(args.input.read_bytes()).hexdigest(),
                    "existing_sha256": hashlib.sha256(args.existing.read_bytes()).hexdigest() if args.existing else None,
                    "source": args.source, "namespace": args.namespace,
                    "existing_source": args.existing_source or args.source,
                    "existing_namespace": args.existing_namespace or args.namespace, "filters": filters}
        write_preview(result, args.output, manifest)
    except (ValueError, OSError) as exc:
        print(f"Preview stopped: {exc}", file=sys.stderr)
        return 2
    print(json.dumps(result["summary"], sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
