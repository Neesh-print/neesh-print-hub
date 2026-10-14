import copy
import unittest

from nns.crawler import Crawler
from nns.network import CrawlError, Response
from nns.records import metrics, reconcile

BASE = "https://shop.neesh-fixture.org"


class FixtureTransport:
    def __init__(self, pages):
        self.pages, self.calls = pages, []

    def get(self, url, delay=None):
        self.calls.append(url)
        item = self.pages.get(url, (404, "Not found", {}))
        if isinstance(item, Exception):
            raise item
        status, body, headers = item
        return Response(url, status, {"content-type": "text/plain" if url.endswith("robots.txt") else "text/html", **headers}, body)


def crawl(pages, **kwargs):
    transport = FixtureTransport({BASE + "/robots.txt": (200, "User-agent: *\nAllow: /", {}), **pages})
    return Crawler(transport, **kwargs).crawl(BASE), transport


class CrawlerTests(unittest.TestCase):
    def test_four_page_bound_and_source(self):
        links = "".join(f'<a href="/contact/{i}">Contact {i}</a>' for i in range(10))
        pages = {BASE + "/": (200, links, {})}
        pages.update({BASE + f"/contact/{i}": (200, f"info{i}@shop.neesh-fixture.org", {}) for i in range(10)})
        job, transport = crawl(pages)
        self.assertEqual(job["pages_fetched"], 4)
        self.assertEqual(len(transport.calls), 5)
        self.assertEqual(len(job["contacts"]), 3)
        self.assertTrue(all(c["evidence"][0]["source_url"].startswith(BASE) for c in job["contacts"]))
        self.assertEqual(job["billable_requests"], 0)

    def test_robots_blocks_before_homepage(self):
        job, transport = crawl({BASE + "/robots.txt": (200, "User-agent: *\nDisallow: /", {})})
        self.assertEqual(job["status"], "blocked")
        self.assertEqual(transport.calls, [BASE + "/robots.txt"])

    def test_robots_403_fail_closed(self):
        job, transport = crawl({BASE + "/robots.txt": (403, "Denied", {})})
        self.assertEqual(job["status"], "blocked")
        self.assertEqual(len(transport.calls), 1)

    def test_robots_html_fail_closed(self):
        job, _ = crawl({BASE + "/robots.txt": (200, "<html>Challenge</html>", {})})
        self.assertEqual(job["status"], "blocked")

    def test_redirect_to_private_never_requested(self):
        job, transport = crawl({BASE + "/": (302, "", {"location": "http://169.254.169.254/metadata"})})
        self.assertEqual(job["status"], "blocked")
        self.assertEqual(len(transport.calls), 2)

    def test_changed_domain_needs_review(self):
        job, transport = crawl({BASE + "/": (302, "", {"location": "https://new-shop.org"})})
        self.assertEqual(job["errors"][0]["code"], "cross_site_redirect")
        self.assertEqual(len(transport.calls), 2)

    def test_subpage_robots_checked(self):
        job, transport = crawl({BASE + "/robots.txt": (200, "User-agent: *\nDisallow: /contact", {}), BASE + "/": (200, '<a href="/contact">Contact</a>', {})})
        self.assertEqual(job["status"], "partial")
        self.assertNotIn(BASE + "/contact", transport.calls)

    def test_rate_limit_no_retry_and_keep_partial(self):
        job, transport = crawl({BASE + "/": (200, 'hello@shop.neesh-fixture.org <a href="/contact">Contact</a>', {}), BASE + "/contact": (429, "", {"retry-after": "120"})})
        self.assertEqual(job["status"], "partial")
        self.assertEqual(len(job["contacts"]), 1)
        self.assertEqual(transport.calls.count(BASE + "/contact"), 1)

    def test_request_budget_counts_robots_and_redirects(self):
        job, transport = crawl({BASE + "/": (302, "", {"location": "/about"})}, max_requests=2)
        self.assertEqual(len(transport.calls), 2)
        self.assertEqual(job["http_requests"], 2)

    def test_404_robots_permits_but_timeout_does_not(self):
        job, _ = crawl({BASE + "/robots.txt": (404, "", {}), BASE + "/": (200, "hello@shop.neesh-fixture.org", {})})
        self.assertEqual(job["status"], "completed")
        job, _ = crawl({BASE + "/robots.txt": CrawlError("timeout")})
        self.assertEqual(job["pages_fetched"], 0)

    def test_www_redirect_checks_target_robots(self):
        target = BASE.replace("https://", "https://www.")
        job, transport = crawl({BASE + "/": (301, "", {"location": target + "/"}), target + "/robots.txt": (200, "User-agent: *\nDisallow: /", {})})
        self.assertIn(target + "/robots.txt", transport.calls)
        self.assertNotIn(target + "/", transport.calls)

    def test_policy_denylist_no_http(self):
        job, transport = crawl({}, denied_hosts=["shop.neesh-fixture.org"])
        self.assertEqual(job["status"], "blocked")
        self.assertEqual(transport.calls, [])


class PreservationTests(unittest.TestCase):
    def test_preserve_conflicting_phone_and_history(self):
        record = {"id": "legacy-1", "business_name": "Synthetic Shop", "city": "NYC", "phone": "(212) 555-0111", "status_history": [{"status": "New"}], "notes": "Keep me", "manual_overrides": {"phone": True}}
        original = copy.deepcopy(record)
        job, _ = crawl({BASE + "/": (200, '<a href="tel:7185550123">Call</a><p>hello@shop.neesh-fixture.org</p>', {})})
        proposal = reconcile(record, job)
        self.assertEqual(record, original)
        self.assertEqual(proposal["original_record"], record)
        self.assertEqual(proposal["primary"]["phone"], "+12125550111")
        self.assertEqual(proposal["city"], "New York")
        discovered = next(c for c in proposal["contacts"] if c["value"] == "+17185550123")
        self.assertIn("conflicts_with_imported_phone", discovered["review_reasons"])
        self.assertEqual(reconcile(record, job), proposal)

    def test_invalid_original_phone_not_lost(self):
        record = {"id": "legacy-2", "phone": "Call front desk", "email": "broken"}
        job, _ = crawl({})
        self.assertEqual(reconcile(record, job)["original_record"], record)

    def test_suppression_and_vendor_not_primary(self):
        job, _ = crawl({BASE + "/": (200, '<a href="mailto:dev@vendor.org">Website by Studio</a>', {})})
        proposal = reconcile({"id": "x", "phone": "2125550123", "do_not_contact": "true"}, job)
        self.assertIsNone(proposal["primary"]["email"])
        self.assertFalse(proposal["outreach_eligible"])

    def test_email_coverage_separate_from_phone(self):
        job, _ = crawl({})
        rows = [reconcile({"id": "a", "phone": "2125550123"}, job), reconcile({"id": "b"}, job)]
        result = metrics(rows)
        self.assertEqual(result["coverage_percent"]["email"], 0)
        self.assertEqual(result["coverage_percent"]["email_or_phone"], 50)
        self.assertEqual(result["website_observed_contact_records"]["phone"], 0)
