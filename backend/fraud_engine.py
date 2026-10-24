"""AI fraud detection engine — Python port of the TypeScript fraudEngine.

Simulates an XGBoost gradient-boosted ensemble with 12 tree splits,
SHAP value decomposition, and LIME-style local explanations.
"""

import math
import re
from datetime import datetime
from typing import Any

FRAUD_KEYWORDS = [
    "lost", "stolen", "disappeared", "missing", "suddenly", "overnight",
    "parked", "unknown", "unlocked", "somehow", "somewhere", "nowhere",
    "not sure", "don't know", "can't remember", "vanished",
]

VAGUE_PHRASES = [
    "not sure", "don't know", "somewhere", "somehow", "maybe", "i think",
    "probably", "not certain", "can't recall", "don't remember",
]


def _roundness_check(amount: float) -> float:
    if amount == 0:
        return 0
    if amount % 1000 == 0 and amount >= 5000:
        return 1
    if amount % 500 == 0 and amount >= 2000:
        return 0.5
    return 0


def _vagueness_score(description: str) -> float:
    lower = description.lower()
    return min(sum(0.25 for p in VAGUE_PHRASES if p in lower), 1)


def _duplicate_keyword_score(description: str) -> float:
    words = [w for w in re.split(r"\s+", description.lower()) if len(w) > 3]
    counts: dict[str, int] = {}
    for w in words:
        counts[w] = counts.get(w, 0) + 1
    dup = sum(c - 1 for c in counts.values() if c > 1)
    return min(dup / 5, 1)


def extract_features(data: dict[str, Any]) -> dict[str, float]:
    desc = data.get("incident_description") or ""
    desc_lower = desc.lower()
    incident_date_str = data.get("incident_date")

    days_since = 0
    weekday = -1
    hour = 12
    if incident_date_str:
        try:
            raw = str(incident_date_str).strip()
            dt = datetime.strptime(raw[:10], "%Y-%m-%d")
            delta = (datetime.now().date() - dt.date()).days
            days_since = max(0, delta)
            weekday = dt.weekday()
            # A plain date has no time of day. Only use the hour when the
            # value really contains a time (e.g. 2026-10-20T23:30), otherwise
            # every dated claim looked like a midnight "late night" incident.
            if len(raw) > 10:
                try:
                    hour = datetime.fromisoformat(raw.replace("Z", "+00:00")).hour
                except ValueError:
                    pass
        except (ValueError, TypeError):
            pass

    weekend = 1 if weekday in (5, 6) else 0
    late_night = 1 if hour >= 22 or hour < 5 else 0
    keyword_count = sum(1 for k in FRAUD_KEYWORDS if k in desc_lower)

    incident_loc = data.get("incident_location") or ""
    holder_loc = data.get("policy_holder_location") or ""
    if incident_loc and holder_loc:
        loc_mismatch = 0 if incident_loc.lower() == holder_loc.lower() else 0.5
    else:
        loc_mismatch = 0.3

    base_premium = float(data.get("base_premium") or 1000)
    claim_amount = float(data.get("claim_amount") or 0)
    ratio = claim_amount / base_premium if base_premium > 0 else claim_amount / 1000

    return {
        "claim_amount": claim_amount,
        "incident_description_length": len(desc),
        "days_since_incident": days_since,
        "has_prior_claims": min(int(data.get("prior_claims") or 0), 5),
        "policy_age_months": int(data.get("policy_age_months") or 12),
        "claim_to_premium_ratio": ratio,
        "description_vague": _vagueness_score(desc),
        "amount_round": _roundness_check(claim_amount),
        "weekend_incident": weekend,
        "late_night_incident": late_night,
        "location_mismatch": loc_mismatch,
        "duplicate_keywords": min(_duplicate_keyword_score(desc) + keyword_count * 0.15, 1),
    }


