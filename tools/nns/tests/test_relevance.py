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

    def test_people_rank_between_general_and_departments(self):
        self.assertEqual(rank("lawrence@lunalamerbk.com", "Luna La Mer Shop"), 2)
        self.assertEqual(rank("pressoffice@x.org", "X"), 4)

    def test_phones_prefer_primary_and_clean(self):
        self.assertLess(relevance({"kind": "phone", "value": "+1", "is_primary": True}, ""), relevance({"kind": "phone", "value": "+2", "review_reasons": ["conflicts_with_imported_phone"]}, ""))


if __name__ == "__main__":
    unittest.main()
