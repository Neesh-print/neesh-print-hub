import contextlib
import copy
import csv
import hashlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from nns import VERSION
from nns.cli import audit_selection, export_csv, main, not_attempted, preflight, run_batch, select_records
from nns.crawler import Crawler
from nns.network import CrawlError, Resolver
from nns.records import reconcile
from nns.reporting import audit_summary, render_report
from test_crawler import BASE, FixtureTransport


def manifest(rows):
    return {"version": VERSION, "source_sha256": hashlib.sha256(json.dumps(rows).encode()).hexdigest(), "selected_ids": [r["id"] for r in rows], "policy_sha256": "fixture-policy", "started_at": "2026-10-14T00:00:00+00:00"}


class BatchTests(unittest.TestCase):
    def test_one_hundred_records_end_to_end_preserve_contacts_and_cache(self):
        rows = [{"id": f"synthetic-{i}", "name": "Synthetic fixture", "city": "NYC", "website": BASE, "phone": "(212) 555-0123 x42", "status_history": [{"stage": "New"}]} for i in range(100)]
        original = copy.deepcopy(rows)
        transport = FixtureTransport({BASE + "/robots.txt": (200, "User-agent: *\nAllow: /", {}), BASE + "/": (200, '<a href="/contact">Contact</a>', {}), BASE + "/contact": (200, '<p>hello@shop.neesh-fixture.org</p><a href="tel:2125550123;ext=42">Call</a><a href="https://instagram.com/synthetic_shop/">Instagram</a>', {})})
        with tempfile.TemporaryDirectory() as folder, contextlib.redirect_stdout(io.StringIO()):
            output = Path(folder)
            summary = run_batch(rows, output, Crawler(transport), manifest(rows))
            self.assertEqual(summary["coverage_percent"]["email"], 100)
            self.assertEqual(summary["website_observed_contact_records"]["phone"], 100)
            self.assertEqual(summary["website_observed_contact_records"]["instagram"], 100)
            self.assertEqual(summary["cache_hits"], 99)
            self.assertEqual(summary["http_requests"], 3)
            self.assertEqual(summary["accuracy"]["status"], "not_measured_until_source_audit")
            results = json.loads((output / "results.json").read_text())["records"]
            self.assertEqual([r["original_record"] for r in results], original)
            self.assertEqual(rows, original)
            self.assertEqual(len({r["contacts"][0]["id"] for r in results}), 100)
            self.assertEqual(len(json.loads((output / "audit.json").read_text())), 20)
            audit_bytes = (output / "audit.json").read_bytes()
            with (output / "contacts.csv").open(newline="") as f:
                self.assertEqual(next(csv.DictReader(f))["phone_extension"], "42")
            repeated = run_batch(rows, output, Crawler(transport), manifest(rows))
            self.assertEqual(repeated["http_requests"], 0)
            self.assertEqual(repeated["cache_hits"], 100)
            self.assertEqual(len(transport.calls), 3)
            self.assertEqual((output / "audit.json").read_bytes(), audit_bytes)
            self.assertTrue(list((output / "history").glob("*/results.json")))

    def test_changed_source_cannot_overwrite_existing_run(self):
        rows = [{"id": "a", "website": BASE}]
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder)
            run_batch(rows, output, Crawler(), manifest(rows), "offline_preservation_check")
            rows[0]["phone"] = "2125550123"
            with self.assertRaises(ValueError):
                run_batch(rows, output, Crawler(), manifest(rows), "offline_preservation_check")

    def test_offline_cli_makes_no_network_calls_or_verified_claims(self):
        with tempfile.TemporaryDirectory() as folder, contextlib.redirect_stdout(io.StringIO()):
            source, output = Path(folder) / "source.json", Path(folder) / "output"
            source.write_text(json.dumps([{"id": "a", "city": "NYC", "website": BASE, "phone": "2125550123"}]))
            with patch.object(Resolver, "resolve", side_effect=AssertionError("Network forbidden")):
                self.assertEqual(main(["--input", str(source), "--output", str(output), "--require-count", "1", "--offline"]), 0)
            summary = json.loads((output / "summary.json").read_text())
            self.assertEqual(summary["http_requests"], 0)
            self.assertEqual(summary["crawl_status"], {"not_attempted": 1})
            self.assertIn("No live extraction accuracy", (output / "report.md").read_text())

    def test_selection_deterministic_and_respects_all_suppression_forms(self):
        base = {"city": "NYC", "website": BASE}
        allowed = [{**base, "id": "a"}, {**base, "id": "b", "city": "Brooklyn"}]
        denied = [{**base, "id": str(i), **extra} for i, extra in enumerate([{"do_not_contact": 1}, {"opted_out": True}, {"status": "Do not contact"}, {"stage": "unsubscribed"}, {"is_merged": True}, {"is_invalid": "yes"}, {"city": "Boston"}])]
        self.assertEqual(select_records(allowed + denied), select_records(list(reversed(allowed))))
        with self.assertRaises(ValueError):
            select_records([allowed[0], allowed[0]])

    def test_suppression_applied_at_export(self):
        suppressed = reconcile({"id": "x", "phone": "2125550123", "do_not_contact": True}, not_attempted(BASE))
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "export.csv"
            export_csv(path, [suppressed])
            with path.open(newline="") as f:
                self.assertEqual(list(csv.DictReader(f)), [])

    def test_preflight_failures_are_not_website_absence(self):
        rows = [{"website": "https://one.fixture.org"}, {"website": "https://two.fixture.org"}]
        with patch.object(Resolver, "resolve", side_effect=CrawlError("dns_failed")):
            result = preflight(rows, Resolver())
        self.assertFalse(result["passed"])
        self.assertEqual(len(result["probes"]), 2)
        with patch.object(Resolver, "resolve", side_effect=AssertionError("No lookup for a prohibited site")):
            self.assertTrue(preflight(rows, Resolver(), denied_hosts={"fixture.org"})["passed"])

    def test_audit_requires_source_provenance_and_measures_each_channel(self):
        transport = FixtureTransport({BASE + "/robots.txt": (404, "", {}), BASE + "/": (200, "info@shop.neesh-fixture.org (212)555-0123", {})})
        row = reconcile({"id": "a"}, Crawler(transport).crawl(BASE))
        audit = audit_selection([row])
        self.assertIsNone(audit_summary([row], audit)["per_channel"]["email"]["precision_percent"])
        audit[0]["reviewer"] = "Fixture reviewer"
        for review in audit[0]["contact_reviews"]:
            review.update(verdict="correct", reviewed_at="2026-10-14T00:00:00Z")
        result = audit_summary([row], audit)
        self.assertEqual(result["per_channel"]["email"]["precision_percent"], 100)
        self.assertEqual(result["per_channel"]["phone"]["precision_percent"], 100)
        self.assertIsNone(result["missed_emails_in_reviewed_pages"])
        self.assertEqual(result["missed_email_review_records"], 0)
        audit[0]["contact_reviews"][0]["content_hash"] = "wrong"
        with self.assertRaises(ValueError):
            audit_summary([row], audit)
