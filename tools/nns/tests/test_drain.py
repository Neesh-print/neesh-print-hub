import threading
import time
import unittest
from nns.worker import drain, process


def job(i):
    return {"id": f"j{i}", "lease": "l", "kind": "research",
            "source": {"id": f"p{i}", "name": f"Space {i}", "city": "New York", "website": f"https://s{i}.example",
                       "space_type": "Cafe", "neighborhood": "SoHo", "original_record": {}, "fit": {}}}


class SlowCrawler:
    def __init__(self):
        self.active, self.peak, self.lock = 0, 0, threading.Lock()

    def crawl(self, url, country):
        with self.lock:
            self.active += 1
            self.peak = max(self.peak, self.active)
        time.sleep(0.05)
        with self.lock:
            self.active -= 1
        if "s3." in url:
            raise RuntimeError("one bad site")
        return {"status": "completed", "contacts": [], "site_signals": [], "finished_at": "2026-10-15T00:00:00Z", "http_requests": 1, "pages_fetched": 1, "errors": []}


class Broker:
    def __init__(self, batches):
        self.batches, self.finished, self.lock = list(batches), [], threading.Lock()

    def call(self, action, **kw):
        if action == "claim":
            return self.batches.pop(0) if self.batches else []
        if action == "finish":
            with self.lock:
                self.finished.append(kw["job_id"])
        if action == "place_budget":
            return True


class DrainTests(unittest.TestCase):
    def test_researches_in_parallel_and_survives_one_failure(self):
        crawler, broker = SlowCrawler(), Broker([[job(i) for i in range(10)]])
        self.assertEqual(process(broker, place_fetch=lambda q: [], crawler=crawler), 9)
        self.assertGreater(crawler.peak, 1, "jobs ran at the same time")
        self.assertNotIn("j3", broker.finished)

    def test_drain_keeps_claiming_until_the_queue_is_empty(self):
        broker = Broker([[job(i) for i in range(10)], [job(i) for i in range(10, 14)]])
        crawler = SlowCrawler()
        crawler.crawl = lambda url, country: {"status": "completed", "contacts": [], "site_signals": [], "finished_at": "x", "http_requests": 1, "pages_fetched": 1, "errors": []}
        self.assertEqual(drain(broker, place_fetch=lambda q: [], crawler=crawler), 14)

    def test_drain_stops_at_the_time_budget(self):
        ticks = iter([0, 0, 1000])
        broker = Broker([[job(1)], [job(2)], [job(3)]])
        crawler = SlowCrawler()
        crawler.crawl = lambda url, country: {"status": "completed", "contacts": [], "site_signals": [], "finished_at": "x", "http_requests": 1, "pages_fetched": 1, "errors": []}
        self.assertEqual(drain(broker, place_fetch=lambda q: [], crawler=crawler, seconds=10, clock=lambda: next(ticks)), 1)


if __name__ == "__main__":
    unittest.main()
