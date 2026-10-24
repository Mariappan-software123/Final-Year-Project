"""Flask backend for the Insurance Fraud Detection platform.

Provides a REST API that mirrors the Supabase tables and runs the
fraud analysis engine server-side.  Uses the Supabase REST API
(same anon key as the frontend) for database access.

Run from command line:
    python app.py
"""

import io
import csv
import json
import time
import os
from datetime import datetime
from typing import Any

from flask import Flask, request, jsonify
from flask_cors import CORS

from fraud_engine import analyze_fraud
from currencies import CURRENCIES, convert_to_base, get_currency
import supabase_client as sb

app = Flask(__name__)
CORS(app)


# ---------------------------------------------------------------------------
# Root route (fixes the 404 on http://127.0.0.1:5000/)
# ---------------------------------------------------------------------------

@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "status": "ok",
        "message": "Insurance Fraud Detection API is running",
        "health": "/api/health",
        "supabase_configured": sb.is_configured(),
        "endpoints": [
            "GET /api/insurance-types",
            "GET /api/claims",
            "GET /api/claims/<claim_id>",
            "POST /api/claims",
            "POST /api/analyze",
            "POST /api/upload",
            "GET /api/datasets",
            "GET /api/currencies",
        ],
    })


@app.route("/favicon.ico")
def favicon():
    return "", 204


# ---------------------------------------------------------------------------
# Guards and error handlers
# ---------------------------------------------------------------------------

# Endpoints that read/write the Supabase database
DB_ENDPOINTS = {
    "list_insurance_types", "list_claims", "get_claim",
    "create_claim", "upload", "list_datasets",
}


@app.before_request
def require_database():
    """Return a clear 503 instead of a crash when Supabase isn't configured."""
    if request.endpoint in DB_ENDPOINTS and not sb.is_configured():
        return jsonify({
            "error": "Database not configured. Set SUPABASE_URL and "
                     "SUPABASE_ANON_KEY, then restart the server."
        }), 503


@app.errorhandler(404)
def not_found(_e):
    return jsonify({"error": "Not found"}), 404


@app.errorhandler(ValueError)
def bad_value(e):
    # Bad numbers, bad encoding, bad JSON values -> 400 instead of a 500 crash
    return jsonify({"error": f"Invalid input: {e}"}), 400


@app.errorhandler(Exception)
def server_error(e):
    from werkzeug.exceptions import HTTPException
    if isinstance(e, HTTPException):
        return jsonify({"error": e.description}), e.code
    app.logger.exception("Unhandled error")
    return jsonify({"error": "Internal server error", "detail": str(e)}), 500


# ---------------------------------------------------------------------------
# Insurance Types
# ---------------------------------------------------------------------------

@app.route("/api/insurance-types", methods=["GET"])
def list_insurance_types():
    rows = sb.select("insurance_types", order="base_premium.asc")
    return jsonify(rows)


# ---------------------------------------------------------------------------
# Claims
# ---------------------------------------------------------------------------

@app.route("/api/claims", methods=["GET"])
def list_claims():
    claims = sb.select("claims", order="created_at.desc")
    if not claims:
        return jsonify([])

    claim_ids = ",".join(c["id"] for c in claims)
    analyses = sb.select_filtered("fraud_analyses", f"claim_id=in.({claim_ids})")

    type_ids = ",".join(c["insurance_type_id"] for c in claims if c.get("insurance_type_id"))
    types_map: dict[str, dict] = {}
    if type_ids:
        types = sb.select_filtered("insurance_types", f"id=in.({type_ids})")
        types_map = {t["id"]: t for t in types}

    analyses_by_claim: dict[str, list] = {}
    for a in analyses:
        analyses_by_claim.setdefault(a["claim_id"], []).append(a)

    for c in claims:
        c["fraud_analyses"] = analyses_by_claim.get(c["id"], [])
        c["insurance_types"] = types_map.get(c.get("insurance_type_id"))

    return jsonify(claims)


@app.route("/api/claims/<claim_id>", methods=["GET"])
def get_claim(claim_id: str):
    claims = sb.select_filtered("claims", f"id=eq.{claim_id}")
    if not claims:
        return jsonify({"error": "Claim not found"}), 404
    claim = claims[0]
    analyses = sb.select_filtered("fraud_analyses", f"claim_id=eq.{claim_id}")
    claim["fraud_analyses"] = analyses
    return jsonify(claim)


# ---------------------------------------------------------------------------
# File a claim + run fraud analysis
# ---------------------------------------------------------------------------

