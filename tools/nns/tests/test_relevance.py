import unittest
from nns.records import relevance


def rank(value, name, reasons=()):
    return relevance({"kind": "email", "value": value, "review_reasons": list(reasons)}, name)


class RelevanceTests(unittest.TestCase):
    def test_store_inbox_beats_departments_and_vendor_staff(self):
        name = "Studio Museum in Harlem"
        self.assertLess(rank("store@studiomuseum.org", name), rank("info@studiomuseum.org", name))
        self.assertLess(rank("info@studiomuseum.org", name), rank("development@studiomuseum.org", name))
        self.assertLess(rank("booksmomaps1@artbook.com", "Artbook @ MoMA PS1"), rank("orders@dapinc.com", "Artbook @ MoMA PS1", ["different_mail_domain"]))

    def test_business_name_in_inbox_counts_as_buying_contact(self):
        self.assertEqual(rank("lunalamer@gmail.com", "Luna La Mer"), 0)

    def test_trade_sales_is_a_buying_contact(self):
        self.assertEqual(rank("tradesales@nickeykehoe.com", "Nicky Kehoe"), 0)

    def test_people_rank_between_general_and_departments(self):
        self.assertEqual(rank("lawrence@lunalamerbk.com", "Luna La Mer Shop"), 2)
        self.assertEqual(rank("pressoffice@x.org", "X"), 4)

    def test_phones_prefer_primary_and_clean(self):
        self.assertLess(relevance({"kind": "phone", "value": "+1", "is_primary": True}, ""), relevance({"kind": "phone", "value": "+2", "review_reasons": ["conflicts_with_imported_phone"]}, ""))


class SocialWebsiteTests(unittest.TestCase):
    def test_instagram_website_becomes_contact_without_crawl(self):
        from nns.worker import research

        class NoCrawl:
            def crawl(self, url, country):
                raise AssertionError("social profiles are not crawled")

        out = research({"id": "p", "name": "What Mary Kept", "city": "New York", "website": "http://www.instagram.com/whatmarykept", "original_record": {}, "fit": {}}, crawler=NoCrawl())
        self.assertEqual(out["status"], "needs_website")
        self.assertIsNone(out["website"])
        self.assertTrue(any(c["kind"] == "instagram" and "whatmarykept" in c["value"] for c in out["contacts"]))


if __name__ == "__main__":
    unittest.main()
