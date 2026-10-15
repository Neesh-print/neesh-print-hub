"""Pure contact reconciliation: preserve originals, append evidence, never write DB."""
from __future__ import annotations

import copy
import re
import hashlib
import json
from collections import Counter

from .contacts import contact_rank, email_role, email_value, instagram_value, phone_value


def is_suppressed(record: dict) -> bool:
    if any(str(record.get(key, "")).strip().lower() in {"true", "1", "yes"} for key in ("do_not_contact", "opted_out", "suppressed", "unsubscribed")):
        return True
    return any(str(record.get(key, "")).lower().strip() in {"do not contact", "do_not_contact", "unsubscribed", "opted out", "opt_out", "suppressed"} for key in ("status", "stage"))


_BUYING = re.compile(r"store|shop|book|retail|buy|wholesale|trade|stockist|magazine|zine|print|merch", re.I)
_GENERAL = frozenset("hello info contact sales orders general team office welcome studio enquiries inquiries".split())
_DEPARTMENT = re.compile(r"^(press|media|pr|development|donat|member|ticket|rights|webmaster|career|jobs|hr|privacy|legal|access|director|education|volunteer|rsvp|events?|booking|reservations?|accounting|billing|invoice|finance|support|service|help|customer)", re.I)


def relevance(contact: dict, name: str) -> int:
    """Lower is better. Puts the address a buyer would answer above department inboxes."""
    reasons = set(contact.get("review_reasons") or [])
    if contact["kind"] != "email":
        return (0 if contact.get("is_primary") else 1) + (2 if reasons else 0)
    if "different_mail_domain" in reasons or "non_reply_address" in reasons:
        return 6
    local = contact["value"].split("@")[0].casefold()
    words = {w for w in re.findall(r"[a-z0-9]+", (name or "").casefold()) if len(w) > 3}
    if _BUYING.search(local) or any(w in local for w in words):
        return 0
    if local.split(".")[0] in _GENERAL:
        return 1
    if _DEPARTMENT.match(local):
        return 4
    return 2  # A person's name or unknown inbox: may be right, needs a look.


def normalized_city(raw: str) -> str:
    return "New York" if raw.strip().lower() in {"nyc", "new york city", "new york", "manhattan", "brooklyn", "queens", "bronx", "the bronx", "staten island"} else raw.strip()


