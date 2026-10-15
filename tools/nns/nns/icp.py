"""Tag a space with a readable type, an ICP segment and its neighborhood.

ICP segments follow Neesh's buyer 2x2:
- Wait: people wait there (salons, spas, clinics). "We can't shorten the wait."
- Presence: people linger off their phones (cafes, wine bars, members clubs).
- Dwell: browsing turns into spend (boutiques, furniture, galleries).
- Taste: the space signals taste (boutique hotels, coworking, studios).
- Catalog: already sells print (bookstores, newsstands, museum shops, delis).

Inputs are Google place types (primary type first). The tag is a starting
point the owner confirms or overrides; it is never treated as verified.
"""
from __future__ import annotations

# primary place type -> (readable type, segment)
TYPES: dict[str, tuple[str, str]] = {
    # Wait
    "hair_salon": ("Hair salon", "Wait"),
    "beauty_salon": ("Beauty salon", "Wait"),
    "barber_shop": ("Barber", "Wait"),
    "nail_salon": ("Nail salon", "Wait"),
    "spa": ("Spa", "Wait"),
    "massage": ("Massage", "Wait"),
    "sauna": ("Sauna", "Wait"),
    "skin_care_clinic": ("Skin clinic", "Wait"),
    "wellness_center": ("Wellness center", "Wait"),
    "dentist": ("Dentist", "Wait"),
    "dental_clinic": ("Dental clinic", "Wait"),
    "doctor": ("Doctor's office", "Wait"),
    "medical_clinic": ("Medical clinic", "Wait"),
    "physiotherapist": ("Physical therapy", "Wait"),
    "chiropractor": ("Chiropractor", "Wait"),
    "veterinary_care": ("Vet", "Wait"),
    "tattoo_shop": ("Tattoo studio", "Wait"),
    # Presence
    "cafe": ("Cafe", "Presence"),
    "coffee_shop": ("Coffee shop", "Presence"),
    "tea_house": ("Tea house", "Presence"),
    "bakery": ("Bakery", "Presence"),
    "bar": ("Bar", "Presence"),
    "wine_bar": ("Wine bar", "Presence"),
    "cocktail_bar": ("Cocktail bar", "Presence"),
    "pub": ("Pub", "Presence"),
    "restaurant": ("Restaurant", "Presence"),
    "juice_shop": ("Juice bar", "Presence"),
    "night_club": ("Club", "Presence"),
    "yoga_studio": ("Yoga studio", "Presence"),
    # Dwell
    "clothing_store": ("Clothing boutique", "Dwell"),
    "shoe_store": ("Shoe store", "Dwell"),
    "jewelry_store": ("Jewelry store", "Dwell"),
    "furniture_store": ("Furniture store", "Dwell"),
    "home_goods_store": ("Home goods", "Dwell"),
    "gift_shop": ("Gift shop", "Dwell"),
    "art_gallery": ("Gallery", "Dwell"),
    "florist": ("Florist", "Dwell"),
    "department_store": ("Department store", "Dwell"),
    "cosmetics_store": ("Beauty store", "Dwell"),
    # Taste
    "hotel": ("Hotel", "Taste"),
    "lodging": ("Hotel", "Taste"),
    "inn": ("Inn", "Taste"),
    "bed_and_breakfast": ("B&B", "Taste"),
    "coworking_space": ("Coworking", "Taste"),
    "corporate_office": ("Office", "Taste"),
    "design_studio": ("Design studio", "Taste"),
    # Catalog
    "book_store": ("Bookstore", "Catalog"),
    "newsstand": ("Newsstand", "Catalog"),
    "museum": ("Museum shop", "Catalog"),
    "library": ("Library", "Catalog"),
    "record_store": ("Record store", "Catalog"),
    "music_store": ("Record store", "Catalog"),
    "convenience_store": ("Deli / convenience", "Catalog"),
    "grocery_store": ("Grocery", "Catalog"),
    "supermarket": ("Grocery", "Catalog"),
    "market": ("Market", "Catalog"),
    "liquor_store": ("Wine & liquor shop", "Catalog"),
}

