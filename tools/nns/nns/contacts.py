"""Extract published contacts. No guessing, profile requests, or SMTP probing."""
from __future__ import annotations

import hashlib
import html
import json
import re
from html.parser import HTMLParser
from urllib.parse import unquote, urljoin, urlsplit, urlunsplit

EMAIL_RE = re.compile(r"(?<![\w.+-])([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,63})(?![\w.-])")
ROLE_PREFIXES = frozenset("hello info contact shop store sales support orders buying buyer buyers wholesale retail partnerships press events reservations booking bookings team office admin general customerservice service enquiries inquiries mail staff welcome studio".split())
NO_REPLY = frozenset(["noreply", "no-reply", "donotreply", "do-not-reply"])
FREE_MAIL = frozenset(["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com", "icloud.com", "proton.me", "protonmail.com"])
IG_RESERVED = frozenset("p reel reels tv stories explore accounts developer developers about legal privacy directory direct challenge oauth web share".split())
CREDIT_RE = re.compile(r"(?:web(?:site)?\s+(?:design|development|by)|(?:site|design|powered)\s+by|sentry|example\.com)", re.I)
PHONE_RE = re.compile(r"(?<!\w)(?:\+?1[ .-]?)?(?:\([2-9]\d{2}\)\s*|[2-9]\d{2}[ .-])[2-9]\d{2}[ .-]\d{4}(?:\s*(?:ext\.?|extension|x)\s*\d{1,6})?(?!\d)", re.I)


def canonical_host(value: str) -> str:
    host = (urlsplit(value if "://" in value else "https://" + value).hostname or "").lower().rstrip(".")
    return host.removeprefix("www.")


def email_value(value: str) -> str | None:
    value = html.unescape(unquote(value)).strip().lower().removeprefix("mailto:").split("?")[0].strip("<> \t\r\n").rstrip(".,;:")
    if len(value) > 254 or not EMAIL_RE.fullmatch(value):
        return None
    local, domain = value.rsplit("@", 1)
    if len(local) > 64 or local.startswith(".") or local.endswith(".") or ".." in value:
        return None
    labels = domain.split(".")
    if any(not p or len(p) > 63 or p.startswith("-") or p.endswith("-") for p in labels):
        return None
    if domain in {"example.com", "example.org", "example.net", "domain.com", "email.com", "test.com", "yourdomain.com"} or domain.endswith((".png", ".jpg", ".jpeg", ".webp", ".svg", ".css", ".js")):
        return None
    return value


def email_role(value: str) -> str:
    prefix = value.split("@")[0]
    if prefix in ROLE_PREFIXES or prefix.split(".")[0] in ROLE_PREFIXES:
        return "role"
    if prefix in NO_REPLY:
        return "other"
    # A name-shaped local part does not prove this is a named buyer.
    return "unknown"


def phone_value(raw: str, country: str = "US") -> tuple[str, str | None] | None:
    value = unquote(raw).strip().removeprefix("tel:")
    ext_match = re.search(r"(?:;ext=|\bext(?:ension)?\.?\s*|\bx\s*)(\d{1,6})$", value, re.I)
    ext = ext_match.group(1) if ext_match else None
    if ext_match:
        value = value[:ext_match.start()]
    if re.search(r"[a-zA-Z]", value):
        return None
    digits = re.sub(r"\D", "", value)
    if country.upper() in {"US", "CA"} and not value.startswith("+"):
        if len(digits) == 10:
            digits = "1" + digits
        if len(digits) != 11 or digits[0] != "1":
            return None
    elif not value.startswith("+"):
        return None  # No guessed country code for non-NANP numbers.
    if not 8 <= len(digits) <= 15 or digits.startswith("0"):
        return None
    if digits.startswith("1") and (len(digits) != 11 or digits[1] not in "23456789" or digits[4] not in "23456789"):
        return None
    return "+" + digits, ext


