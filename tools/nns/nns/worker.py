"""GitHub-hosted queue runner. Never prints prospect data or credentials."""
from __future__ import annotations

import copy
import json
import os
import re
import sys
import urllib.parse
import urllib.request

from .crawler import Crawler, now_iso
from .network import CurlTransport, CrawlError, normalize_url, site_key
from .places import PlaceError, fetch_places, query, record, unique_website
from .providers import choose as choose_provider_candidate, clean_url
from .qualification import assess
from .records import reconcile, normalized_city


class Broker:
    def __init__(self):
        self.url = os.environ["NUSTAND_BROKER_URL"]
        if self.url != "https://smfzrubkyxejzkblrrjr.supabase.co/functions/v1/nustand-worker":
            raise ValueError("Invalid research broker")

    def token(self):
        url = os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"]
        p = urllib.parse.urlsplit(url)
        if p.scheme != "https" or not p.hostname.endswith(".actions.githubusercontent.com") or p.username or p.password:
            raise ValueError("Invalid workflow identity endpoint")
        url += ("&" if p.query else "?") + "audience=nustand-research"
        request = urllib.request.Request(url, headers={"Authorization": "Bearer " + os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]})
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.loads(response.read(20000))["value"]

    def call(self, action, **kwargs):
        payload = json.dumps({"action": action, **kwargs}).encode()
        if len(payload) > 600000:
            raise ValueError("Research payload exceeds limit")
        request = urllib.request.Request(self.url, data=payload, headers={"Authorization": "Bearer " + self.token(), "Content-Type": "application/json"})
        with urllib.request.urlopen(request, timeout=20) as response:
            body = response.read(1000001)
        if len(body) > 1000000:
            raise ValueError("Research batch exceeds limit")
        return json.loads(body)["data"]


def research(source, candidate=None, lookup_error=None, crawler=None):
    raw = copy.deepcopy(source.get("original_record", {}))
    raw.update(id=source["id"], name=source["name"], city=source.get("city") or "")
    website = source.get("website") or (candidate or {}).get("website")
    if website:
        website = clean_url(website)  # Drop listing tracking tags before crawling and saving.
    raw["website"] = website
    needs_identity_review = bool(source.get("website_identity_review")) or bool(candidate) or bool(source.get("discovery") and source.get("website_source") != "owner_supplied")
    if candidate:
        for key in ("email", "phone", "instagram_handle", "business_type"):
            if not raw.get(key): raw[key] = candidate["original_record"].get(key)
    if website:
        crawl = (crawler or Crawler(CurlTransport(max_bytes=3_000_000), max_requests=16, max_seconds=40)).crawl(website, raw.get("country") or "US")
    else:
        crawl = {"status": "failed" if lookup_error else "needs_website", "contacts": [], "site_signals": [], "finished_at": now_iso(), "errors": [{"code": lookup_error or "website_not_found_in_open_data"}], "http_requests": 0, "pages_fetched": 0}
    result = reconcile(raw, crawl)
    fit = assess(raw, crawl.get("site_signals", []))
    if not fit.get("segment"):
        fit["segment"] = source.get("fit", {}).get("segment")
    if needs_identity_review:
        fit["uncertainties"].append("Website matched by name from a published source; confirm this physical location.")
        for contact in result["contacts"]:
            contact["review_reasons"] = sorted(set(contact.get("review_reasons", [])) | {"website_identity_needs_review"})
            contact["is_primary"] = False
    discovery = (candidate or {}).get("discovery", {})
    source_url = discovery.get("source_url") or raw.get("source_url")
    label = discovery.get("source_label") or "OpenStreetMap"
    if source_url:
        for contact in result["contacts"]:
            if contact.get("raw_imported_value"):
                contact["evidence"].append({"source_url":source_url,"extract_method":"provider_place_data" if discovery.get("provider") else "open_place_data","observed_at":now_iso(),"excerpt_or_signal":f"Business contact listed in {label}; not website verified."})
    contacts = result["contacts"][:100]
    if len(result["contacts"]) > 100:
        fit["uncertainties"].append("Contact candidate limit reached; review the site manually.")
    return {"status":crawl["status"], "contacts":contacts, "fit":fit, "job":result["job"], "website":website, "website_identity_review":needs_identity_review, "website_source":source_url or source.get("website_source") or "supplied_website", "contact_score":result["contact_score"], "requests":crawl.get("http_requests",0), "pages":crawl.get("pages_fetched",0), "error":lookup_error or (crawl.get("errors", [{}])[0].get("code") if crawl.get("errors") else None)}


