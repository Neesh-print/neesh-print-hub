import copy
import unittest
from unittest.mock import patch
from nns.worker import process, research, published_website
from nns.places import PlaceError, query, record, unique_website

SOURCE={"id":"fixture","name":"Example Space","city":"New York","website":"https://fixture.neesh-fixture.org","original_record":{"notes":"Keep notes","phone":"2125550100"},"fit":{"score":None},"contacts":[],"do_not_contact":False}
class CrawlerFixture:
    def crawl(self,url,country):
        return {"status":"completed","contacts":[{"kind":"email","value":"hello@fixture.neesh-fixture.org","extension":None,"quality_status":"observed_on_website","review_reasons":[],"evidence":[{"source_url":url,"observed_at":"2026-10-14","extract_method":"mailto"}]}],"site_signals":[{"source_url":url,"content_hash":"fixture","text":"We sell independent magazines in our reading room."}],"finished_at":"2026-10-14T00:00:00Z","http_requests":2,"pages_fetched":1,"errors":[]}
class BrokerFixture:
    def __init__(self,jobs,budget=True):self.jobs=jobs;self.finished=[];self.budget=budget
    def call(self,action,**kwargs):
        if action=="claim":return self.jobs
        if action=="place_budget":return self.budget
        if action=="finish":self.finished.append(kwargs)
class WorkerTests(unittest.TestCase):
    def test_research_proposes_evidence_without_mutating_source(self):
        original=copy.deepcopy(SOURCE);result=research(SOURCE,crawler=CrawlerFixture())
        self.assertEqual(SOURCE,original);self.assertEqual(result["status"],"completed")
        self.assertTrue(any(c["kind"]=="email" for c in result["contacts"]))
        self.assertEqual(result["fit"]["score"],50)
        self.assertNotIn("original_record",result)
    def test_missing_site_not_reported_as_completed(self):
        result=research({**SOURCE,"website":None})
        self.assertEqual(result["status"],"needs_website");self.assertEqual(result["requests"],0)
    def test_name_matched_candidate_stays_unconfirmed(self):
        candidate=record({"type":"node","id":1,"tags":{"name":"Example Space","website":"https://fixture.neesh-fixture.org"}})
        result=research({**SOURCE,"website":None},candidate,crawler=CrawlerFixture())
        self.assertTrue(result["website_identity_review"])
        self.assertTrue(all("website_identity_needs_review" in c["review_reasons"] for c in result["contacts"]))
    def test_queue_pipeline_and_no_paid_or_outreach_calls(self):
        broker=BrokerFixture([{"id":"job","lease":"lease","kind":"research","source":SOURCE}])
        with patch("nns.worker.fetch_places",side_effect=AssertionError("No place lookup needed")):
            self.assertEqual(process(broker,crawler=CrawlerFixture()),1)
        self.assertEqual(broker.finished[0]["payload"]["status"],"completed")
    def test_budget_denial_retains_actionable_error(self):
        broker=BrokerFixture([{"id":"job","lease":"lease","kind":"research","source":{**SOURCE,"website":None}}],budget=False)
        self.assertEqual(process(broker,place_fetch=lambda q: (_ for _ in ()).throw(AssertionError("No query permitted"))),1)
        self.assertEqual(broker.finished[0]["payload"]["error"],"daily_place_lookup_limit")
    def test_discovery_preserves_license_and_no_automatic_contacts(self):
        broker=BrokerFixture([{"id":"job","lease":"lease","kind":"discovery","input":{"area":"Manhattan","segment":"Catalog","neighborhood":""}}])
        process(broker,place_fetch=lambda q:[{"type":"node","id":5,"tags":{"name":"Book Shop","website":"https://books.neesh-fixture.org","contact:email":"hello@books.neesh-fixture.org"}}])
        row=broker.finished[0]["payload"]["candidates"][0]
        self.assertEqual(row["id"],"osm:node:5");self.assertEqual(row["contacts"],[])
        self.assertIn("ODbL",row["discovery"]["attribution"])
    def test_query_injection_and_ambiguous_names(self):
        with self.assertRaises(PlaceError):query(area="arbitrary place",segment="Catalog")
        q=query(names=['Store ";out;'])
        self.assertIn('\\"',q)
        data=[{"type":"node","id":i,"tags":{"name":"Shop","website":"https://fixture.neesh-fixture.org"}} for i in (1,2)]
        self.assertIsNone(unique_website("Shop",data))
    def test_publisher_link_lookup_uses_exact_names_and_caches(self):
        source={**SOURCE,"website":None,"website_lookup_sources":[{"source_url":"https://publisher.neesh-fixture.org/stockists"}]}
        class Links:
            calls=0
            def crawl(self,url):
                self.calls+=1
                return {"http_requests":3,"published_links":[{"text":"Example Space","url":"https://space.neesh-fixture.org/","source_url":url},{"text":"Other Space","url":"https://other.neesh-fixture.org/","source_url":url}]}
        crawler=Links();cache={}
        found,count=published_website(source,cache,crawler)
        self.assertEqual(found["website"],"https://space.neesh-fixture.org/");self.assertEqual(count,3)
        _,count=published_website(source,cache,crawler);self.assertEqual(count,0);self.assertEqual(crawler.calls,1)