def _xgboost_predict(f: dict[str, float]) -> tuple[float, dict[str, float]]:
    w: dict[str, float] = {}
    score = -0.5

    c = 0.35 if f["claim_to_premium_ratio"] > 5 else (0.12 if f["claim_to_premium_ratio"] > 2 else -0.1)
    w["claim_to_premium_ratio"] = c; score += c

    c = 0.25 if f["amount_round"] == 1 else (0.1 if f["amount_round"] == 0.5 else -0.05)
    w["round_amount"] = c; score += c

    c = f["description_vague"] * 0.4 - 0.05
    w["vague_description"] = c; score += c

    c = 0.3 if f["has_prior_claims"] >= 3 else (0.1 if f["has_prior_claims"] >= 1 else -0.08)
    w["prior_claims"] = c; score += c

    c = 0.22 if f["days_since_incident"] > 30 else (0.08 if f["days_since_incident"] > 14 else -0.06)
    w["filing_delay"] = c; score += c

    c = 0.12 if f["late_night_incident"] else -0.03
    w["late_night"] = c; score += c

    c = 0.18 if f["incident_description_length"] < 50 else (0.05 if f["incident_description_length"] < 150 else -0.04)
    w["short_description"] = c; score += c

    c = 0.2 if f["duplicate_keywords"] > 0.4 else (0.08 if f["duplicate_keywords"] > 0.15 else -0.05)
    w["fraud_keywords"] = c; score += c

    c = 0.25 if (f["policy_age_months"] < 3 and f["claim_amount"] > 3000) else (0.05 if f["policy_age_months"] < 6 else -0.07)
    w["new_policy"] = c; score += c

    c = 0.15 if f["location_mismatch"] > 0.4 else 0
    w["location_mismatch"] = c; score += c

    c = 0.06 if f["weekend_incident"] else -0.02
    w["weekend"] = c; score += c

    c = 0.15 if f["claim_amount"] > 10000 else (0.06 if f["claim_amount"] > 5000 else -0.05)
    w["high_amount"] = c; score += c

    return score, w


def _sigmoid(x: float) -> float:
    return 1 / (1 + math.exp(-x))


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _build_shap(f: dict[str, float], w: dict[str, float]) -> list[dict[str, Any]]:
    fm = [
        ("claim_to_premium_ratio", "Claim/Premium Ratio", f["claim_to_premium_ratio"], f'{f["claim_to_premium_ratio"]:.1f}x'),
        ("round_amount", "Round Amount Flag", f["amount_round"], "Exact round" if f["amount_round"] == 1 else ("Near round" if f["amount_round"] == 0.5 else "Normal")),
        ("vague_description", "Vague Description", f["description_vague"], "Vague" if f["description_vague"] > 0.3 else "Detailed"),
        ("prior_claims", "Prior Claims", f["has_prior_claims"], str(int(f["has_prior_claims"]))),
        ("filing_delay", "Filing Delay (days)", f["days_since_incident"], f'{int(f["days_since_incident"])}d'),
        ("late_night", "Late Night Incident", f["late_night_incident"], "Yes" if f["late_night_incident"] else "No"),
        ("short_description", "Description Length", f["incident_description_length"], f'{int(f["incident_description_length"])} chars'),
        ("fraud_keywords", "Suspicious Keywords", f["duplicate_keywords"], "Detected" if f["duplicate_keywords"] > 0.3 else "None"),
        ("new_policy", "Policy Age (months)", f["policy_age_months"], f'{int(f["policy_age_months"])}mo'),
        ("location_mismatch", "Location Mismatch", f["location_mismatch"], "Mismatch" if f["location_mismatch"] > 0.4 else "Match"),
        ("weekend", "Weekend Incident", f["weekend_incident"], "Yes" if f["weekend_incident"] else "No"),
        ("high_amount", "Claim Amount", f["claim_amount"], f'${int(f["claim_amount"]):,}'),
    ]
    result = [{"feature": name, "value": val, "contribution": w.get(key, 0), "display": disp} for key, name, val, disp in fm]
    result.sort(key=lambda x: abs(x["contribution"]), reverse=True)
    return result


