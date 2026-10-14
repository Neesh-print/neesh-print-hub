import unittest

from nns.contacts import email_value, extract_contacts, instagram_value, phone_value, safe_csv

STAMP = "2026-10-14T00:00:00+00:00"


class ContactTests(unittest.TestCase):
    def extract(self, html):
        return extract_contacts(html, "https://shop.neesh-fixture.org/contact", STAMP)["contacts"]

    def test_roles_mailto_entities_deduplicate_with_evidence(self):
        contacts = self.extract('<a href="mailto:Hello@shop.neesh-fixture.org?subject=Hello">Email us</a><p>hello&#64;shop.neesh-fixture.org</p><p>info@shop.neesh-fixture.org contact@shop.neesh-fixture.org</p>')
        self.assertEqual({c["value"] for c in contacts}, {"hello@shop.neesh-fixture.org", "info@shop.neesh-fixture.org", "contact@shop.neesh-fixture.org"})
        self.assertTrue(all(c["role_type"] == "role" for c in contacts))
        hello = next(c for c in contacts if c["value"].startswith("hello"))
        self.assertEqual(len(hello["evidence"]), 2)
        self.assertTrue(all(e["observed_at"] == STAMP and e["content_hash"] for e in hello["evidence"]))

    def test_obfuscation_and_no_guessed_names(self):
        contacts = self.extract('<p>buying [at] shop.neesh-fixture [dot] org</p><p>alex at shop.neesh-fixture.org</p>')
        self.assertEqual({c["value"] for c in contacts}, {"buying@shop.neesh-fixture.org", "alex@shop.neesh-fixture.org"})
        self.assertEqual(next(c for c in contacts if c["value"].startswith("alex"))["role_type"], "unknown")

    def test_hidden_scripts_and_assets_do_not_create_contacts(self):
        self.assertEqual(self.extract('<script>var x="dev@tracker.com";</script><style>.x {content:"style@tracker.com"}</style><div hidden>hidden@tracker.com</div><div aria-hidden="true">secret@tracker.com</div><img src="logo@2x.png"><p>test@example.com</p>'), [])

    def test_json_ld_only_business_contacts(self):
        contacts = self.extract('<script type="application/ld+json">{"@graph":[{"@type":"LocalBusiness","email":"info@shop.neesh-fixture.org","telephone":"+1 212-555-0123","sameAs":["https://instagram.com/shop_fixture/"]},{"@type":"Product","email":"not@other.org"}]}</script>')
        self.assertEqual({c["kind"] for c in contacts}, {"email", "phone", "instagram"})

    def test_cfemail(self):
        email = b"hello@shop.neesh-fixture.org"
        encoded = bytes([37] + [b ^ 37 for b in email]).hex()
        self.assertEqual(self.extract(f'<span data-cfemail="{encoded}"></span>')[0]["value"], email.decode())

    def test_vendor_and_different_domain_need_review(self):
        contacts = self.extract('<a href="mailto:dev@webstudio.org">Website by Web Studio</a>')
        self.assertIn("possible_site_vendor", contacts[0]["review_reasons"])
        self.assertIn("different_mail_domain", contacts[0]["review_reasons"])

    def test_ig_profiles_only_and_exact_host(self):
        for bad in ["https://instagram.com/reels", "https://instagram.com/p/abc", "https://instagram.com/stories/shop/123", "https://fakeinstagram.com/shop", "https://instagram.com.evil.org/shop", "https://instagram.com/shop./", "https://instagram.com/a..b"]:
            self.assertIsNone(instagram_value(bad), bad)
        self.assertEqual(instagram_value("https://www.instagram.com/Shop.Name/?hl=en"), "shop.name")

    def test_phone_e164_and_extensions(self):
        self.assertEqual(phone_value("(212) 555-0123 x204"), ("+12125550123", "204"))
        self.assertEqual(phone_value("tel:+1-718-555-0123;ext=12"), ("+17185550123", "12"))
        self.assertEqual(phone_value("+44 20 7946 0958", "GB"), ("+442079460958", None))
        self.assertIsNone(phone_value("02079460958", "GB"))
        self.assertIsNone(phone_value("1234567890"))

    def test_email_invalid(self):
        for bad in ["x@2x.png", "hello@example.com", "a..b@shop.org", ".a@shop.org", "a@-shop.org", "x@localhost"]:
            self.assertIsNone(email_value(bad), bad)

    def test_phone_published_not_random_digits(self):
        contacts = self.extract('<p>SKU 9876543210</p><a href="tel:2125550123">Call</a>')
        self.assertEqual([c["value"] for c in contacts], ["+12125550123"])

    def test_csv_injection(self):
        self.assertEqual(safe_csv("=HYPERLINK(\"x\")"), "'=HYPERLINK(\"x\")")
        self.assertEqual(safe_csv("+12125550123"), "'+12125550123")
        self.assertEqual(safe_csv("hello@shop.org"), "hello@shop.org")