def published_website(source, cache, source_crawler=None):
    sources=source.get("website_lookup_sources") or []
    if not sources: return None,0
    source_url=sources[0]["source_url"]
    requests=0
    if source_url not in cache:
        result=(source_crawler or Crawler(CurlTransport(),max_pages=2,max_requests=8,max_seconds=20,capture_links=True)).crawl(source_url)
        cache[source_url]=result
        requests=result["http_requests"]
    targets={}
    name=source["name"].strip().casefold()
    for link in cache[source_url].get("published_links",[]):
        text=link["text"].strip().casefold()
        if not re.fullmatch(re.escape(name)+r'(?:,?\s+(?:new york|nyc|manhattan|brooklyn|queens))?',text):continue
        try: target=normalize_url(link["url"])
        except CrawlError:continue
        if site_key(target)==site_key(source_url):continue
        targets[target]=link["source_url"]
    if len(targets)!=1:return None,requests
    target=next(iter(targets))
    return {"website":target,"original_record":{},"discovery":{"source_url":targets[target]}},requests


def process(broker, place_fetch=fetch_places, crawler=None):
    site_crawler=crawler or Crawler(CurlTransport(max_bytes=3_000_000),max_requests=16,max_seconds=40)
    source_crawler=Crawler(site_crawler.transport,max_pages=2,max_requests=8,max_seconds=20,capture_links=True) if isinstance(site_crawler,Crawler) else None
    jobs = broker.call("claim")
    if not isinstance(jobs,list) or len(jobs)>10: raise ValueError("Invalid research batch")
    missing = [j for j in jobs if j["kind"] == "research" and not j["source"].get("website") and normalized_city(j["source"].get("city") or "") == "New York"]
    elements, lookup_error, lookup_requests = [], None, 0
    if missing:
        if broker.call("place_budget"):
            lookup_requests = 1
            try: elements = place_fetch(query(names=[j["source"]["name"][:200] for j in missing]))
            except PlaceError: lookup_error = "place_lookup_unavailable"
        else: lookup_error = "daily_place_lookup_limit"
    completed = 0
    source_cache={}
    for job in jobs:
        if job["kind"] == "discovery":
            discovery_requests=0
            try:
                if not broker.call("place_budget"): raise PlaceError("Daily place lookup limit reached")
                discovery_requests=1
                found = place_fetch(query(**job["input"]))
                candidates = [r for e in found if (r := record(e,job["input"]["segment"]))]
                result = {"status":"completed","candidates":candidates,"attribution":"© OpenStreetMap contributors, ODbL","requests":1,"pages":0}
            except PlaceError:
                result = {"status":"failed","error":"Place discovery unavailable or daily limit reached","requests":discovery_requests,"pages":0}
        else:
            candidate,source_requests=published_website(job["source"],source_cache,source_crawler) if job in missing else (None,0)
            candidate = candidate or (unique_website(job["source"]["name"],elements) if job in missing else None)
            provider_summary, job_error = None, lookup_error
            if job in missing and not candidate:
                # Paid lookups run inside the broker, which holds the keys and the daily cap.
                try: lookup = broker.call("lookup_website", name=job["source"]["name"][:200])
                except Exception: lookup = None
                candidate, provider_summary = choose_provider_candidate(job["source"]["name"], lookup if isinstance(lookup, dict) else None)
                if candidate is None and isinstance(lookup, dict) and lookup.get("budget_exhausted"):
                    job_error = job_error or "daily_provider_lookup_limit"
            result = research(job["source"],candidate,job_error if job in missing and not candidate else None,site_crawler)
            if provider_summary is not None:
                result["provider_lookup"] = provider_summary
            result["requests"]+=source_requests
            if missing and job["id"]==missing[0]["id"]: result["requests"]+=lookup_requests
        broker.call("finish",job_id=job["id"],lease=job["lease"],payload=result)
        completed += 1
    return completed


def main():
    try:
        count = process(Broker())
        print(f"Processed {count} Nustand jobs. No outreach sent.")
        return 0
    except Exception:
        # Responses and stack traces can contain private inputs or credentials.
        print("Research worker stopped. Check the private Nustand job status.",file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