def instagram_value(value: str) -> str | None:
    try:
        url = urlsplit(value if "://" in value or value.startswith("//") else "https://" + value)
        if (url.hostname or "").lower().removeprefix("www.") not in {"instagram.com", "instagr.am"}:
            return None
        parts = url.path.strip("/").split("/")
        if len(parts) != 1:
            return None
        handle = parts[0].lower()
        if handle in IG_RESERVED or not re.fullmatch(r"[a-z0-9_](?:[a-z0-9_.]{0,28}[a-z0-9_])?", handle) or ".." in handle:
            return None
        return handle
    except ValueError:
        return None


class PageParser(HTMLParser):
    """Collect visible text, actual links and JSON-LD; ignore app/script blobs."""
    VOID = frozenset("area base br col embed hr img input link meta param source track wbr".split())

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[tuple[str, bool]] = []
        self.text: list[str] = []
        self.links: list[dict] = []
        self.json_ld: list[str] = []
        self._json: list[str] | None = None
        self._anchor: dict | None = None
        self.obfuscated: list[str] = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        hidden = bool(self.stack and self.stack[-1][1]) or tag in {"script", "style", "template", "noscript", "svg"} or "hidden" in a or a.get("aria-hidden") == "true" or bool(re.search(r"display\s*:\s*none|visibility\s*:\s*hidden", a.get("style") or "", re.I))
        if tag == "script" and (a.get("type") or "").lower() == "application/ld+json":
            self._json = []
        if tag not in self.VOID:
            self.stack.append((tag, hidden))
        if hidden:
            return
        if tag == "a" and a.get("href"):
            self._anchor = {"url": a["href"], "text": "", "position": len(self.text)}
            self.links.append(self._anchor)
        if a.get("data-cfemail"):
            try:
                data = bytes.fromhex(a["data-cfemail"])
                self.obfuscated.append(bytes(x ^ data[0] for x in data[1:]).decode("utf-8"))
            except (ValueError, IndexError, UnicodeDecodeError):
                pass

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in self.VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag == "script" and self._json is not None:
            self.json_ld.append("".join(self._json))
            self._json = None
        if tag == "a":
            self._anchor = None
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        if self._json is not None:
            self._json.append(data)
        if self.stack and self.stack[-1][1]:
            return
        value = " ".join(data.split())
        if value:
            self.text.append(value)
            if self._anchor is not None:
                self._anchor["text"] += " " + value


def deobfuscate(text: str) -> str:
    text = re.sub(r"\s*(?:\[at\]|\(at\))\s*", "@", text, flags=re.I)
    text = re.sub(r"\s*(?:\[dot\]|\(dot\))\s*", ".", text, flags=re.I)
    # Plain 'at' is only unambiguous between an email local-part and domain.
    return re.sub(r"\b([\w.+-]+)\s+at\s+([\w.-]+\.[a-z]{2,})\b", r"\1@\2", text, flags=re.I)


