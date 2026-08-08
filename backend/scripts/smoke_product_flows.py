"""
Live smoke test against running API (localhost:8000).
Writes NDJSON to repo-root debug-74d1c8.log
"""
from __future__ import annotations

import json
import time
import uuid
from pathlib import Path

import httpx

BASE = "http://127.0.0.1:8000"
LOG = Path(__file__).resolve().parents[1] / "debug-74d1c8.log"


def log(hypothesis_id: str, location: str, message: str, data: dict):
    line = {
        "sessionId": "74d1c8",
        "hypothesisId": hypothesis_id,
        "location": location,
        "message": message,
        "data": data,
        "timestamp": int(time.time() * 1000),
        "runId": "smoke1",
    }
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(line) + "\n")
    print(f"[{hypothesis_id}] {message}: {data}")


def main():
    client = httpx.Client(timeout=30.0)
    suffix = uuid.uuid4().hex[:8]

    # Health
    try:
        r = client.get(f"{BASE}/health")
        log("E", "smoke:health", "health response", {"status": r.status_code, "body": r.text[:200]})
    except Exception as e:
        log("E", "smoke:health", "health failed — is backend running?", {"error": str(e)})
        return

    # Register supermarket (reward industry)
    payload_sm = {
        "business_name": f"SmokeMart {suffix}",
        "industry": "Supermarket",
        "email": f"smoke-mart-{suffix}@example.com",
        "feedback_method": "qr",
        "monthly_customers": 1000,
        "avg_revenue_per_user": 500,
        "premium_pct": 10,
        "currency": "INR",
    }
    r = client.post(f"{BASE}/business/register", json=payload_sm)
    mart = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"raw": r.text}
    log(
        "B",
        "smoke:register_supermarket",
        "register supermarket",
        {
            "status": r.status_code,
            "has_id": bool(mart.get("id")),
            "has_qr": bool(mart.get("qr_code")),
            "engagement_mode": mart.get("engagement_mode"),
            "has_owner_token": bool(mart.get("owner_token")),
            "feedback_url": mart.get("feedback_url"),
            "detail": mart.get("detail"),
        },
    )
    if r.status_code not in (200, 201):
        return

    biz_id = mart["id"]
    token = mart.get("owner_token")

    # Owner access with token
    r = client.get(f"{BASE}/business/{biz_id}", headers={"X-Owner-Token": token or ""})
    log("A", "smoke:owner_ok", "get business with token", {"status": r.status_code})

    # Owner access without token
    r2 = client.get(f"{BASE}/business/{biz_id}")
    log("A", "smoke:owner_deny", "get business without token", {"status": r2.status_code, "detail": (r2.json() if r2.headers.get("content-type","").startswith("application/json") else {}).get("detail")})

    # Feedback form config
    r = client.get(f"{BASE}/feedback/{biz_id}")
    cfg = r.json() if r.status_code == 200 else {"detail": r.text[:200]}
    log(
        "D",
        "smoke:feedback_config",
        "feedback form config",
        {
            "status": r.status_code,
            "mode": cfg.get("engagement_mode") or cfg.get("feedback_mode"),
            "reward_enabled": cfg.get("reward_enabled"),
            "detail": cfg.get("detail"),
        },
    )

    # Submit feedback
    r = client.post(
        f"{BASE}/feedback/{biz_id}",
        json={
            "text": "Checkout waiting time is too long and payment failed once.",
            "rating": 2,
            "customer_email": f"cust-{suffix}@example.com",
            "user_token": f"usr-smoke-{suffix}",
            "source": "qr",
        },
    )
    fb = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"raw": r.text}
    log(
        "C",
        "smoke:feedback_submit",
        "submit feedback",
        {
            "status": r.status_code,
            "success": fb.get("success"),
            "points_earned": fb.get("points_earned"),
            "message": (fb.get("message") or "")[:120],
            "detail": fb.get("detail"),
        },
    )

    # Register hospital (no reward by default)
    payload_h = {
        "business_name": f"Smoke Hospital {suffix}",
        "industry": "Hospital",
        "email": f"smoke-hosp-{suffix}@example.com",
        "feedback_method": "qr",
        "monthly_customers": 500,
        "avg_revenue_per_user": 200,
        "premium_pct": 5,
        "currency": "INR",
    }
    r = client.post(f"{BASE}/business/register", json=payload_h)
    hosp = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    log(
        "D",
        "smoke:register_hospital",
        "register hospital",
        {
            "status": r.status_code,
            "engagement_mode": hosp.get("engagement_mode"),
            "has_qr": bool(hosp.get("qr_code")),
            "detail": hosp.get("detail"),
        },
    )
    if r.status_code in (200, 201):
        hid = hosp["id"]
        r = client.get(f"{BASE}/feedback/{hid}")
        hcfg = r.json() if r.status_code == 200 else {}
        log(
            "D",
            "smoke:hospital_config",
            "hospital feedback config",
            {
                "status": r.status_code,
                "mode": hcfg.get("engagement_mode") or hcfg.get("feedback_mode"),
                "reward_enabled": hcfg.get("reward_enabled"),
            },
        )

    print("Smoke complete. See debug-74d1c8.log")


if __name__ == "__main__":
    main()