def reconcile(record: dict, crawl: dict) -> dict:
    """Build a proposal; sticky source fields are NEVER mutated in place."""
    original = copy.deepcopy(record)
    identifier = str(record.get("id") or record.get("legacy_id") or "")
    if not identifier:
        raise ValueError("A stable id is required for preservation and idempotence")
    contacts: dict[tuple, dict] = {}
    country = record.get("country") or "US"
    existing_primary = {}

    def imported(kind, raw, is_primary=False):
        if not isinstance(raw, str) or not raw.strip():
            return
        ext = None
        if kind == "phone":
            parsed = phone_value(raw, country)
            value, ext = parsed if parsed else (None, None)
        elif kind == "email":
            value = email_value(raw)
        else:
            value = instagram_value(raw if "/" in raw else "https://instagram.com/" + raw.lstrip("@"))
        if not value:
            return  # Raw invalid values remain in original_record, with no loss.
        key = (kind, value, ext)
        contacts[key] = {"kind": kind, "value": value, "extension": ext, "role_type": email_role(value) if kind == "email" else None, "quality_status": "imported_unconfirmed", "manual_override": bool(record.get("manual_overrides", {}).get(kind)) if isinstance(record.get("manual_overrides"), dict) else False, "review_reasons": [], "evidence": [], "raw_imported_value": raw}
        if is_primary:
            existing_primary[kind] = key

    imported("email", record.get("email"), True)
    imported("phone", record.get("phone"), True)
    imported("instagram", record.get("instagram_handle") or record.get("instagram_url"), True)
    additional = record.get("additional_contacts") or []
    if isinstance(additional, str):
        try:
            additional = json.loads(additional)
        except ValueError:
            additional = []
    if isinstance(additional, list):
        for value in additional:
            imported("email", value)
    for candidate in crawl.get("contacts", []):
        new = copy.deepcopy(candidate)
        key = (new["kind"], new["value"], new.get("extension"))
        if key in contacts:
            contacts[key]["quality_status"] = "observed_on_website"
            contacts[key]["evidence"].extend(new.get("evidence", []))
            contacts[key]["review_reasons"] = sorted(set(contacts[key].get("review_reasons", [])) | set(new.get("review_reasons", [])))
        else:
            if new["kind"] == "phone" and "phone" in existing_primary and key != existing_primary["phone"]:
                new["review_reasons"] = sorted(set(new.get("review_reasons", [])) | {"conflicts_with_imported_phone"})
            new["manual_override"] = False
            contacts[key] = new
    for kind in ("email", "phone", "instagram"):
        candidates = [c for c in contacts.values() if c["kind"] == kind and (kind != "email" or not c.get("review_reasons"))]
        if kind not in existing_primary and len(candidates) > 1:
            for candidate in candidates:
                candidate["review_reasons"] = sorted(set(candidate.get("review_reasons", [])) | {"multiple_business_or_location_candidates"})
    primary = {}
    for kind in ("email", "phone", "instagram"):
        if kind in existing_primary:
            primary[kind] = contacts[existing_primary[kind]]
        else:
            eligible = [v for v in contacts.values() if v["kind"] == kind and not v.get("review_reasons")]
            primary[kind] = sorted(eligible, key=contact_rank)[0] if eligible else None
    for key, contact in contacts.items():
        contact["id"] = hashlib.sha256(json.dumps([identifier, *key], separators=(",", ":")).encode()).hexdigest()[:32]
        contact["is_primary"] = contact is primary.get(contact["kind"])
        contact["last_checked_at"] = crawl.get("finished_at")
        contact["last_seen_at"] = max((e["observed_at"] for e in contact["evidence"]), default=None)
        contact["evidence"] = list({json.dumps(e, sort_keys=True): e for e in contact["evidence"]}.values())
        contact["relevance"] = relevance(contact, record.get("business_name") or record.get("name") or "")
    suppressed = is_suppressed(record)
    score = sum(weight for kind, weight in (("email", 60), ("phone", 30), ("instagram", 10)) if primary[kind])
    observed_score = sum(weight for kind, weight in (("email", 60), ("phone", 30), ("instagram", 10)) if primary[kind] and primary[kind]["quality_status"] == "observed_on_website" and not primary[kind].get("review_reasons"))
    return {"id": identifier, "name": record.get("business_name") or record.get("name"), "city": normalized_city(record.get("city") or ""), "borough": record.get("borough") or (record.get("city") if str(record.get("city", "")).lower() in {"brooklyn", "queens", "bronx", "manhattan", "staten island"} else None), "neighborhood": record.get("neighborhood"), "website": record.get("website"), "do_not_contact": suppressed, "original_record": original, "contacts": sorted(contacts.values(), key=lambda c: (c["kind"], contact_rank(c))), "primary": {k: v["value"] if v else None for k, v in primary.items()}, "contact_score": score, "observed_contact_score": observed_score, "outreach_eligible": not suppressed and score > 0, "job": {k: copy.deepcopy(v) for k, v in crawl.items() if k not in {"contacts", "site_signals"}}}


def metrics(rows: list[dict]) -> dict:
    total = len(rows)
    before = {"email": 0, "phone": 0, "instagram": 0, "email_or_phone": 0}
    after = dict(before)
    observed = dict(before)
    for row in rows:
        raw = row["original_record"]
        ig = raw.get("instagram_handle") or raw.get("instagram_url") or ""
        checks = {"email": bool(email_value(raw.get("email") or "")), "phone": bool(phone_value(raw.get("phone") or "", raw.get("country") or "US")), "instagram": bool(instagram_value(ig if "/" in ig else "https://instagram.com/" + ig.lstrip("@")))}
        checks["email_or_phone"] = checks["email"] or checks["phone"]
        new = {k: bool(row["primary"].get(k)) for k in ("email", "phone", "instagram")}
        new["email_or_phone"] = new["email"] or new["phone"]
        seen = {k: any(c["kind"] == k and c["quality_status"] == "observed_on_website" and not c.get("review_reasons") for c in row["contacts"]) for k in ("email", "phone", "instagram")}
        seen["email_or_phone"] = seen["email"] or seen["phone"]
        for k in before:
            before[k] += checks[k]
            after[k] += new[k]
            observed[k] += seen[k]
    return {"prospects": total, "baseline_contact_records": before, "retained_plus_accepted_contact_records": after, "website_observed_contact_records": observed, "coverage_percent": {k: round(100 * v / total, 1) if total else 0 for k, v in after.items()}, "crawl_status": dict(Counter(r["job"]["status"] for r in rows)), "error_codes": dict(Counter(e["code"] for r in rows for e in r["job"].get("errors", []))), "records_with_candidates_needing_review": sum(any(c.get("review_reasons") for c in r["contacts"]) for r in rows), "suppressed_records": sum(r["do_not_contact"] for r in rows), "accuracy": {"status": "not_measured_until_source_audit", "deliverability_verified": False}, "billable_requests": 0, "additional_cost_usd": 0}
