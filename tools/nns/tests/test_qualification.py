import unittest

from nns.qualification import assess


class QualificationTests(unittest.TestCase):
    def test_category_does_not_invent_physical_evidence_or_budget(self):
        result = assess({"business_type": "boutique"}, [])
        self.assertEqual(result["segment"], "Dwell")
        self.assertIsNone(result["score"])
        self.assertIsNone(result["offer"])
        self.assertIsNone(result["quadrant"])
        self.assertEqual(result["components"]["merchandising_opportunity"]["state"], "unknown")

    def test_contact_does_not_inflate_fit(self):
        plain = assess({"business_type": "cafe"}, [])
        contactable = assess({"business_type": "cafe", "email": "hello@fixture.org", "phone": "2125550123"}, [])
        self.assertEqual(plain, contactable)

    def test_positive_signals_need_source_and_negation_is_not_positive(self):
        self.assertIsNone(assess({}, [{"text": "We sell magazines"}])["score"])
        negative = assess({}, [{"source_url": "https://fixture.org/about", "content_hash": "hash", "text": "We do not sell magazines."}])
        self.assertIsNone(negative["score"])
        positive = assess({}, [{"source_url": "https://fixture.org/about", "content_hash": "hash", "text": "We sell independent magazines. We host artist talks in our reading room."}])
        self.assertEqual(positive["score"], 75)
        self.assertEqual(positive["review_priority"], "high_supported_fit")
        self.assertIsNone(positive["motion"])

    def test_sticky_manual_values_and_no_net30(self):
        result = assess({"business_type": "cafe", "manual_overrides": {"segment": "Wait", "fit_score": 82, "motion": "Sell the room", "budget_type": "decor", "quadrant": "User-approved quadrant"}}, [])
        self.assertEqual(result["segment"], "Wait")
        self.assertEqual(result["score"], 82)
        self.assertEqual(result["offer"], "Neesh packs")
        self.assertEqual(result["payment_terms"], "standard_terms_no_net30")
        inventory = assess({"manual_overrides": {"budget_type": "inventory"}}, [])
        self.assertEqual(inventory["offer"], "Marketplace")

    def test_invalid_override_cannot_claim_model_confidence(self):
        result = assess({"manual_overrides": {"fit_score": 999, "motion": "Give Net30", "segment": "made up"}}, [])
        self.assertIsNone(result["score"])
        self.assertIsNone(result["motion"])
