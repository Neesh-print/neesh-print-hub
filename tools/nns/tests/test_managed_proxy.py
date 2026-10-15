import contextlib
import io
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from nns.cli import main
from nns.crawler import Crawler
from nns.network import CrawlError, CurlTransport, Resolver, managed_proxy_url

PROXY = {"HTTP_PROXY": "http://127.0.0.1:3128", "HTTPS_PROXY": "http://127.0.0.1:3128", "NO_PROXY": "*"}
SITE = "https://proxy-fixture.neesh-fixture.org"


class ManagedProxyTests(unittest.TestCase):
    def process(self, command, **kwargs):
        self.commands.append(command)
        Path(command[command.index("--dump-header") + 1]).write_text("HTTP/1.1 200 Connection established\r\n\r\nHTTP/2 200 OK\r\nContent-Type: text/html\r\n\r\n")
        body = b"User-agent: *\nAllow: /" if command[-1].endswith("/robots.txt") else b"<p>hello@proxy-fixture.neesh-fixture.org</p>"
        process = unittest.mock.Mock()
        process.stdout = io.BytesIO(body)
        process.wait.return_value = 0
        process.poll.return_value = 0
        return process

    def setUp(self):
        self.commands = []

    def test_explicit_proxy_works_without_local_dns_and_cannot_honor_no_proxy_escape(self):
        with patch.dict(os.environ, PROXY, clear=True), patch.object(Resolver, "resolve", side_effect=AssertionError("Local DNS is unavailable")), patch("subprocess.Popen", side_effect=self.process), patch("time.sleep"):
            transport = CurlTransport(network_mode="managed-proxy")
            job = Crawler(transport).crawl(SITE)
        self.assertEqual(job["status"], "completed")
        self.assertEqual(job["http_requests"], 2)
        self.assertEqual(job["dns_requests"], 0)
        self.assertEqual(job["contacts"][0]["value"], "hello@proxy-fixture.neesh-fixture.org")
        self.assertEqual(job["policy"]["network_mode"], "managed-proxy")
        for command in self.commands:
            self.assertEqual(command[command.index("--proxy") + 1], PROXY["HTTP_PROXY"])
            self.assertEqual(command[command.index("--noproxy") + 1], "")
            self.assertNotIn("--connect-to", command)
            self.assertNotIn("--location", command)
            self.assertNotIn("--insecure", command)

    def test_default_remains_dns_pinned_even_with_proxy_environment(self):
        with patch.dict(os.environ, PROXY, clear=True), patch.object(Resolver, "resolve", side_effect=CrawlError("dns_failed")), patch("subprocess.Popen") as process:
            job = Crawler().crawl(SITE)
        self.assertEqual(job["errors"][0]["code"], "dns_failed")
        process.assert_not_called()

    def test_proxy_missing_remote_credentialed_or_inconsistent_configuration_rejected(self):
        for environment in ({}, {"HTTP_PROXY": PROXY["HTTP_PROXY"]}, {**PROXY, "http_proxy": "http://127.0.0.1:9999"}, {"HTTP_PROXY": "http://proxy.remote.org:3128", "HTTPS_PROXY": "http://proxy.remote.org:3128"}, {"HTTP_PROXY": "http://user:secret@127.0.0.1:3128", "HTTPS_PROXY": "http://user:secret@127.0.0.1:3128"}):
            with self.subTest(environment=list(environment)), self.assertRaises(ValueError):
                managed_proxy_url(environment)

    def test_proxy_configuration_change_fails_before_request(self):
        with patch.dict(os.environ, PROXY, clear=True):
            transport = CurlTransport(network_mode="managed-proxy")
            with patch.dict(os.environ, {"HTTP_PROXY": "http://127.0.0.1:9999", "HTTPS_PROXY": "http://127.0.0.1:9999"}), patch("subprocess.Popen") as process:
                with self.assertRaisesRegex(CrawlError, "proxy_configuration_changed"):
                    transport.get(SITE)
                process.assert_not_called()

    def test_proxy_denial_never_falls_back(self):
        def denied(command, **kwargs):
            process = self.process(command, **kwargs)
            Path(command[command.index("--dump-header") + 1]).write_text("HTTP/1.1 403 Forbidden\r\nContent-Type: text/plain\r\n\r\n")
            process.stdout = io.BytesIO(b"Denied by managed policy")
            return process
        with patch.dict(os.environ, PROXY, clear=True), patch("subprocess.Popen", side_effect=denied):
            job = Crawler(CurlTransport(network_mode="managed-proxy")).crawl(SITE)
        self.assertEqual(job["status"], "blocked")
        # robots.txt (a 4xx places no rules) then the homepage, both through the proxy; no retry elsewhere.
        self.assertEqual(len(self.commands), 2)

    def test_local_literals_and_credentialed_targets_remain_blocked(self):
        with patch.dict(os.environ, PROXY, clear=True), patch("subprocess.Popen") as process:
            for url in ("http://127.0.0.1", "http://169.254.169.254/", "http://[::1]/", "https://user:secret@site.org/"):
                self.assertEqual(Crawler(CurlTransport(network_mode="managed-proxy")).crawl(url)["status"], "blocked")
            process.assert_not_called()

    def test_cli_records_delegated_validation_and_skips_dns_preflight(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, PROXY, clear=True), patch.object(Resolver, "resolve", side_effect=AssertionError("No local DNS")), patch("subprocess.Popen", side_effect=self.process), patch("time.sleep"), contextlib.redirect_stdout(io.StringIO()):
            root = Path(folder)
            source = root / "source.json"
            source.write_text(json.dumps([{"id": "fixture", "city": "NYC", "website": SITE}]))
            self.assertEqual(main(["--input", str(source), "--output", str(root / "run"), "--network-mode", "managed-proxy"]), 0)
            manifest = json.loads((root / "run/manifest.json").read_text())
            summary = json.loads((root / "run/summary.json").read_text())
            self.assertEqual(manifest["destination_validation"], "url_checks_and_managed_proxy_egress_policy")
            self.assertEqual(manifest["preflight"]["probes"], [])
            self.assertEqual(summary["http_requests"], 2)
            self.assertEqual(summary["website_observed_contact_records"]["email"], 1)
