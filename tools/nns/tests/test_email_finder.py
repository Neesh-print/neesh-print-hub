import unittest

from nns.worker import finder_contacts, process, research

SITE = "https://www.fixture-shop.org/"
SOURCE = {"id": "fixture", "name": "Fixture Shop", "city": "New York", "website": SITE, "original_record": {}, "fit": {"score": None}, "contacts": [], "do_not_contact": False}


class NoEmailCrawler:
    def crawl(self, url, country):
        return {"status": "completed", "contacts": [], "site_signals": [], "finished_at": "2026-10-15T00:00:00Z", "http_requests": 2, "pages_fetched": 1, "errors": []}


class EmailCrawler(NoEmailCrawler):
    def crawl(self, url, country):
        job = super().crawl(url, country)
        job["contacts"] = [{"kind": "email", "value": "hello@fixture-shop.org", "extension": None, "quality_status": "observed_on_website", "review_reasons": [], "evidence": [{"source_url": url, "observed_at": "2026-10-15", "extract_method": "mailto"}]}]
        return job


class Broker:
    def __init__(self, found=None, jobs=None, lookup=None):
        self.found, self.jobs, self.lookup, self.calls = found, jobs or [], lookup, []

    def call(self, action, **kwargs):
        self.calls.append((action, kwargs))
        if action == "find_emails": return self.found
        if action == "lookup_website": return self.lookup
        if action == "claim": return self.jobs
        if action == "place_budget": return True
        if action == "finish": return None


HUNTER = {"emails": [
    {"value": "Maya@fixture-shop.org", "first_name": "Maya", "last_name": "Lee", "position": "Owner", "confidence": 94, "verification": "valid", "source": "https://fixture-shop.org/team"},
    {"value": "orders@other-domain.com", "confidence": 40},
    {"value": "not an email"},
]}


class EmailFinderTests(unittest.TestCase):
    def test_finder_emails_need_review_and_carry_who_found_them(self):
        broker = Broker(HUNTER)
        result = research(SOURCE, crawler=NoEmailCrawler(), email_finder=lambda w: finder_contacts(broker, w))
        self.assertEqual(broker.calls, [("find_emails", {"domain": "fixture-shop.org"})])
        emails = {c["value"]: c for c in result["contacts"] if c["kind"] == "email"}
        self.assertEqual(set(emails), {"maya@fixture-shop.org", "orders@other-domain.com"})
        maya = emails["maya@fixture-shop.org"]
        self.assertEqual(maya["quality_status"], "found_by_email_finder")
        self.assertIn("found_by_email_finder", maya["review_reasons"])
        self.assertFalse(maya["is_primary"])  # third-party finds are never auto-primary
        self.assertEqual(maya["person_name"], "Maya Lee")
        self.assertIn("Owner", maya["evidence"][0]["excerpt_or_signal"])
        self.assertIn("94% confidence", maya["evidence"][0]["excerpt_or_signal"])
        self.assertIn("different_mail_domain", emails["orders@other-domain.com"]["review_reasons"])

    def test_finder_not_called_when_site_shows_an_email(self):
        broker = Broker(HUNTER)
        research(SOURCE, crawler=EmailCrawler(), email_finder=lambda w: finder_contacts(broker, w))
        self.assertEqual(broker.calls, [])

    def test_finder_not_set_up_stops_asking(self):
        broker = Broker({"unavailable": True})
        self.assertEqual(finder_contacts(broker, SITE), [])
        self.assertEqual(finder_contacts(broker, SITE), [])
        self.assertEqual(len(broker.calls), 1)

    def test_out_of_credits_stops_asking(self):
        broker = Broker({"limit_reached": True})
        finder_contacts(broker, SITE); finder_contacts(broker, SITE)
        self.assertEqual(len(broker.calls), 1)

    def test_listing_phone_kept_when_no_website_exists(self):
        lookup = {"google": {"candidates": [{"name": "Corner News", "website": None, "phone": "(212) 555-0142", "source_url": "https://www.google.com/maps/place/?q=place_id:x", "types": ["store"]}]}}
        job = {"id": "job", "lease": "lease", "kind": "research", "source": {**SOURCE, "name": "Corner News", "website": None}}
        broker = Broker(jobs=[job], lookup=lookup)
        process(broker, place_fetch=lambda q: [])
        payload = [k for a, k in broker.calls if a == "finish"][0]["payload"]
        phones = [c for c in payload["contacts"] if c["kind"] == "phone"]
        self.assertEqual(len(phones), 1)
        self.assertIn("website_identity_needs_review", phones[0]["review_reasons"])
        self.assertTrue(any("Phone from a map listing" in u for u in payload["fit"]["uncertainties"]))
        self.assertNotIn("find_emails", [a for a, _ in broker.calls])  # no website, no domain to search


if __name__ == "__main__":
    unittest.main()
