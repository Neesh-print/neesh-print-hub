import unittest
from nns.icp import classify, place_tags
from nns.worker import process, provider_record

G = {"name": "Salon Nordic", "place_id": "ChIJ1", "address": "12 Lafayette Ave, Brooklyn, NY", "neighborhood": "Fort Greene",
     "borough": "Brooklyn", "primary_type": "hair_salon", "types": ["hair_salon", "beauty_salon"], "website": "https://salon.example",
     "phone": "(718) 555-0101", "source_url": "https://www.google.com/maps/place/?q=place_id:ChIJ1"}


class ClassifyTests(unittest.TestCase):
    def test_segments(self):
        self.assertEqual(classify("hair_salon"), ("Hair salon", "Wait"))
        self.assertEqual(classify("wine_bar"), ("Wine bar", "Presence"))
        self.assertEqual(classify("clothing_store"), ("Clothing boutique", "Dwell"))
        self.assertEqual(classify("hotel"), ("Hotel", "Taste"))
        self.assertEqual(classify("book_store"), ("Bookstore", "Catalog"))

    def test_falls_back_through_secondary_types_and_suffixes(self):
        self.assertEqual(classify("store", ["store", "gift_shop"]), ("Gift shop", "Dwell"))
        self.assertEqual(classify("japanese_restaurant"), ("Restaurant", "Presence"))
        self.assertEqual(classify("car_repair"), (None, None))

    def test_place_tags(self):
        self.assertEqual(place_tags(G), {"neighborhood": "Fort Greene", "borough": "Brooklyn", "address": "12 Lafayette Ave, Brooklyn, NY", "space_type": "Hair salon", "icp": "Wait"})
        self.assertEqual(place_tags(None), {})

    def test_zip_fills_missing_neighborhood(self):
        manhattan = {**G, "neighborhood": None, "borough": "Manhattan", "postal_code": "10012"}
        self.assertEqual(place_tags(manhattan)["neighborhood"], "SoHo")
        self.assertNotIn("neighborhood", place_tags({**manhattan, "postal_code": "99999"}))


class Crawler:
    def crawl(self, url, country):
        return {"status": "completed", "contacts": [], "site_signals": [], "finished_at": "2026-10-15T00:00:00Z", "http_requests": 1, "pages_fetched": 1, "errors": []}


class Broker:
    def __init__(self, jobs, lookup=None, discovered=None):
        self.jobs, self.lookup, self.discovered, self.finished, self.calls = jobs, lookup, discovered, [], []

    def call(self, action, **kwargs):
        self.calls.append((action, kwargs))
        if action == "claim": return self.jobs
        if action == "place_budget": return True
        if action == "lookup_website": return self.lookup
        if action == "discover_places": return self.discovered
        if action == "finish": self.finished.append(kwargs)


class WorkerTaggingTests(unittest.TestCase):
    def test_space_with_website_still_gets_tags_but_keeps_its_site(self):
        src = {"id": "p", "name": "Salon Nordic", "city": "New York", "website": "https://own.example", "original_record": {}, "fit": {}}
        broker = Broker([{"id": "j", "lease": "l", "kind": "research", "source": src}], lookup={"google": {"candidates": [G]}})
        process(broker, place_fetch=lambda q: [], crawler=Crawler())
        out = broker.finished[0]["payload"]
        self.assertEqual(out["website"], "https://own.example")
        self.assertEqual((out["neighborhood"], out["space_type"], out["fit"]["segment"]), ("Fort Greene", "Hair salon", "Wait"))

    def test_existing_segment_and_tags_are_not_overwritten_or_relooked_up(self):
        src = {"id": "p", "name": "Salon Nordic", "city": "New York", "website": "https://own.example", "space_type": "Spa", "neighborhood": "SoHo", "original_record": {}, "fit": {"segment": "Dwell"}}
        broker = Broker([{"id": "j", "lease": "l", "kind": "research", "source": src}], lookup={"google": {"candidates": [G]}})
        process(broker, place_fetch=lambda q: [], crawler=Crawler())
        self.assertNotIn("lookup_website", [a for a, _ in broker.calls])
        self.assertEqual(broker.finished[0]["payload"]["fit"]["segment"], "Dwell")

    def test_discovery_uses_google_and_returns_tagged_leads(self):
        job = {"id": "d", "lease": "l", "kind": "discovery", "input": {"area": "Brooklyn", "segment": "Wait", "neighborhood": "Fort Greene"}}
        broker = Broker([job], discovered={"candidates": [G, {"name": ""}], "calls": 3})
        process(broker, place_fetch=lambda q: (_ for _ in ()).throw(AssertionError("no OSM when Google works")))
        out = broker.finished[0]["payload"]
        self.assertEqual(out["status"], "completed")
        self.assertEqual(out["requests"], 3)
        lead = out["candidates"][0]
        self.assertEqual((lead["id"], lead["neighborhood"], lead["space_type"], lead["fit"]["segment"]), ("gp:ChIJ1", "Fort Greene", "Hair salon", "Wait"))
        self.assertEqual(lead["contacts"], [])
        self.assertEqual(len(out["candidates"]), 1, "nameless places dropped")

    def test_discovery_falls_back_to_open_data_without_google(self):
        job = {"id": "d", "lease": "l", "kind": "discovery", "input": {"area": "Manhattan", "segment": "Catalog", "neighborhood": ""}}
        broker = Broker([job], discovered={"unavailable": True})
        process(broker, place_fetch=lambda q: [{"type": "node", "id": 5, "tags": {"name": "Book Shop"}}])
        self.assertEqual(broker.finished[0]["payload"]["candidates"][0]["id"], "osm:node:5")

    def test_space_missing_a_neighborhood_is_looked_up_again(self):
        src = {"id": "p", "name": "Salon Nordic", "city": "New York", "website": "https://own.example", "space_type": "Spa", "original_record": {}, "fit": {}}
        broker = Broker([{"id": "j", "lease": "l", "kind": "research", "source": src}], lookup={"google": {"candidates": [G]}})
        process(broker, place_fetch=lambda q: [], crawler=Crawler())
        self.assertEqual(broker.finished[0]["payload"]["neighborhood"], "Fort Greene")

    def test_confirmed_website_is_not_reflagged(self):
        from nns.worker import research
        src = {"id": "p", "name": "Salon Nordic", "city": "New York", "website": "https://own.example", "website_source": "owner_confirmed",
               "website_identity_review": False, "discovery": {"source_url": "https://www.google.com/maps"}, "original_record": {}, "fit": {}}
        self.assertFalse(research(src, crawler=Crawler())["website_identity_review"])

    def test_provider_record_never_carries_contacts(self):
        self.assertEqual(provider_record(G, "Wait")["contacts"], [])


if __name__ == "__main__":
    unittest.main()
