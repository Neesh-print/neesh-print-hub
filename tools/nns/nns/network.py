"""Bounded public-web transport with DNS validation and connection pinning.

Requires Python 3.11+ and curl. Uses the host's DNS and configured proxy/access
rules. Restricted runtimes fail closed; there is no alternate resolver fallback.
"""
from __future__ import annotations

import ipaddress
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from urllib.parse import quote, urlsplit, urlunsplit

USER_AGENT = "NeeshNNS/0.1 (+https://neesh.art; public business contact research)"
SOCIAL_HOSTS = frozenset("instagram.com instagr.am facebook.com fb.com twitter.com x.com linkedin.com tiktok.com youtube.com yelp.com maps.google.com google.com".split())
PAID_HOSTS = frozenset("api.hasdata.com api.enigma.com ensembledata.com ai.gateway.lovable.dev places.googleapis.com api.yelp.com".split())


class CrawlError(Exception):
    def __init__(self, code: str, detail: str = ""):
        super().__init__(code)
        self.code, self.detail = code, detail[:200]


def normalize_url(raw: str) -> str:
    raw = (raw or "").strip()
    if not raw or any(ord(c) < 32 for c in raw) or "\\" in raw:
        raise CrawlError("unsafe_url")
    if "://" not in raw:
        raw = "https://" + raw
    try:
        p = urlsplit(raw)
        if p.scheme not in {"http", "https"} or not p.hostname or p.username or p.password or p.port not in {None, 80, 443}:
            raise CrawlError("unsafe_url")
        host = p.hostname.rstrip(".").encode("idna").decode().lower()
        if "%" in host or not re.fullmatch(r"[a-z0-9.:-]+", host):
            raise CrawlError("unsafe_url")
        if host in {"localhost", "metadata.google.internal"} or host.endswith((".localhost", ".local", ".internal", ".home", ".lan", ".test", ".invalid", ".example")) or "." not in host and ":" not in host:
            raise CrawlError("unsafe_destination")
        try:
            ip = ipaddress.ip_address(host)
        except ValueError:
            pass
        else:
            if not public_ip(str(ip)):
                raise CrawlError("unsafe_destination")
        if any(host == s or host.endswith("." + s) for s in SOCIAL_HOSTS | PAID_HOSTS):
            raise CrawlError("excluded_provider")
        netloc = f"[{host}]" if ":" in host else host
        if p.port is not None:
            netloc += f":{p.port}"
        return urlunsplit((p.scheme, netloc, quote(p.path or "/", safe="/%:@-._~!$&'()*+,;="), p.query, ""))
    except (ValueError, UnicodeError) as exc:
        raise CrawlError("unsafe_url") from exc


def public_ip(value: str) -> bool:
    try:
        ip = ipaddress.ip_address(value)
        # Reject transition mechanisms; a public v6 wrapper may target private v4.
        return ip.is_global and not ip.is_multicast and not ip.is_unspecified and not ip.is_reserved and not getattr(ip, "ipv4_mapped", None) and not getattr(ip, "sixtofour", None) and not getattr(ip, "teredo", None) and not (isinstance(ip, ipaddress.IPv6Address) and ip in ipaddress.ip_network("64:ff9b::/96"))
    except ValueError:
        return False


def site_key(url: str) -> str:
    return (urlsplit(url).hostname or "").lower().removeprefix("www.").rstrip(".")


class Resolver:
    def __init__(self, timeout=8):
        self.timeout = timeout
        self.cache: dict[str, list[str]] = {}
        self.requests = 0

    def resolve_system(self, host: str) -> list[str]:
        # getaddrinfo can block longer than socket timeouts. A subprocess gives
        # this OS-level call a hard deadline without leaving a background thread.
        code = "import json,socket,sys; print(json.dumps([r[4][0] for r in socket.getaddrinfo(sys.argv[1],443,type=socket.SOCK_STREAM)]))"
        try:
            result = subprocess.run([sys.executable, "-c", code, host], capture_output=True, timeout=self.timeout, check=True, text=True)
            return json.loads(result.stdout)
        except (subprocess.SubprocessError, ValueError, OSError) as exc:
            raise CrawlError("dns_failed") from exc

    def resolve(self, host: str) -> list[str]:
        if host in self.cache:
            return self.cache[host]
        try:
            literal = str(ipaddress.ip_address(host))
            addresses = [literal]
        except ValueError:
            self.requests += 1
            addresses = self.resolve_system(host)
        if not addresses:
            raise CrawlError("dns_not_found")
        if not all(public_ip(address) for address in addresses):
            raise CrawlError("unsafe_destination")
        # Prefer v4, but do not discard/refrain from validating v6 answers.
        self.cache[host] = sorted(set(addresses), key=lambda v: (":" in v, v))
        return self.cache[host]


@dataclass
class Response:
    url: str
    status: int
    headers: dict[str, str]
    body: str