@app.route("/api/claims", methods=["POST"])
def create_claim():
    body: dict[str, Any] = request.get_json(force=True)

    required = ["insurance_type_id", "claimant_name", "claimant_email", "claim_amount"]
    for field in required:
        val = body.get(field)
        if val is None or val == "":
            return jsonify({"error": f"Missing required field: {field}"}), 400

    currency_code = body.get("currency", "USD")
    currency = get_currency(currency_code)
    claim_amount_base = convert_to_base(float(body["claim_amount"]), currency)

    types = sb.select_filtered("insurance_types", f"id=eq.{body['insurance_type_id']}")
    base_premium = float(types[0]["base_premium"]) if types else 1000

    fraud_result = analyze_fraud({
        "claim_amount": claim_amount_base,
        "incident_description": body.get("incident_description", ""),
        "incident_date": body.get("incident_date"),
        "prior_claims": int(body.get("prior_claims", 0)),
        "policy_age_months": int(body.get("policy_age_months", 12)),
        "base_premium": base_premium,
        "incident_location": body.get("incident_location", ""),
        "policy_holder_location": body.get("policy_holder_location", body.get("incident_location", "")),
    })

    claim_number = f"CLM-{str(int(time.time()))[-8:]}"
    status = (
        "flagged" if fraud_result["fraud_label"] == "fraudulent"
        else "reviewing" if fraud_result["fraud_label"] == "suspicious"
        else "pending"
    )

    uploaded_data = {
        "priorClaims": body.get("prior_claims", 0),
        "policyAgeMonths": body.get("policy_age_months", 12),
        "policyHolderLocation": body.get("policy_holder_location", ""),
    }

    claim = sb.insert("claims", {
        "claim_number": claim_number,
        "insurance_type_id": body["insurance_type_id"],
        "claimant_name": body["claimant_name"],
        "claimant_email": body["claimant_email"],
        "incident_date": body.get("incident_date") or None,
        "incident_location": body.get("incident_location") or None,
        "incident_description": body.get("incident_description") or None,
        "claim_amount": claim_amount_base,
        "policy_number": body.get("policy_number") or None,
        "status": status,
        "uploaded_data": json.dumps(uploaded_data),
    })

    analysis = sb.insert("fraud_analyses", {
        "claim_id": claim["id"],
        "fraud_probability": fraud_result["fraud_probability"],
        "fraud_label": fraud_result["fraud_label"],
        "xgboost_score": fraud_result["xgboost_score"],
        "model_confidence": fraud_result["model_confidence"],
        "shap_values": json.dumps(fraud_result["shap_values"]),
        "lime_explanation": json.dumps(fraud_result["lime_explanation"]),
        "top_risk_factors": json.dumps(fraud_result["top_risk_factors"]),
        "recommendation": fraud_result["recommendation"],
    })

    return jsonify({"claim": claim, "fraud_analysis": analysis}), 201


# ---------------------------------------------------------------------------
# Analyze without saving (demo explorer)
# ---------------------------------------------------------------------------

@app.route("/api/analyze", methods=["POST"])
def analyze():
    body: dict[str, Any] = request.get_json(force=True)
    currency_code = body.get("currency", "USD")
    currency = get_currency(currency_code)
    claim_amount = convert_to_base(float(body.get("claim_amount", 0)), currency)

    result = analyze_fraud({
        "claim_amount": claim_amount,
        "incident_description": body.get("incident_description", ""),
        "incident_date": body.get("incident_date"),
        "prior_claims": int(body.get("prior_claims", 0)),
        "policy_age_months": int(body.get("policy_age_months", 12)),
        "base_premium": float(body.get("base_premium", 1000)),
        "incident_location": body.get("incident_location", ""),
        "policy_holder_location": body.get("policy_holder_location", body.get("incident_location", "")),
    })
    return jsonify(result)


# ---------------------------------------------------------------------------
# Batch upload (CSV / JSON)
# ---------------------------------------------------------------------------

