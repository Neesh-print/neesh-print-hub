"""One bounded job per website. Always return partial evidence on failures."""
from __future__ import annotations

import hashlib
import re
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urljoin as _urljoin, urlsplit, urlunsplit

from .contacts import extract_contacts
from .network import CrawlError, CurlTransport, Robots, normalize_url, site_key

CONTACT_PATH = re.compile(r"contact|about|team|visit|location|stockist|wholesale|store|shop|imprint", re.I)
SKIP_PATH = re.compile(r"\.(?:pdf|jpg|jpeg|gif|png|zip|webp|mp4|svg|css|js)$|/(?:cart|checkout|account|login|search|feed)(?:/|$)", re.I)
PROHIBITION = re.compile(r"(?:scraping|automated (?:access|collection)|web crawlers?) (?:is |are )?(?:prohibited|not permitted|forbidden)", re.I)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def urljoin(base: str, target: str) -> str:
    try:
        return _urljoin(base, target)
    except ValueError as exc:
        raise CrawlError("unsafe_url") from exc


class Crawler:
    def __init__(self, transport=None, *, max_pages=4, max_requests=20, max_seconds=150, denied_hosts=(), evidence_dir=None):
        if not 1 <= max_pages <= 4 or not 1 <= max_requests <= 24 or not 1 <= max_seconds <= 240:
            raise ValueError("Crawl limits exceed the pilot policy")
        self.transport = transport or CurlTransport()
        self.max_pages, self.max_requests, self.max_seconds = max_pages, max_requests, max_seconds
        self.denied_hosts = {x.lower().removeprefix("www.") for x in denied_hosts}
        self.evidence_dir = evidence_dir

    def crawl(self, website: str, country="US") -> dict:
        started = now_iso()
        deadline = time.monotonic() + self.max_seconds
        job = {"website": website, "started_at": started, "finished_at": None, "status": "pending", "contacts": [], "pages": [], "errors": [], "http_requests": 0, "dns_requests": 0, "billable_requests": 0, "additional_cost_usd": 0, "pages_fetched": 0, "site_signals": [], "next_eligible_at": None, "policy": {"max_pages": self.max_pages, "max_requests": self.max_requests, "robots": "required", "terms": "explicit prohibitions and operator denylist; not a legal audit"}}
        dns_before = getattr(getattr(self.transport, "resolver", None), "requests", 0)
        http_before = getattr(self.transport, "requests", 0)
        robots_by_origin: dict[str, Robots] = {}
        attempts = 0

        def request(url, delay=1):
            nonlocal attempts
            if attempts >= self.max_requests:
                raise CrawlError("request_budget_exhausted")
            if time.monotonic() >= deadline:
                raise CrawlError("job_timeout")
            if delay > 30:
                raise CrawlError("crawl_delay_requires_scheduling")
            attempts += 1
            result = self.transport.get(url, delay=delay)
            if time.monotonic() >= deadline:
                raise CrawlError("job_timeout")
            return result

        def scope(url):
            url = normalize_url(url)
            if site_key(url) != root_key:
                raise CrawlError("cross_site_redirect", "Review changed website ownership before following.")
            if urlsplit(seed).scheme == "https" and urlsplit(url).scheme != "https":
                raise CrawlError("insecure_redirect")
            return url

        def policy(url):
            p = urlsplit(url)
            origin = urlunsplit((p.scheme, p.netloc, "", "", ""))
            if origin not in robots_by_origin:
                robot_url, seen = origin + "/robots.txt", set()
                for _ in range(4):
                    robot_url = scope(robot_url)
                    if robot_url in seen:
                        raise CrawlError("robots_redirect_loop")
                    seen.add(robot_url)
                    res = request(robot_url)
                    if res.status in {301, 302, 303, 307, 308}:
                        if not res.headers.get("location"):
                            raise CrawlError("robots_unavailable")
                        robot_url = urljoin(robot_url, res.headers["location"])
                        continue
                    if res.status in {404, 410}:
                        robots_by_origin[origin] = Robots("")
                    elif res.status == 200:
                        if re.search(r"<\s*(?:html|!doctype|script)|captcha|just a moment|access denied", res.body[:1500], re.I):
                            raise CrawlError("robots_unavailable")
                        robots_by_origin[origin] = Robots(res.body)
                    elif res.status == 429:
                        raise CrawlError("rate_limited", res.headers.get("retry-after", ""))
                    else:
                        raise CrawlError("robots_unavailable", str(res.status))
                    break
                else:
                    raise CrawlError("robots_redirect_limit")
            return robots_by_origin[origin]

        def page(url):
            visited = set()
            for _ in range(4):
                url = scope(url)
                if url in visited:
                    raise CrawlError("redirect_loop")
                visited.add(url)
                robots = policy(url)
                if not robots.allowed(url):
                    raise CrawlError("robots_disallowed")
                res = request(url, robots.delay)
                if res.status in {301, 302, 303, 307, 308}:
                    if not res.headers.get("location"):
                        raise CrawlError("invalid_redirect")
                    url = urljoin(url, res.headers["location"])
                    continue
                if res.status == 429:
                    raise CrawlError("rate_limited", res.headers.get("retry-after", ""))
                if res.status in {401, 403}:
                    raise CrawlError("access_blocked", str(res.status))
                if res.status >= 500:
                    # One bounded retry for a transient server error; no paid fallback.
                    res = request(url, max(2, robots.delay))
                if res.status == 429:
                    raise CrawlError("rate_limited", res.headers.get("retry-after", ""))
                if res.status in {401, 403}:
                    raise CrawlError("access_blocked", str(res.status))
                if not 200 <= res.status < 300:
                    raise CrawlError("http_error", str(res.status))
                if not any(t in res.headers.get("content-type", "").lower() for t in ("text/html", "application/xhtml+xml", "text/plain")):
                    raise CrawlError("unsupported_content_type")
                if re.search(r"<title>\s*(?:just a moment|access denied|attention required|verify you are human)", res.body[:5000], re.I):
                    raise CrawlError("access_blocked")
                return res
            raise CrawlError("redirect_limit")

        try:
            seed = normalize_url(website)
            root_key = site_key(seed)
            if any(root_key == d or root_key.endswith("." + d) for d in self.denied_hosts):
                raise CrawlError("policy_denied")
            p = urlsplit(seed)
            homepage = urlunsplit((p.scheme, p.netloc, "/", "", ""))
            queue, seen, contacts = [homepage], set(), {}
            if seed != homepage:
                queue.append(seed)
            while queue and len(seen) < self.max_pages:
                url = queue.pop(0)
                if url in seen:
                    continue
                seen.add(url)
                try:
                    response = page(url)
                    # Two chosen URLs can redirect to one page; do not add it twice.
                    if response.url in {p["source_url"] for p in job["pages"]}:
                        continue
                    parsed = extract_contacts(response.body, response.url, started, country)
                    if PROHIBITION.search(parsed["text"]):
                        raise CrawlError("policy_denied")
                    job["pages_fetched"] += 1
                    job["pages"].append({"source_url": response.url, "status": response.status, "content_hash": parsed["content_hash"], "text_characters": len(parsed["text"]), "checked_at": started})
                    job["site_signals"].append({"source_url": response.url, "text": parsed["text"][:30000], "content_hash": parsed["content_hash"]})
                    if self.evidence_dir:
                        self.evidence_dir.mkdir(parents=True, exist_ok=True)
                        path = self.evidence_dir / (parsed["content_hash"] + ".html")
                        path.write_text(response.body, encoding="utf-8")
                        path.chmod(0o600)
                    for contact in parsed["contacts"]:
                        key = (contact["kind"], contact["value"], contact["extension"])
                        if key in contacts:
                            contacts[key]["evidence"].extend(contact["evidence"])
                            contacts[key]["review_reasons"] = sorted(set(contacts[key]["review_reasons"]) & set(contact["review_reasons"]))
                        else:
                            contacts[key] = contact
                    candidates = []
                    for link in parsed["links"]:
                        try:
                            target = scope(urljoin(response.url, link["url"]))
                        except CrawlError:
                            continue
                        path = urlsplit(target).path
                        if CONTACT_PATH.search(path + " " + link["text"]) and not SKIP_PATH.search(path) and target not in seen and target not in queue:
                            rank = 0 if re.search("contact", path + link["text"], re.I) else 1 if re.search("about|team|visit|location", path + link["text"], re.I) else 2
                            candidates.append((rank, len(path), target))
                    queue.extend(x[2] for x in sorted(set(candidates)))
                except CrawlError as exc:
                    job["errors"].append({"source_url": url, "code": exc.code, "detail": exc.detail})
                    if not job["pages"] or exc.code in {"rate_limited", "access_blocked", "policy_denied", "unsafe_destination", "request_budget_exhausted", "job_timeout"}:
                        break
            job["contacts"] = list(contacts.values())
            codes = {x["code"] for x in job["errors"]}
            if job["pages"]:
                job["status"] = "partial" if codes else "completed"
            elif codes & {"robots_disallowed", "robots_unavailable", "rate_limited", "access_blocked", "policy_denied", "cross_site_redirect", "crawl_delay_requires_scheduling", "unsafe_destination"}:
                job["status"] = "blocked"
            else:
                job["status"] = "failed"
        except CrawlError as exc:
            job["status"] = "blocked" if exc.code in {"policy_denied", "excluded_provider", "unsafe_destination", "unsafe_url"} else "failed"
            job["errors"].append({"source_url": website, "code": exc.code, "detail": exc.detail})
        job["request_attempts"] = attempts
        job["http_requests"] = getattr(self.transport, "requests", http_before + attempts) - http_before
        job["dns_requests"] = getattr(getattr(self.transport, "resolver", None), "requests", 0) - dns_before
        job["finished_at"] = now_iso()
        # Blocked sites require an explicit reviewed override; failures cool down.
        if job["status"] != "blocked":
            days = 1 if job["status"] == "failed" else 30
            job["next_eligible_at"] = (datetime.fromisoformat(started) + timedelta(days=days)).isoformat()
        return job
