"""Choose a website candidate from commercial place lookups run by the broker.

The broker (Supabase Edge) holds the provider keys and returns a few candidate
listings per space. This module only decides whether one listing is a safe
enough name match to research. A match is always a candidate that the owner
must confirm; it never merges entities or marks a website as verified.
"""
from __future__ import annotations

import re
import unicodedata
import urllib.parse

PROVIDERS = ("foursquare", "google")  # Preference order when both match.
LABELS = {"foursquare": "Foursquare Places", "google": "Google Places"}
_PLACE = {"st", "street", "ave", "avenue", "blvd", "rd", "road", "pl", "place", "sq", "square", "soho", "noho", "tribeca", "chelsea", "williamsburg", "greenpoint", "bushwick", "dumbo", "harlem", "midtown", "downtown", "uptown", "les", "ues", "uws", "ridgewood", "astoria", "seaport", "flatiron", "nolita", "fidi", "slope", "heights", "hill", "village"}
_STOP = {"the", "nyc", "ny", "new", "york", "brooklyn", "manhattan", "queens", "bronx", "inc", "llc", "co", "shop", "store"}


def normalize(name: str) -> str:
    text = unicodedata.normalize("NFKD", str(name or "")).encode("ascii", "ignore").decode()
    text = text.casefold().replace("&", " and ").replace("+", " and ")
    text = re.sub(r"[’'`]", "", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return " ".join(text.split())


def _core(name: str) -> str:
    """Name without a branch suffix such as ' - Downtown Brooklyn' or ' (SoHo)'."""
    base = re.split(r"\s[-–—|:]\s|\s\(", str(name or ""), maxsplit=1)[0]
    return normalize(base)


def _tokens(text: str) -> set[str]:
    return {t for t in text.split() if t not in _STOP and len(t) > 1}


def names_match(imported: str, listed: str) -> bool:
    a_full, a_core, b = normalize(imported), _core(imported), normalize(listed)
    if not a_core or not b:
        return False
    if b in (a_full, a_core) or _core(listed) in (a_full, a_core):
        return True
    a_tok, b_tok = _tokens(a_core), _tokens(b)
    if not a_tok or not b_tok:
        return False
    # Every distinctive word of the imported name must appear in the listing,
    # and the listing may add at most two words (e.g. "Books", "Cafe").
    if a_tok <= b_tok and len(b_tok - a_tok) <= 2:
        return True
    # Or the listing is the brand name and the import adds a branch descriptor
    # without a dash ("Books Are Magic Montague St"). The listing must lead the
    # imported name, and either be a distinctive brand (3+ words) or leave a
    # tail that reads as a place (street or neighborhood), never a trade word.
    tail = _tokens(a_full[len(b):]) if a_full.startswith(b + " ") else None
    if not tail or len(tail) > 2:
        return False
    return len(b_tok) >= 3 or bool(tail & _PLACE)


_TRACKING = re.compile(r"^(utm_|gclid$|fbclid$|mc_|ref$|y_source$)", re.I)


def clean_url(url: str) -> str:
    """Drop tracking parameters that listings append (e.g. utm_source=google)."""
    parts = urllib.parse.urlsplit(url)
    query = [(k, v) for k, v in urllib.parse.parse_qsl(parts.query, keep_blank_values=True) if not _TRACKING.match(k)]
    return urllib.parse.urlunsplit((parts.scheme, parts.netloc, parts.path, urllib.parse.urlencode(query), ""))


def _domain(url: str) -> str:
    host = (urllib.parse.urlsplit(url).hostname or "").casefold()
    return host[4:] if host.startswith("www.") else host


def choose(imported_name: str, lookup: dict | None) -> tuple[dict | None, dict]:
    """Return (candidate for research(), per-provider summary for evaluation)."""
    summary = {}
    picked = None
    for provider in PROVIDERS:
        rows = ((lookup or {}).get(provider) or {}).get("candidates") or []
        error = ((lookup or {}).get(provider) or {}).get("error")
        matches = [r for r in rows if isinstance(r, dict) and names_match(imported_name, r.get("name", ""))]
        with_site = [{**r, "website": clean_url(r["website"])} for r in matches if isinstance(r.get("website"), str) and r["website"].startswith(("http://", "https://"))]
        # Branch listings of one business share a domain but not always a page.
        sites = {_domain(r["website"]) for r in with_site}
        chosen = None
        if len(sites) == 1 and with_site:
            roots = [r for r in with_site if urllib.parse.urlsplit(r["website"]).path in ("", "/")]
            chosen = roots[0] if roots else with_site[0]
        summary[provider] = {
            "checked": provider in (lookup or {}),
            "error": error,
            "listings": len(rows),
            "listing_names": [str(r.get("name", ""))[:120] for r in rows[:3] if isinstance(r, dict)],
            "name_matches": len(matches),
            "website": chosen["website"] if chosen else None,
            "ambiguous": len(sites) > 1,
        }
        if chosen and picked is None:
            picked = {
                "website": chosen["website"],
                "original_record": {k: v for k, v in (("phone", chosen.get("phone")), ("email", chosen.get("email")), ("instagram_handle", chosen.get("instagram"))) if v},
                "discovery": {"source_url": chosen.get("source_url"), "source_label": LABELS[provider], "provider": provider},
            }
    return picked, summary
