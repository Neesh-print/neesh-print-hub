"""Choose a website candidate from commercial place lookups run by the broker.

The broker (Supabase Edge) holds the provider keys and returns a few candidate
listings per space. This module only decides whether one listing is a safe
enough name match to research. A match is always a candidate that the owner
must confirm; it never merges entities or marks a website as verified.
"""
from __future__ import annotations

import re
import unicodedata

PROVIDERS = ("foursquare", "google")  # Preference order when both match.
LABELS = {"foursquare": "Foursquare Places", "google": "Google Places"}
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
    return a_tok <= b_tok and len(b_tok - a_tok) <= 2


def choose(imported_name: str, lookup: dict | None) -> tuple[dict | None, dict]:
    """Return (candidate for research(), per-provider summary for evaluation)."""
    summary = {}
    picked = None
    for provider in PROVIDERS:
        rows = ((lookup or {}).get(provider) or {}).get("candidates") or []
        error = ((lookup or {}).get(provider) or {}).get("error")
        matches = [r for r in rows if isinstance(r, dict) and names_match(imported_name, r.get("name", ""))]
        with_site = [r for r in matches if isinstance(r.get("website"), str) and r["website"].startswith(("http://", "https://"))]
        sites = {r["website"].rstrip("/").casefold() for r in with_site}
        chosen = with_site[0] if len(sites) == 1 else None
        summary[provider] = {
            "checked": provider in (lookup or {}),
            "error": error,
            "listings": len(rows),
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
