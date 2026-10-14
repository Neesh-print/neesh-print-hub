import socket
import unittest
from unittest.mock import patch

from nns.network import CrawlError, Resolver, Robots, normalize_url, public_ip


class NetworkTests(unittest.TestCase):
    def test_unsafe_url_forms(self):
        urls = ["http://127.0.0.1", "http://[::1]/", "http://169.254.169.254/", "http://localhost/", "http://foo.internal/", "ftp://shop.org/", "file:///etc/passwd", "https://user:pass@shop.org/", "https://shop.org:8080/", "https://shop.org\\@127.0.0.1", "https://shop.org/\nX-Token: secret", "https://[::ffff:127.0.0.1]/"]
        for url in urls:
            with self.subTest(url=url), self.assertRaises(CrawlError):
                normalize_url(url)

    def test_private_and_transition_ranges(self):
        for ip in ["10.0.0.1", "100.64.0.1", "192.168.1.1", "172.16.0.1", "0.0.0.0", "224.0.0.1", "::1", "fc00::1", "fe80::1", "2002:7f00:1::", "64:ff9b::7f00:1", "::ffff:8.8.8.8"]:
            self.assertFalse(public_ip(ip), ip)
        self.assertTrue(public_ip("8.8.8.8"))

    def test_mixed_dns_answers_fail_closed(self):
        answers = [(socket.AF_INET, 1, 6, "", ("8.8.8.8", 443)), (socket.AF_INET, 1, 6, "", ("127.0.0.1", 443))]
        with patch.object(Resolver, "resolve_system", return_value=["8.8.8.8", "127.0.0.1"]), self.assertRaises(CrawlError):
            Resolver().resolve("shop.org")

    def test_dns_error_not_treated_as_permission(self):
        with patch.object(Resolver, "resolve_system", side_effect=CrawlError("dns_failed")), self.assertRaises(CrawlError) as ctx:
            Resolver().resolve("shop.org")
        self.assertEqual(ctx.exception.code, "dns_failed")

    def test_obscure_loopback_resolves_to_block(self):
        with patch.object(Resolver, "resolve_system", return_value=["127.0.0.1"]), self.assertRaises(CrawlError):
            Resolver().resolve("2130706433")

    def test_providers_not_crawled(self):
        for host in ["instagram.com", "www.yelp.com", "api.hasdata.com", "ensembledata.com", "ai.gateway.lovable.dev"]:
            with self.assertRaises(CrawlError):
                normalize_url("https://" + host + "/")

    def test_robots_longest_match_wildcard_allow_tie(self):
        robots = Robots("User-agent: *\nDisallow: /private\nAllow: /private/contact$\nDisallow: /*?secret=\nCrawl-delay: 2")
        self.assertTrue(robots.allowed("https://shop.org/private/contact"))
        self.assertFalse(robots.allowed("https://shop.org/private/contact/other"))
        self.assertFalse(robots.allowed("https://shop.org/contact?secret=x"))
        self.assertEqual(robots.delay, 2)

    def test_robots_specific_agent_overrides_wildcard(self):
        robots = Robots("User-agent: *\nDisallow: /\nUser-agent: Nustand\nAllow: /contact\nDisallow: /private")
        self.assertTrue(robots.allowed("https://shop.org/contact"))
        self.assertFalse(robots.allowed("https://shop.org/private"))