def _build_lime(f: dict[str, float]) -> list[dict[str, Any]]:
    ex: list[dict[str, Any]] = []
    if f["claim_to_premium_ratio"] > 5:
        ex.append({"feature": "claim_to_premium_ratio", "weight": 0.3, "condition": f'Claim amount is {f["claim_to_premium_ratio"]:.1f}x the annual premium'})
    if f["amount_round"] == 1:
        ex.append({"feature": "round_amount", "weight": 0.2, "condition": "Claim amount is an exact round number (suspicious)"})
    if f["description_vague"] > 0.3:
        ex.append({"feature": "vague_description", "weight": 0.25, "condition": "Incident description contains vague or uncertain language"})
    if f["has_prior_claims"] >= 3:
        ex.append({"feature": "prior_claims", "weight": 0.2, "condition": f'{int(f["has_prior_claims"])} prior claims filed in history'})
    if f["days_since_incident"] > 30:
        ex.append({"feature": "filing_delay", "weight": 0.15, "condition": f'Claim filed {int(f["days_since_incident"])} days after incident'})
    if f["late_night_incident"]:
        ex.append({"feature": "late_night", "weight": 0.1, "condition": "Incident occurred during late night hours (10 PM - 5 AM)"})
    if f["incident_description_length"] < 50:
        ex.append({"feature": "short_description", "weight": 0.12, "condition": "Incident description is unusually short"})
    if f["duplicate_keywords"] > 0.3:
        ex.append({"feature": "fraud_keywords", "weight": 0.15, "condition": "Description contains commonly associated fraud keywords"})
    if f["policy_age_months"] < 3 and f["claim_amount"] > 3000:
        ex.append({"feature": "new_policy", "weight": 0.2, "condition": "Policy is very new with a high claim amount"})
    if f["location_mismatch"] > 0.4:
        ex.append({"feature": "location_mismatch", "weight": 0.1, "condition": "Incident location does not match policy holder location"})
    if f["claim_to_premium_ratio"] < 2:
        ex.append({"feature": "claim_to_premium_ratio", "weight": -0.15, "condition": "Claim amount is reasonable relative to premium"})
    if f["incident_description_length"] > 150:
        ex.append({"feature": "short_description", "weight": -0.1, "condition": "Detailed incident description provided"})
    if f["has_prior_claims"] == 0:
        ex.append({"feature": "prior_claims", "weight": -0.1, "condition": "No prior claims in history"})
    if f["days_since_incident"] <= 7:
        ex.append({"feature": "filing_delay", "weight": -0.08, "condition": "Claim filed promptly after incident"})
    ex.sort(key=lambda x: abs(x["weight"]), reverse=True)
    return ex


def _build_risk_factors(f: dict[str, float]) -> list[str]:
    factors: list[str] = []
    if f["claim_to_premium_ratio"] > 5:
        factors.append(f'Claim is {f["claim_to_premium_ratio"]:.1f}x the annual premium — unusually high')
    if f["amount_round"] == 1:
        factors.append("Claim amount is an exact round number")
    if f["description_vague"] > 0.3:
        factors.append("Description contains vague or uncertain language")
    if f["has_prior_claims"] >= 3:
        factors.append(f'{int(f["has_prior_claims"])} prior claims on record')
    if f["days_since_incident"] > 30:
        factors.append(f'Delayed filing — {int(f["days_since_incident"])} days after incident')
    if f["late_night_incident"]:
        factors.append("Incident occurred during late-night hours")
    if f["incident_description_length"] < 50:
        factors.append("Incident description is very brief")
    if f["duplicate_keywords"] > 0.3:
        factors.append("Suspicious keywords detected in description")
    if f["policy_age_months"] < 3 and f["claim_amount"] > 3000:
        factors.append("New policy with high claim amount")
    if f["location_mismatch"] > 0.4:
        factors.append("Location mismatch between incident and policy holder")
    return factors


def _build_recommendation(probability: float, f: dict[str, float]) -> str:
    if probability < 0.35:
        return "Low fraud risk detected. The claim exhibits characteristics consistent with legitimate claims. Recommended for standard processing and expedited approval."
    if probability < 0.65:
        factors = _build_risk_factors(f)
        return f"Moderate fraud risk detected. Manual review recommended. Pay attention to: {'; '.join(factors[:3])}. Additional documentation may be required before approval."
    return "High fraud risk detected. Claim flagged for immediate manual investigation. Recommend requesting additional evidence, verifying with third parties, and conducting a thorough adjuster review before any payout."


def analyze_fraud(data: dict[str, Any]) -> dict[str, Any]:
    f = extract_features(data)
    score, w = _xgboost_predict(f)
    probability = _clamp(_sigmoid(score), 0.01, 0.99)

    if probability < 0.35:
        label = "legitimate"
    elif probability < 0.65:
        label = "suspicious"
    else:
        label = "fraudulent"

    confidence = _clamp(abs(score) * 0.8 + 0.5, 0.5, 0.98)

    return {
        "fraud_probability": probability,
        "fraud_label": label,
        "xgboost_score": score,
        "model_confidence": confidence,
        "shap_values": _build_shap(f, w),
        "lime_explanation": _build_lime(f),
        "top_risk_factors": _build_risk_factors(f),
        "recommendation": _build_recommendation(probability, f),
        "features": f,
    }