# NYC ZIP code -> neighborhood, used when Google gives no neighborhood (common
# in Manhattan). Covers the neighborhoods Neesh sells into; others fall back to
# the borough. Boundaries are approximate by nature of ZIP codes.
ZIP_NEIGHBORHOOD: dict[str, str] = {
    # Manhattan
    "10001": "Chelsea", "10002": "Lower East Side", "10003": "East Village", "10004": "Financial District",
    "10005": "Financial District", "10006": "Financial District", "10007": "Tribeca", "10009": "East Village",
    "10010": "Gramercy", "10011": "Chelsea", "10012": "SoHo", "10013": "Tribeca", "10014": "West Village",
    "10016": "Murray Hill", "10017": "Midtown East", "10018": "Garment District", "10019": "Midtown West",
    "10020": "Midtown", "10021": "Upper East Side", "10022": "Midtown East", "10023": "Upper West Side",
    "10024": "Upper West Side", "10025": "Upper West Side", "10026": "Harlem", "10027": "Harlem",
    "10028": "Upper East Side", "10029": "East Harlem", "10030": "Harlem", "10031": "Hamilton Heights",
    "10032": "Washington Heights", "10033": "Washington Heights", "10034": "Inwood", "10035": "East Harlem",
    "10036": "Midtown West", "10037": "Harlem", "10038": "Financial District", "10039": "Harlem",
    "10040": "Washington Heights", "10044": "Roosevelt Island", "10065": "Upper East Side",
    "10069": "Upper West Side", "10075": "Upper East Side", "10128": "Upper East Side",
    "10280": "Battery Park City", "10282": "Battery Park City",
    # Brooklyn
    "11201": "Brooklyn Heights", "11205": "Fort Greene", "11206": "Williamsburg", "11211": "Williamsburg",
    "11249": "Williamsburg", "11222": "Greenpoint", "11215": "Park Slope", "11217": "Boerum Hill",
    "11216": "Bed-Stuy", "11221": "Bushwick", "11237": "Bushwick", "11233": "Bed-Stuy", "11238": "Prospect Heights",
    "11231": "Carroll Gardens", "11225": "Crown Heights", "11213": "Crown Heights", "11218": "Kensington",
    "11226": "Flatbush", "11232": "Sunset Park", "11220": "Sunset Park", "11209": "Bay Ridge",
    # Queens
    "11101": "Long Island City", "11109": "Long Island City", "11102": "Astoria", "11103": "Astoria",
    "11105": "Astoria", "11106": "Astoria", "11385": "Ridgewood", "11377": "Woodside",
    "11372": "Jackson Heights", "11375": "Forest Hills",
}

SEGMENTS = ("Wait", "Presence", "Dwell", "Taste", "Catalog")


def classify(primary_type: str | None, types: list[str] | None = None) -> tuple[str | None, str | None]:
    """Return (readable space type, ICP segment), or (None, None) if unknown."""
    ordered = [t for t in [primary_type, *(types or [])] if isinstance(t, str) and t]
    for t in ordered:
        if t in TYPES:
            return TYPES[t]
    for t in ordered:
        if t.endswith("_restaurant"):
            return ("Restaurant", "Presence")
        if t.endswith("_bar"):
            return ("Bar", "Presence")
        if t.endswith("_clinic") or t.endswith("_doctor"):
            return ("Clinic", "Wait")
    return (None, None)


def place_tags(candidate: dict | None) -> dict:
    """Tags to store on a space from one place-lookup candidate."""
    if not isinstance(candidate, dict):
        return {}
    space_type, segment = classify(candidate.get("primary_type"), candidate.get("types"))
    tags = {
        "neighborhood": candidate.get("neighborhood") or ZIP_NEIGHBORHOOD.get(str(candidate.get("postal_code") or "")[:5]) or None,
        "borough": candidate.get("borough") or None,
        "address": candidate.get("address") or None,
        "space_type": space_type or candidate.get("primary_type_label") or None,
        "icp": segment,
    }
    return {k: v for k, v in tags.items() if v}
