import unittest
from nns.providers import choose, names_match
from nns.worker import process

FSQ = {"name": "McNally Jackson Books", "website": "https://www.mcnallyjackson.com", "phone": "(718) 555-0100", "source_url": "https://foursquare.com/v/abc"}
GOOGLE = {"name": "McNally Jackson Books", "website": "https://www.mcnallyjackson.com/", "source_url": "https://www.google.com/maps/place/?q=place_id:xyz"}


class NameMatchTests(unittest.TestCase):
    def test_branch_suffix_and_extra_word(self):
        self.assertTrue(names_match("McNally Jackson - Downtown Brooklyn", "McNally Jackson Books"))

    def test_ampersand_and_punctuation(self):
        self.assertTrue(names_match("Sid Mashburn & Ann Mashburn", "Sid Mashburn and Ann Mashburn"))
        self.assertTrue(names_match("Fugazi", "FUGAZI"))

    def test_different_business_rejected(self):
        self.assertFalse(names_match("Home Archive", "Home Depot"))
        self.assertFalse(names_match("Varick News", "Varick Street Deli and Grocery Market"))
        self.assertFalse(names_match("The Core Club", "Core Power Yoga"))

    def test_branch_descriptor_without_dash(self):
        self.assertTrue(names_match("Books Are Magic Montague St", "Books Are Magic"))
        self.assertFalse(names_match("Times Square News", "Times Square"))  # one distinctive word is too weak
        self.assertFalse(names_match("Spring News International", "Spring"))

    def test_generic_words_alone_never_match(self):
        self.assertFalse(names_match("The Shop", "Brooklyn Shop"))


class ChooseTests(unittest.TestCase):
    def test_prefers_foursquare_and_records_both(self):
        candidate, summary = choose("McNally Jackson - Downtown Brooklyn", {"foursquare": {"candidates": [FSQ]}, "google": {"candidates": [GOOGLE]}})
        self.assertEqual(candidate["discovery"]["provider"], "foursquare")
        self.assertEqual(candidate["original_record"]["phone"], "(718) 555-0100")
        self.assertEqual(summary["google"]["website"], "https://www.mcnallyjackson.com/")

    def test_conflicting_websites_are_ambiguous(self):
        other = {**FSQ, "website": "https://elsewhere.example"}
        candidate, summary = choose("McNally Jackson", {"foursquare": {"candidates": [FSQ, other]}})
        self.assertIsNone(candidate)
        self.assertTrue(summary["foursquare"]["ambiguous"])

    def test_branches_on_one_domain_are_not_ambiguous(self):
        rows = [{"name": "McNally Jackson Books", "website": "https://www.mcnallyjackson.com/pages/seaport"}, {"name": "McNally Jackson", "website": "https://mcnallyjackson.com/"}]
        candidate, summary = choose("McNally Jackson - Downtown Brooklyn", {"google": {"candidates": rows}})
        self.assertEqual(candidate["website"], "https://mcnallyjackson.com/")
        self.assertFalse(summary["google"]["ambiguous"])

    def test_tracking_parameters_removed(self):
        row = {"name": "Flatiron Wines", "website": "https://nyc.flatiron-wines.com/?utm_source=google&utm_medium=organic&store=1"}
        candidate, _ = choose("Flatiron Wines", {"google": {"candidates": [row]}})
        self.assertEqual(candidate["website"], "https://nyc.flatiron-wines.com/?store=1")

    def test_missing_or_bad_lookup(self):
        candidate, summary = choose("Anything", None)
        self.assertIsNone(candidate)
        self.assertEqual(summary["google"], {"checked": False, "error": None, "listings": 0, "listing_names": [], "name_matches": 0, "website": None, "ambiguous": False})
        candidate, _ = choose("Fugazi", {"google": {"candidates": [{"name": "Fugazi", "website": "javascript:alert(1)"}]}})
        self.assertIsNone(candidate)


class Crawler:
    def crawl(self, url, country):
        return {"status": "completed", "contacts": [], "site_signals": [], "finished_at": "2026-10-15T00:00:00Z", "http_requests": 1, "pages_fetched": 1, "errors": []}


class Broker:
    def __init__(self, lookup):
        self.lookup, self.finished, self.calls = lookup, [], []

    def call(self, action, **kwargs):
        self.calls.append(action)
        if action == "claim":
            return [{"id": "j", "lease": "l", "kind": "research", "source": {"id": "p", "name": "McNally Jackson - Downtown Brooklyn", "city": "New York", "original_record": {}, "fit": {}}}]
        if action == "place_budget":
            return True
        if action == "lookup_website":
            return self.lookup
        if action == "finish":
            self.finished.append(kwargs)


class WorkerProviderTests(unittest.TestCase):
    def test_provider_site_is_researched_but_needs_review(self):
        broker = Broker({"foursquare": {"candidates": [FSQ]}, "google": {"candidates": []}})
        process(broker, place_fetch=lambda q: [], crawler=Crawler())
        payload = broker.finished[0]["payload"]
        self.assertEqual(payload["website"], "https://www.mcnallyjackson.com")
        self.assertTrue(payload["website_identity_review"])
        self.assertEqual(payload["status"], "completed")
        self.assertTrue(payload["provider_lookup"]["foursquare"]["website"])

    def test_no_match_stays_needs_website(self):
        broker = Broker({"foursquare": {"candidates": [{"name": "Something Else", "website": "https://x.example"}]}})
        process(broker, place_fetch=lambda q: [], crawler=Crawler())
        self.assertEqual(broker.finished[0]["payload"]["status"], "needs_website")

    def test_broker_lookup_failure_is_contained(self):
        class Failing(Broker):
            def call(self, action, **kwargs):
                if action == "lookup_website":
                    raise RuntimeError("broker down")
                return super().call(action, **kwargs)
        broker = Failing(None)
        self.assertEqual(process(broker, place_fetch=lambda q: [], crawler=Crawler()), 1)
        self.assertEqual(broker.finished[0]["payload"]["status"], "needs_website")

    def test_budget_exhausted_is_reported(self):
        broker = Broker({"budget_exhausted": True})
        process(broker, place_fetch=lambda q: [], crawler=Crawler())
        self.assertEqual(broker.finished[0]["payload"]["error"], "daily_provider_lookup_limit")


if __name__ == "__main__":
    unittest.main()