@app.route("/api/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    filename = file.filename or "unknown"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext not in ("csv", "json"):
        return jsonify({"error": "Only CSV and JSON files are supported"}), 400

    raw = file.read().decode("utf-8-sig")  # utf-8-sig strips the BOM Excel adds
    try:
        records = _parse_csv(raw) if ext == "csv" else _parse_json(raw)
    except Exception as exc:
        return jsonify({"error": f"Parse error: {exc}"}), 400

    if not records:
        return jsonify({"error": "No valid records found"}), 400

    results = []
    for i, r in enumerate(records):
        fr = analyze_fraud(r)
        results.append({
            "name": r.get("claimant_name") or f"Record {i + 1}",
            "amount": r.get("claim_amount", 0),
            "label": fr["fraud_label"],
            "probability": fr["fraud_probability"],
            "risk_factors": fr["top_risk_factors"],
        })

    legitimate = sum(1 for r in results if r["label"] == "legitimate")
    suspicious = sum(1 for r in results if r["label"] == "suspicious")
    fraudulent = sum(1 for r in results if r["label"] == "fraudulent")
    avg_prob = sum(r["probability"] for r in results) / len(results) if results else 0
    results.sort(key=lambda x: x["probability"], reverse=True)

    dataset = sb.insert("dataset_records", {
        "filename": filename,
        "record_count": len(results),
        "status": "completed",
        "summary": json.dumps({
            "legitimate": legitimate,
            "suspicious": suspicious,
            "fraudulent": fraudulent,
            "avg_probability": avg_prob,
        }),
    })

    return jsonify({
        "total": len(results),
        "legitimate": legitimate,
        "suspicious": suspicious,
        "fraudulent": fraudulent,
        "avg_probability": avg_prob,
        "results": results[:50],
        "dataset": dataset,
    }), 201


def _parse_csv(text: str) -> list[dict[str, Any]]:
    reader = csv.DictReader(io.StringIO(text))
    records = []
    for row in reader:
        lower = {(k or "").strip().lower(): v for k, v in row.items() if k}
        records.append({
            "claim_amount": float(lower.get("claim_amount") or lower.get("amount") or 0),
            "incident_description": lower.get("incident_description") or lower.get("description") or "",
            "incident_date": lower.get("incident_date") or lower.get("date") or None,
            "prior_claims": int(float(lower.get("prior_claims") or 0)),
            "policy_age_months": int(float(lower.get("policy_age_months") or lower.get("policy_age") or 12)),
            "base_premium": float(lower.get("base_premium") or lower.get("premium") or 1000),
            "incident_location": lower.get("incident_location") or lower.get("location") or "",
            "policy_holder_location": lower.get("policy_holder_location") or lower.get("holder_location") or lower.get("incident_location") or "",
            "claimant_name": lower.get("claimant_name") or lower.get("name") or "",
            "claimant_email": lower.get("claimant_email") or lower.get("email") or "",
            "insurance_type_name": lower.get("insurance_type") or lower.get("type") or "",
            "policy_number": lower.get("policy_number") or "",
        })
    return records


def _parse_json(text: str) -> list[dict[str, Any]]:
    data = json.loads(text)
    if not isinstance(data, list):
        raise ValueError("JSON must be an array of claim records")
    records = []
    for r in data:
        if not isinstance(r, dict):
            raise ValueError("Each JSON record must be an object")
        records.append({
            "claim_amount": float(r.get("claimAmount", r.get("claim_amount", r.get("amount", 0))) or 0),
            "incident_description": str(r.get("incidentDescription", r.get("incident_description", r.get("description", "")))),
            "incident_date": r.get("incidentDate", r.get("incident_date")),
            "prior_claims": int(r.get("priorClaims", r.get("prior_claims", 0)) or 0),
            "policy_age_months": int(r.get("policyAgeMonths", r.get("policy_age_months", 12)) or 12),
            "base_premium": float(r.get("basePremium", r.get("base_premium", 1000)) or 1000),
            "incident_location": str(r.get("incidentLocation", r.get("incident_location", ""))),
            "policy_holder_location": str(r.get("policyHolderLocation", r.get("policy_holder_location", r.get("incidentLocation", "")))),
            "claimant_name": str(r.get("claimantName", "")),
            "claimant_email": str(r.get("claimantEmail", "")),
            "insurance_type_name": str(r.get("insuranceTypeName", "")),
            "policy_number": str(r.get("policyNumber", "")),
        })
    return records


# ---------------------------------------------------------------------------
# Dataset records
# ---------------------------------------------------------------------------

@app.route("/api/datasets", methods=["GET"])
def list_datasets():
    rows = sb.select("dataset_records", order="created_at.desc")
    return jsonify(rows)


# ---------------------------------------------------------------------------
# Currencies
# ---------------------------------------------------------------------------

@app.route("/api/currencies", methods=["GET"])
def currencies():
    return jsonify(CURRENCIES)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "time": datetime.now().isoformat(),
        "supabase_configured": sb.is_configured(),
    })


# ---------------------------------------------------------------------------
# Run from command line
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("FLASK_PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"

    print()
    print("=" * 60)
    print("  Insurance Fraud Detection API")
    print("=" * 60)
    print(f"  Server:     http://localhost:{port}")
    print(f"  Health:     http://localhost:{port}/api/health")
    print(f"  Supabase:   {'configured' if sb.is_configured() else 'NOT configured — set SUPABASE_URL and SUPABASE_ANON_KEY'}")
    print()
    print("  Endpoints:")
    print(f"    GET  /                    (API info)")
    print(f"    GET  /api/insurance-types")
    print(f"    GET  /api/claims")
    print(f"    GET  /api/claims/<id>")
    print(f"    POST /api/claims          (file claim + run analysis)")
    print(f"    POST /api/analyze         (run analysis only)")
    print(f"    POST /api/upload          (batch CSV/JSON upload)")
    print(f"    GET  /api/datasets")
    print(f"    GET  /api/currencies")
    print("=" * 60)
    print()

    app.run(host="0.0.0.0", port=port, debug=debug)