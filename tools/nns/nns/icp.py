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
        "neighborhood": candidate.get("neighborhood") or None,
        "borough": candidate.get("borough") or None,
        "address": candidate.get("address") or None,
        "space_type": space_type or candidate.get("primary_type_label") or None,
        "icp": segment,
    }
    return {k: v for k, v in tags.items() if v}
