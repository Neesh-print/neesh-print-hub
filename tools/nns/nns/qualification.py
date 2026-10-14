"""Conservative, deterministic evidence signals, not a validated fit model.

Missing evidence is unknown, never a negative judgment. Categories suggest a
segment but do not establish a shelf, buyer budget, or original buyer quadrant.
"""
from __future__ import annotations

import copy
import re

RUBRIC_VERSION = "nns-fit-evidence-0.1"
SEGMENTS = {
    "Wait": r"\b(salon|spa|barber|clinic|dentist|dental)\b",
    "Presence": r"\b(cafe|café|coffee|wine bar|restaurant|members? club)\b",
    "Dwell": r"\b(boutique|furniture|design (?:shop|store)|gallery|galleries|concept store)\b",
    "Taste": r"\b(hotel|coworking|co-working|creative office|agency)\b",
    "Catalog": r"\b(bookshop|bookstore|book shop|book store|magazine shop|record store|plant shop|museum shop)\b",
}
DIMENSIONS = {
    "space_use_case": (30, r"\b(reading room|reading lounge|waiting room|waiting area|lounge|browse our (?:shelves|shop|store)|linger|communal table)\b"),
    "cultural_editorial_alignment": (25, r"\b(artist talks?|book launches?|poetry readings?|independent publishers?|curated exhibitions?|zine fairs?)\b"),
    "print_affinity": (20, r"\b(?:stock|sell|carry|selection of|collection of)\s+(?:(?:independent|indie|art|print)\s+)?(?:magazines|zines|books|publications)\b"),
    "merchandising_opportunity": (15, r"\b(reading (?:shelf|shelves|corner)|magazine rack|magazine display|book display|reading library)\b"),
    "buyer_accessibility": (10, r"\b(independently owned|independent(?:ly)?[ -]operated|owner[ -]operated|family[ -]owned)\b"),
}
MOTIONS = {"Sell the room", "Sell the margin", "Sell the taste", "Sell the catalog"}


def assess(record: dict, signals: list[dict]) -> dict:
    components = {}
    for key, (weight, pattern) in DIMENSIONS.items():
        evidence = []
        for signal in signals:
            if not signal.get("source_url") or not signal.get("content_hash"):
                continue
            text = signal.get("text") or ""
            for match in re.finditer(pattern, text, re.I):
                # A negated sentence is not positive evidence. Conservative
                # rules intentionally leave ambiguous phrasing for review.
                start = max(text.rfind(".", 0, match.start()), text.rfind("\n", 0, match.start())) + 1
                prefix = text[start:match.start()]
                if re.search(r"\b(no|not|never|without|don't|do not|no longer)\b", prefix, re.I):
                    continue
                evidence.append({"source_url": signal["source_url"], "content_hash": signal["content_hash"], "excerpt": text[max(start, match.start() - 50):match.end() + 60][:220], "signal": match.group()})
                break
        components[key] = {"weight": weight, "points": weight if evidence else 0, "state": "supported_signal" if evidence else "unknown", "evidence": evidence}
    category = " ".join(str(record.get(k) or "") for k in ("business_type", "category"))
    candidates = [name for name, pattern in SEGMENTS.items() if re.search(pattern, category, re.I)]
    segment = candidates[0] if len(candidates) == 1 else None
    supported = sum(x["points"] for x in components.values())
    result = {
        "rubric_version": RUBRIC_VERSION,
        "score": supported if any(x["evidence"] for x in components.values()) else None,
        "supported_points": supported,
        "score_interpretation": "Evidence-supported points, not a probability or calibrated ranking. Unknown dimensions are unresolved.",
        "components": components,
        "segment": segment,
        "segment_candidates": candidates,
        "segment_state": "category_hypothesis" if segment else "needs_review",
        "segment_source": {"type": "legacy_category", "value": category},
        "quadrant": None,
        "motion": None,
        "budget_type": None,
        "offer": None,
        "payment_terms": "standard_terms_no_net30",
        "status": "needs_review",
        "uncertainties": [k for k, v in components.items() if v["state"] == "unknown"] + ["original_buyer_2x2_mapping_not_supplied", "buyer_budget_unknown"],
        "manual_overrides_applied": [],
        "review_priority": "high_supported_fit" if supported >= 60 else "unassessed" if not supported else "evidence_review",
    }
    overrides = record.get("manual_overrides")
    if not isinstance(overrides, dict):
        overrides = {}
    for key in ("segment", "quadrant", "motion", "budget_type", "fit_score"):
        if key not in overrides:
            continue
        value = record.get(key) if overrides[key] is True else overrides[key]
        valid = (key == "segment" and value in SEGMENTS if isinstance(value, str) else False)
        valid |= key == "quadrant" and isinstance(value, str) and bool(value.strip())
        valid |= key == "motion" and isinstance(value, str) and value in MOTIONS
        valid |= key == "budget_type" and isinstance(value, str) and value in {"decor", "inventory"}
        valid |= key == "fit_score" and type(value) in {int, float} and 0 <= value <= 100
        if valid:
            result["score" if key == "fit_score" else key] = copy.deepcopy(value)
            result["manual_overrides_applied"].append(key)
    if "segment" in result["manual_overrides_applied"]:
        result["segment_state"] = "manual_override"
    if result["budget_type"]:
        result["offer"] = "Neesh packs" if result["budget_type"] == "decor" else "Marketplace"
        result["uncertainties"].remove("buyer_budget_unknown")
    return result
