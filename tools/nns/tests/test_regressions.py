import subprocess
import unittest
from unittest.mock import patch

from nns.contacts import extract_contacts
from nns.network import CrawlError, Resolver, Robots
from nns.records import reconcile
from test_crawler import BASE, crawl


class RegressionTests(unittest.TestCase):
    def test_multiple_emails_are_not_assigned_to_a_location_by_alphabetical_order(self):
        job, _ = crawl({BASE + "/": (200, '<p>Branch A: alpha@shop.neesh-fixture.org</p><p>Branch B: beta@shop.neesh-fixture.org</p>', {})})
        result = reconcile({"id": "a", "name": "Branch B"}, job)
        self.assertIsNone(result["primary"]["email"])
        self.assertTrue(all("multiple_business_or_location_candidates" in c["review_reasons"] for c in result["contacts"]))
        sticky = reconcile({"id": "a", "email": "beta@shop.neesh-fixture.org"}, job)
        self.assertEqual(sticky["primary"]["email"], "beta@shop.neesh-fixture.org")

    def test_malformed_page_markup_does_not_abort_batch(self):
        html = '<script type>var x = 1;</script><a href="http://[">broken contact</a><script type="application/ld+json">{"@type":[{}]}</script><p>hello@shop.neesh-fixture.org</p>'
        job, _ = crawl({BASE + "/": (200, html, {})})
        self.assertEqual(job["status"], "completed")
        self.assertEqual(job["contacts"][0]["value"], "hello@shop.neesh-fixture.org")

    def test_malformed_redirect_is_a_job_failure(self):
        job, _ = crawl({BASE + "/": (301, "", {"location": "http://["})})
        self.assertIn(job["status"], {"failed", "blocked"})
        self.assertEqual(job["errors"][0]["code"], "unsafe_url")

    def test_encoded_paths_cannot_bypass_robots(self):
        robots = Robots("User-agent: *\nDisallow: /contact\nDisallow: /café")
        self.assertFalse(robots.allowed(BASE + "/%63ontact"))
        self.assertFalse(robots.allowed(BASE + "/caf%C3%A9"))

    def test_resolver_hard_deadline(self):
        with patch("subprocess.run", side_effect=subprocess.TimeoutExpired("dns", 8)):
            with self.assertRaises(CrawlError) as ctx:
                Resolver().resolve("slow.fixture.org")
        self.assertEqual(ctx.exception.code, "dns_failed")

    def test_parent_domain_denylist_applies_to_subdomains(self):
        job, transport = crawl({}, denied_hosts=["neesh-fixture.org"])
        self.assertEqual(job["status"], "blocked")
        self.assertEqual(transport.calls, [])

    def test_multiple_phones_without_known_location_need_review(self):
        job, _ = crawl({BASE + "/": (200, "<p>NYC (212)555-0123</p><p>Other location (718)555-0123</p>", {})})
        result = reconcile({"id": "a"}, job)
        self.assertIsNone(result["primary"]["phone"])
        self.assertEqual(len(result["contacts"]), 2)
        self.assertTrue(all("multiple_business_or_location_candidates" in c["review_reasons"] for c in result["contacts"]))

    def test_imported_phone_extension_is_not_overwritten(self):
        job, _ = crawl({BASE + "/": (200, '<a href="tel:2125550123;ext=99">Call</a>', {})})
        result = reconcile({"id": "a", "phone": "(212)555-0123 x42"}, job)
        primary = next(c for c in result["contacts"] if c["is_primary"])
        self.assertEqual(primary["extension"], "42")
        alternate = next(c for c in result["contacts"] if not c["is_primary"])
        self.assertIn("conflicts_with_imported_phone", alternate["review_reasons"])

    def test_imported_vendor_address_is_not_website_confirmed_for_scoring(self):
        job, _ = crawl({BASE + "/": (200, '<a href="mailto:dev@vendor.org">Website by Vendor</a>', {})})
        result = reconcile({"id": "a", "email": "dev@vendor.org"}, job)
        self.assertEqual(result["primary"]["email"], "dev@vendor.org")
        self.assertEqual(result["observed_contact_score"], 0)

    def test_no_reply_retained_but_not_selected_for_outreach(self):
        job, _ = crawl({BASE + "/": (200, "noreply@shop.neesh-fixture.org", {})})
        result = reconcile({"id": "a"}, job)
        self.assertIsNone(result["primary"]["email"])
        self.assertEqual(len(result["contacts"]), 1)