def extract_contacts(body: str, source_url: str, checked_at: str, country: str = "US") -> dict:
    parser = PageParser()
    parser.feed(body)
    visible = "\n".join(parser.text)
    page_hash = hashlib.sha256(body.encode()).hexdigest()
    host = canonical_host(source_url)
    found: dict[tuple, dict] = {}

    def joined(raw):
        try:
            return urljoin(source_url, raw)
        except ValueError:
            return ""

    def add(kind, raw, method, excerpt, attribution="website_published"):
        ext = None
        if kind == "email":
            value = email_value(raw)
        elif kind == "phone":
            phone = phone_value(raw, country)
            value, ext = phone if phone else (None, None)
        else:
            value = instagram_value(joined(raw))
        if not value:
            return
        reasons = []
        if CREDIT_RE.search(excerpt):
            reasons.append("possible_site_vendor")
        if kind == "email":
            domain = value.split("@")[1]
            if not (domain == host or host.endswith("." + domain) or domain.endswith("." + host) or domain in FREE_MAIL):
                reasons.append("different_mail_domain")
            if value.split("@")[0] in NO_REPLY:
                reasons.append("non_reply_address")
        key = (kind, value, ext)
        evidence = {"source_url": source_url, "extract_method": method, "excerpt_or_signal": excerpt[:240], "observed_at": checked_at, "content_hash": page_hash}
        if key not in found:
            found[key] = {"kind": kind, "value": value, "extension": ext, "role_type": email_role(value) if kind == "email" else None, "quality_status": "observed_on_website", "mail_domain_status": "not_checked" if kind == "email" else None, "attribution": attribution, "review_reasons": reasons, "evidence": []}
        else:
            # An independently clear occurrence may resolve a nearby vendor label.
            found[key]["review_reasons"] = sorted(set(found[key]["review_reasons"]) & set(reasons))
        if evidence not in found[key]["evidence"]:
            found[key]["evidence"].append(evidence)

    for link in parser.links:
        href = html.unescape(link["url"])
        context = " ".join(parser.text[max(0, link["position"] - 1):link["position"] + 2])
        if href.lower().startswith("mailto:"):
            for address in re.split(r"[,;]", unquote(href[7:].split("?")[0])):
                add("email", address, "mailto", context or href)
        elif href.lower().startswith("tel:"):
            add("phone", href, "tel", context or href)
        elif instagram_value(joined(href)):
            add("instagram", href, "website_link", context or href)

    for raw in parser.obfuscated:
        add("email", raw, "html_obfuscation", raw)
    normalized_text = deobfuscate(visible)
    for match in EMAIL_RE.finditer(normalized_text):
        add("email", match.group(), "visible_text" if match.group() in visible else "written_obfuscation", normalized_text[max(0, match.start() - 65):match.end() + 65])
    for match in PHONE_RE.finditer(visible):
        add("phone", match.group(), "visible_text", visible[max(0, match.start() - 35):match.end() + 35])

    def walk(value, business=False, depth=0):
        if depth > 20:
            return
        if isinstance(value, list):
            for item in value:
                walk(item, business, depth + 1)
        elif isinstance(value, dict):
            typ = value.get("@type", [])
            types = [typ] if isinstance(typ, str) else typ if isinstance(typ, list) else []
            business = bool({t for t in types if isinstance(t, str)} & {"Organization", "LocalBusiness", "Store", "BookStore", "Restaurant", "CafeOrCoffeeShop", "BarOrPub", "Hotel", "ArtGallery", "HealthAndBeautyBusiness", "BeautySalon", "HairSalon", "ProfessionalService", "Dentist", "MedicalBusiness", "ContactPoint"})
            for key, item in value.items():
                if business and key in {"email", "telephone", "sameAs"}:
                    for raw in item if isinstance(item, list) else [item]:
                        if isinstance(raw, str):
                            add({"email": "email", "telephone": "phone", "sameAs": "instagram"}[key], raw, "json_ld", raw, "structured_business")
                elif isinstance(item, (dict, list)):
                    walk(item, business, depth + 1)
    for raw in parser.json_ld:
        try:
            walk(json.loads(raw))
        except (ValueError, RecursionError):
            pass
    return {"contacts": list(found.values()), "links": parser.links, "text": visible, "content_hash": page_hash}


def contact_rank(contact: dict) -> tuple:
    value = contact["value"]
    local = value.split("@")[0]
    commercial = local in {"buying", "buyer", "buyers", "wholesale", "retail", "partnerships"}
    general = local in {"hello", "info", "contact", "shop", "store", "sales"}
    return (bool(contact.get("review_reasons")), not commercial, not general, value)


def safe_csv(value) -> str:
    """Prevent formula execution when an exported file is opened in a spreadsheet."""
    value = "" if value is None else str(value)
    return "'" + value if value.lstrip().startswith(("=", "+", "-", "@", "\t", "\r")) else value
