import contextlib
import hashlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from nns.cli import run_batch
from nns.crawler import Crawler
from nns.network import CurlTransport
from nns.reparse import reparse
from test_batch import manifest
from test_crawler import BASE, FixtureTransport


class ReparseTests(unittest.TestCase):
    def setup_run(self, folder):
        source, evidence = Path(folder) / "source", Path(folder) / "evidence"
        rows = [{"id": "a", "name": "Fixture", "phone": "2125550123", "notes": "Retain this", "status_history": [{"stage": "New"}], "website": BASE}]
        transport = FixtureTransport({BASE + "/robots.txt": (404, "", {}), BASE + "/": (200, '<p>hello@shop.neesh-fixture.org</p><p>Our collection at shop.neesh-fixture.org</p>', {})})
        # Reproduce the pre-fix parser on the source crawl, then reparse using
        # the current parser. This checks that false contacts are removed only
        # in the new revision and the old run remains inspectable.
        with contextlib.redirect_stdout(io.StringIO()), patch("nns.contacts.deobfuscate", side_effect=lambda text: text.replace("collection at shop.neesh-fixture.org", "collection@shop.neesh-fixture.org")):
            run_batch(rows, source, Crawler(transport, evidence_dir=evidence), manifest(rows))
        return source, evidence, rows

    def test_reparse_preserves_originals_and_provenance_without_network(self):
        with tempfile.TemporaryDirectory() as folder:
            source, evidence, rows = self.setup_run(folder)
            source_bytes = (source / "results.json").read_bytes()
            output = Path(folder) / "corrected"
            with patch.object(CurlTransport, "get", side_effect=AssertionError("No network permitted")):
                summary = reparse(source, evidence, output)
            result = json.loads((output / "results.json").read_text())
            self.assertEqual(result["records"][0]["original_record"], rows[0])
            self.assertEqual(result["records"][0]["job"], json.loads(source_bytes)["records"][0]["job"])
            self.assertEqual(summary["http_requests"], 0)
            self.assertEqual(summary["website_observed_contact_records"]["email"], 1)
            self.assertEqual(summary["changed_records"], 1)
            changes = json.loads((output / "parser_changes.json").read_text())
            self.assertEqual(changes[0]["removed_contacts"][0]["value"], "collection@shop.neesh-fixture.org")
            self.assertEqual(summary["source_results_sha256"], hashlib.sha256(source_bytes).hexdigest())
            self.assertEqual((source / "results.json").read_bytes(), source_bytes)
            with self.assertRaises(ValueError):
                reparse(source, evidence, output)

    def test_missing_or_modified_evidence_and_incomplete_runs_fail_closed(self):
        with tempfile.TemporaryDirectory() as folder:
            source, evidence, _ = self.setup_run(folder)
            html = next(evidence.glob("*.html"))
            original = html.read_bytes()
            html.write_bytes(b"modified")
            output = Path(folder) / "corrected"
            with self.assertRaises(ValueError):
                reparse(source, evidence, output)
            self.assertFalse(output.exists())
            html.write_bytes(original)
            data = json.loads((source / "results.json").read_text())
            data["manifest"]["selected_ids"].append("pending")
            (source / "results.json").write_text(json.dumps(data))
            with self.assertRaises(ValueError):
                reparse(source, evidence, output)
            self.assertFalse(output.exists())
