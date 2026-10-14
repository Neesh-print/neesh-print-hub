import contextlib
import copy
import csv
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from nns.discovery import main, normalize, preview

STORE_A = "10000000-0000-4000-8000-000000000001"
STORE_B = "10000000-0000-4000-8000-000000000002"


def lead(identifier="a", **fields):
    return {"id": identifier, "business_name": "Fixture Books", "city": "NYC", "country": "US", "address": "10 Fixture Street", "website": "https://books.neesh-fixture.org", "business_type": "bookshop", "neighborhood": "Lower East Side", **fields}


def run(incoming, existing=(), **kwargs):
    return preview(incoming, list(existing), source="legacy", namespace="lovable-leads", **kwargs)


class DiscoveryTests(unittest.TestCase):
    def test_one_hundred_existing_ids_preserve_every_field_and_repeat_order(self):
        rows = [lead(str(i), phone="2125550123", notes="Keep me", status_history=[{"stage": "Called", "at": "2025-01-01"}], manual_overrides={"segment": "Wait"}) for i in range(100)]
        before = copy.deepcopy(rows)
        first = run(rows, rows)
        repeated = run(list(reversed(rows)), list(reversed(rows)))
        self.assertEqual(first, repeated)
        self.assertEqual(first["summary"]["decisions"]["matched_existing"], 100)
        self.assertEqual(first["summary"]["decisions"]["proposed_new"], 0)
        self.assertEqual(rows, before)
        originals = {row["id"]: row for row in rows}
        for item in first["records"]:
            self.assertEqual(item["record"]["original_record"], originals[item["record"]["source_id"]])
            self.assertEqual(item["changed_source_fields"], [])
            self.assertFalse(item["outreach_authorized"])

    def test_same_identity_reports_changes_without_overwrite(self):
        old = lead(notes="Old notes", status_history=[{"stage": "Called"}], phone="2125550123")
        new = lead(notes="New notes", phone="2125550124")
        result = run([new], [old])
        item = result["records"][0]
        self.assertEqual(item["decision"], "matched_existing")
        self.assertEqual(item["changed_source_fields"], ["notes", "phone", "status_history"])
        self.assertEqual(result["existing_records"][0]["original_record"], old)
        self.assertEqual(item["record"]["original_record"], new)

    def test_source_ids_do_not_cross_namespaces(self):
        row = lead()
        item = run([row], [row], existing_namespace="different-table")["records"][0]
        self.assertEqual(item["decision"], "needs_review")
        self.assertIsNone(item["matched_existing_key"])
        self.assertTrue(all(c["strength"] == "review_only" for c in item["candidates"]))

    def test_explicit_index_foreign_key_links_without_cloning_relationships(self):
        store = {"id": STORE_A, "name": "Fixture Books", "city": "New York", "country": "US", "stockists": [{"publisher_id": "publisher-1", "source_url": "https://publisher.neesh-fixture.org/stockists"}]}
        item = run([lead(directory_store_id=STORE_A)], [store], existing_source="index", existing_namespace="neesh-directory-stores")["records"][0]
        self.assertEqual(item["decision"], "matched_existing")
        self.assertEqual(item["candidates"][0]["reasons"], ["directory_store", "same_normalized_name_city"])
        result = run([lead(directory_store_id=STORE_A)], [store], existing_source="index", existing_namespace="neesh-directory-stores")
        self.assertEqual(result["existing_records"][0]["original_record"]["stockists"], store["stockists"])

    def test_conflicting_stable_identifiers_and_repeated_canonical_ids_need_review(self):
        old = lead(directory_store_id=STORE_A)
        item = run([lead(directory_store_id=STORE_B)], [old])["records"][0]
        self.assertEqual(item["decision"], "needs_review")
        self.assertIn("conflicting_directory_store_ids", item["reasons"])
        two = run([lead(directory_store_id=STORE_A)], [lead("x", directory_store_id=STORE_A), lead("y", directory_store_id=STORE_A)])
        self.assertIn("conflicting_stable_identity_matches", two["records"][0]["reasons"])
        peers = run([lead("x", directory_store_id=STORE_A), lead("y", directory_store_id=STORE_A)])
        self.assertTrue(all(item["decision"] == "needs_review" for item in peers["records"]))

    def test_shared_chain_host_and_phone_never_auto_merge_locations(self):
        a = lead("a", address="10 East Street", neighborhood="East Village", website="http://www.chain.neesh-fixture.org/east", phone="2125550123 x10")
        b = lead("b", address="20 West Street", neighborhood="West Village", website="https://chain.neesh-fixture.org/west", phone="2125550123 x20")
        item = run([a], [b])["records"][0]
        self.assertEqual(item["decision"], "needs_review")
        self.assertIn("shared_website_host", item["candidates"][0]["reasons"])
        self.assertIn("shared_phone", item["candidates"][0]["reasons"])
        self.assertIsNone(item["matched_existing_key"])
        self.assertEqual(item["record"]["phone_extension"], "10")

    def test_normalized_name_address_matches_are_review_only(self):
        old = lead("old", business_name="Café, Fixture!", address="12 Main St.", website=None)
        new = lead("new", business_name="Cafe Fixture", address="12 MAIN ST", website=None)
        item = run([new], [old])["records"][0]
        self.assertEqual(item["decision"], "needs_review")
        self.assertEqual(item["candidates"][0]["reasons"], ["same_normalized_address_city", "same_normalized_name_city"])

    def test_incoming_duplicates_reviewed_before_filtering(self):
        records = [lead("a", neighborhood="East Village"), lead("b", neighborhood="West Village")]
        items = {item["record"]["source_id"]: item for item in run(records, filters={"neighborhood": ["East Village"]})["records"]}
        self.assertEqual(items["a"]["decision"], "needs_review")
        self.assertEqual(items["b"]["decision"], "excluded")
        self.assertEqual(len(items["a"]["candidates"]), 1)

    def test_suppression_cannot_reenter_as_new_and_existing_stays_blocked(self):
        for suppression in ({"do_not_contact": 1}, {"opted_out": "yes"}, {"stage": "unsubscribed"}):
            with self.subTest(suppression=suppression):
                old = lead("old", **suppression)
                item = run([lead("new")], [old])["records"][0]
                self.assertEqual(item["decision"], "needs_review")
                self.assertTrue(item["contact_hold"])
                self.assertIn("possible_suppressed_duplicate", item["reasons"])
                exact = run([lead("old")], [old])["records"][0]
                self.assertEqual(exact["decision"], "blocked")
                self.assertTrue(exact["contact_hold"])
        direct = run([lead(do_not_contact=True)])["records"][0]
        self.assertEqual(direct["decision"], "blocked")

    def test_merged_invalid_and_filtered_existing_rows_still_prevent_duplicate_creation(self):
        for field in ("is_merged", "is_invalid"):
            self.assertEqual(run([lead()], [lead(**{field: True})])["records"][0]["decision"], "blocked")
        item = run([lead()], [lead("other", city="Boston", do_not_contact=True)], filters={"city": "NYC"})["records"][0]
        self.assertIn("possible_suppressed_duplicate", item["reasons"])

    def test_missing_neighborhood_not_inferred_from_borough_address_or_coordinates(self):
        row = lead(city="Brooklyn", neighborhood=None, latitude=40.7, longitude=-73.9)
        item = run([row], filters={"city": "New York", "neighborhood": ["Williamsburg"]})["records"][0]
        self.assertEqual(item["record"]["city"], "New York")
        self.assertEqual(item["record"]["borough"], "Brooklyn")
        self.assertEqual(item["decision"], "needs_review")
        self.assertIn("unknown_neighborhood", item["reasons"])
        self.assertIsNone(item["record"]["neighborhood"])

    def test_geographic_and_segment_filters_and_manual_override(self):
        filters = {"city": "nyc", "country": "US", "neighborhood": ["lower east side"], "segments": ["Catalog"], "phrases": ["unmatched phrase", "fixture"]}
        self.assertEqual(run([lead()], filters=filters)["records"][0]["decision"], "proposed_new")
        self.assertEqual(run([lead(city="Boston")], filters=filters)["records"][0]["decision"], "excluded")
        self.assertEqual(run([lead(country="CA")], filters=filters)["records"][0]["decision"], "excluded")
        ambiguous = run([lead(business_type="bookshop cafe")], filters=filters)["records"][0]
        self.assertEqual(ambiguous["decision"], "needs_review")
        self.assertIn("ambiguous_segment", ambiguous["reasons"])
        manual = run([lead(business_type="bookshop cafe", manual_overrides={"segment": "Catalog"})], filters=filters)["records"][0]
        self.assertEqual(manual["decision"], "proposed_new")
        self.assertEqual(manual["record"]["segment_state"], "manual_override")

    def test_index_stockist_membership_does_not_invent_catalog_segment(self):
        row = {"id": STORE_A, "name": "Fixture Hotel", "city": "NYC", "country": "US", "stockists": [{"publisher_id": "p"}]}
        result = preview([row], [], source="index", namespace="neesh-directory-stores", filters={"segments": ["Catalog"]})
        self.assertEqual(result["records"][0]["decision"], "needs_review")
        self.assertIn("unknown_segment", result["records"][0]["reasons"])

    def test_manual_content_key_is_repeatable_but_changed_row_requires_review(self):
        row = lead()
        del row["id"]
        first = preview([row], [row], source="manual", namespace="master-list")
        self.assertEqual(first["records"][0]["decision"], "matched_existing")
        self.assertTrue(first["records"][0]["record"]["id_is_content_derived"])
        changed = preview([{**row, "notes": "Changed"}], [row], source="manual", namespace="master-list")
        self.assertEqual(changed["records"][0]["decision"], "needs_review")

    def test_bad_ids_types_and_unsafe_urls_fail_or_hold(self):
        with self.assertRaisesRegex(ValueError, "Duplicate source"):
            run([lead(), lead()])
        for value in (None, [], {}):
            with self.subTest(value=value), self.assertRaises(ValueError):
                run([lead(id=value)])
        with self.assertRaises(ValueError):
            run([lead(neighborhood=["East Village"])])
        with self.assertRaises(ValueError):
            run([lead()], filters={"segments": ["Invented"]})
        for website in ("http://127.0.0.1", "http://bad[host", "https://instagram.com/fixture"):
            item = run([lead(website=website)])["records"][0]
            self.assertEqual(item["decision"], "needs_review")
        self.assertEqual(normalize(lead(id=0), "legacy", "lovable-leads")["source_id"], "0")

    def test_cli_csv_no_network_private_files_no_overwrites(self):
        with tempfile.TemporaryDirectory() as folder, contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            root = Path(folder)
            source, output = root / "source.csv", root / "preview"
            with source.open("w", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=["id", "name", "city", "website", "notes"])
                writer.writeheader()
                writer.writerow({"id": "fixture", "name": "=FORMULA()", "city": "NYC", "website": "https://shop.neesh-fixture.org", "notes": "Keep, including\nnewlines"})
            argv = ["--input", str(source), "--source", "manual", "--namespace", "master-list", "--output", str(output)]
            with patch("socket.getaddrinfo", side_effect=AssertionError("No network")), patch("subprocess.run", side_effect=AssertionError("No subprocess")):
                self.assertEqual(main(argv), 0)
                first = (output / "preview.json").read_bytes()
                self.assertEqual(main(argv), 2)
                self.assertEqual((output / "preview.json").read_bytes(), first)
            result = json.loads(first)
            self.assertEqual(result["summary"]["decisions"]["proposed_new"], 1)
            self.assertEqual(result["summary"]["http_requests"], 0)
            self.assertEqual(result["records"][0]["record"]["original_record"]["notes"], "Keep, including\nnewlines")
            with (output / "review.csv").open(newline="") as f:
                self.assertEqual(next(csv.DictReader(f))["name"], "'=FORMULA()")
            self.assertEqual(output.stat().st_mode & 0o777, 0o700)
            self.assertTrue(all(p.stat().st_mode & 0o777 == 0o600 for p in output.iterdir()))

    def test_candidate_explosion_stops_without_partial_result(self):
        with self.assertRaisesRegex(ValueError, "500 duplicate candidates"):
            run([lead("new")], [lead(str(i)) for i in range(501)])


if __name__ == "__main__":
    unittest.main()
