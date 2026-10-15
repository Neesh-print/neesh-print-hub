"""Bounded OpenStreetMap discovery and candidate website lookup; no SERP scraping."""
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

ENDPOINT = "https://overpass-api.de/api/interpreter"
ATTRIBUTION = "© OpenStreetMap contributors, ODbL"
LICENSE = "https://www.openstreetmap.org/copyright"
BBOX = {
    "New York": "40.49,-74.26,40.92,-73.70",
    "Manhattan": "40.68,-74.03,40.88,-73.90",
    "Brooklyn": "40.56,-74.05,40.74,-73.83",
    "Queens": "40.54,-73.97,40.81,-73.70",
    "Bronx": "40.78,-73.94,40.92,-73.76",
    "Staten Island": "40.49,-74.26,40.65,-74.05",
}
SEGMENTS = {
    "Wait": [("shop", "hairdresser|beauty"), ("amenity", "dentist|clinic|doctors")],
    "Presence": [("amenity", "cafe|restaurant|bar")],
    "Dwell": [("shop", "clothes|furniture|interior_decoration|gift"), ("tourism", "gallery")],
    "Taste": [("tourism", "hotel"), ("office", "coworking|advertising")],
    "Catalog": [("shop", "books|music|newsagent|florist"), ("shop", "museum")],
}


class PlaceError(Exception):
    pass


def query(area="New York", segment=None, neighborhood="", names=None):
    if area not in BBOX or (segment is not None and segment not in SEGMENTS):
        raise PlaceError("Unsupported discovery area or segment")
    if len(neighborhood) > 100 or names is not None and not 1 <= len(names) <= 10:
        raise PlaceError("Invalid place query")
    suffix = '["addr:suburb"=' + json.dumps(neighborhood) + "]" if neighborhood else ""
    selectors = []
    if names is not None:
        if any(not isinstance(n, str) or not 1 <= len(n) <= 200 for n in names):
            raise PlaceError("Invalid place names")
        # Exact-name indexes avoid scanning every named object for a regex.
        selectors.extend('nwr["name"=' + json.dumps(n.strip()) + ']' + suffix for n in names)
    else:
        for key, pattern in SEGMENTS[segment]:
            selectors.append('nwr["name"]["' + key + '"~"^(' + pattern + ')$"]' + suffix)
    return '[out:json][timeout:10][maxsize:64000000];(' + "".join(s + "(" + BBOX[area] + ");" for s in selectors) + ');out center tags 100;'


def fetch_places(ql):
    request = urllib.request.Request(ENDPOINT, data=urllib.parse.urlencode({"data": ql}).encode(), headers={"User-Agent": "Nustand/0.3 (+https://neesh.art)", "Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            raw = response.read(200_001)
        if len(raw) > 200_000:
            raise PlaceError("Place response exceeded size limit")
        result = json.loads(raw)
        if result.get("remark"):
            raise PlaceError("Place provider returned incomplete results")
        return result.get("elements", [])
    except urllib.error.HTTPError as exc:
        raise PlaceError("Place provider rate limited or unavailable" if exc.code in {429, 504} else "Place provider rejected the request") from exc
    except (urllib.error.URLError, ValueError, TimeoutError) as exc:
        raise PlaceError("Place provider unavailable") from exc


def record(element, segment=None):
    tags = element.get("tags", {})
    name = tags.get("name")
    if not isinstance(name, str) or not name.strip() or element.get("type") not in {"node", "way", "relation"}:
        return None
    website = tags.get("website") or tags.get("contact:website")
    source_url = f'https://www.openstreetmap.org/{element["type"]}/{element["id"]}'
    address = " ".join(tags.get(k, "") for k in ("addr:housenumber", "addr:street", "addr:postcode"))
    city = tags.get("addr:city") or "New York area (unverified)"
    original = {"id": f'osm:{element["type"]}:{element["id"]}', "name": name, "address": address, "city": city, "website": website, "email": tags.get("contact:email") or tags.get("email"), "phone": tags.get("contact:phone") or tags.get("phone"), "instagram_handle": tags.get("contact:instagram"), "business_type": tags.get("shop") or tags.get("amenity") or tags.get("tourism") or tags.get("office"), "osm_tags": tags, "source_url": source_url, "source_attribution": ATTRIBUTION, "source_license": LICENSE}
    return {"id": original["id"], "name": name, "city": city, "website": website, "neighborhood": tags.get("addr:suburb"), "do_not_contact": False, "original_record": original, "contacts": [], "job": {"status": "not_started"}, "fit": {"score": None, "segment": segment, "uncertainties": ["Open place data may be incomplete or stale; thesis fit needs site evidence."]}, "discovery": {"source_url": source_url, "attribution": ATTRIBUTION, "license": LICENSE, "observed_at": datetime.now(timezone.utc).isoformat()}}


def unique_website(name, elements):
    matches = [record(e) for e in elements if str(e.get("tags", {}).get("name", "")).strip().casefold() == name.strip().casefold()]
    matches = [r for r in matches if r and r.get("website")]
    # A unique named map result is a candidate, never an automatic entity merge.
    return matches[0] if len(matches) == 1 else None