class CurlTransport:
    def __init__(self, resolver=None, timeout=12, max_bytes=1_500_000, min_delay=1.0):
        if not 1 <= timeout <= 60 or not 1024 <= max_bytes <= 5_000_000 or min_delay < 1:
            raise ValueError("Unsafe network limits")
        self.resolver = resolver or Resolver()
        self.timeout, self.max_bytes, self.min_delay = timeout, max_bytes, min_delay
        self.last_request: dict[str, float] = {}
        self.requests = 0

    def get(self, raw_url: str, delay=None) -> Response:
        url = normalize_url(raw_url)
        p = urlsplit(url)
        host, port = p.hostname, p.port or (443 if p.scheme == "https" else 80)
        ip = self.resolver.resolve(host)[0]
        host_key = site_key(url)
        wait = max(self.min_delay, delay or 0) - (time.monotonic() - self.last_request.get(host_key, 0))
        if wait > 0:
            time.sleep(wait)
        self.last_request[host_key] = time.monotonic()
        self.requests += 1
        # --connect-to affects the TCP/CONNECT destination while preserving Host,
        # TLS SNI and certificate verification for the original website hostname.
        ip_literal = f"[{ip}]" if ":" in ip else ip
        host_literal = f"[{host}]" if ":" in host else host
        with tempfile.TemporaryDirectory(prefix="nns-http-") as tmp:
            header_path = os.path.join(tmp, "headers")
            command = ["curl", "-q", "--silent", "--show-error", "--globoff", "--proto", "=http,https", "--max-time", str(self.timeout), "--connect-timeout", str(min(5, self.timeout)), "--max-filesize", str(self.max_bytes), "--connect-to", f"{host_literal}:{port}:{ip_literal}:{port}", "--user-agent", USER_AGENT, "--header", "Accept: text/html,application/xhtml+xml,text/plain;q=0.8", "--header", "Accept-Encoding: identity", "--dump-header", header_path, "--url", url]
            try:
                process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            except OSError as exc:
                raise CrawlError("curl_unavailable") from exc
            try:
                raw = process.stdout.read(self.max_bytes + 1)
                if len(raw) > self.max_bytes:
                    raise CrawlError("response_too_large")
                returncode = process.wait(timeout=self.timeout + 2)
                if returncode:
                    raise CrawlError({28: "timeout", 63: "response_too_large", 60: "tls_failed", 6: "dns_failed"}.get(returncode, "network_failed"))
            finally:
                if process.poll() is None:
                    process.kill()
                    process.wait()
                process.stdout.close()
            with open(header_path, "rb") as f:
                headers_raw = f.read(65537)
            if len(headers_raw) > 65536:
                raise CrawlError("headers_too_large")
        blocks = re.split(rb"\r?\n\r?\n", headers_raw)
        block = next((b for b in reversed(blocks) if b.startswith(b"HTTP/")), b"")
        lines = block.decode("iso-8859-1").splitlines()
        if not lines or not re.match(r"HTTP/\S+ \d{3}", lines[0]):
            raise CrawlError("invalid_response")
        status = int(lines[0].split()[1])
        headers = {line.split(":", 1)[0].lower(): line.split(":", 1)[1].strip() for line in lines[1:] if ":" in line}
        charset = re.search(r"charset=[\"']?([\w-]+)", headers.get("content-type", ""), re.I)
        try:
            body = raw.decode(charset.group(1) if charset else "utf-8", errors="replace")
        except LookupError:
            body = raw.decode("utf-8", errors="replace")
        return Response(url, status, headers, body)


class Robots:
    """Longest-match Allow/Disallow, wildcard/end anchors, specific UA groups."""
    def __init__(self, text: str, agent="NeeshNNS"):
        groups, agents, rules, delays = [], [], [], []
        seen_rule = False
        for line in text.splitlines():
            line = line.split("#", 1)[0].strip()
            if ":" not in line:
                continue
            key, value = [x.strip() for x in line.split(":", 1)]
            key = key.lower()
            if key == "user-agent":
                if seen_rule:
                    groups.append((agents, rules, delays))
                    agents, rules, delays, seen_rule = [], [], [], False
                agents.append(value.lower())
            elif agents and key in {"allow", "disallow", "crawl-delay"}:
                seen_rule = True
                if key == "crawl-delay":
                    try:
                        delay = float(value)
                        if delay >= 0:
                            delays.append(delay)
                    except ValueError:
                        pass
                elif value:
                    rules.append((key == "allow", value))
        groups.append((agents, rules, delays))
        specific = [g for g in groups if any(a != "*" and a in agent.lower() for a in g[0])]
        chosen = specific or [g for g in groups if "*" in g[0]]
        self.rules = [rule for group in chosen for rule in group[1]]
        self.delay = max([1.0] + [delay for group in chosen for delay in group[2]])

    def allowed(self, url: str) -> bool:
        p = urlsplit(url)
        path = robots_path(p.path + ("?" + p.query if p.query else ""))
        matches = []
        for allow, pattern in self.rules:
            anchor = pattern.endswith("$")
            raw = robots_path(pattern[:-1] if anchor else pattern)
            expression = "^" + re.escape(raw).replace(r"\*", ".*") + ("$" if anchor else "")
            if re.search(expression, path):
                matches.append((len(raw.replace("*", "")), allow))
        return max(matches, default=(0, True))[1]


def robots_path(path: str) -> str:
    """RFC 9309 unreserved percent decoding; retain escaped reserved octets."""
    def decode(match):
        char = chr(int(match.group()[1:], 16))
        return char if re.fullmatch(r"[A-Za-z0-9._~-]", char) else match.group().upper()
    return quote(re.sub(r"%[0-9a-fA-F]{2}", decode, path), safe="/%:?=&!$'()*+,;@-._~")
