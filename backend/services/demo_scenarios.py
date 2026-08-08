"""
RoadmapAI — Closed-Loop Demo Scenarios Generator
Creates deterministic demo scenarios for FreshMart workspace.

Scenario 1: FreshMart - Checkout Waiting Time (IMPROVED: 87.5%)
Scenario 2: FreshMart - Payment Failure (REOPENED: 30.0%)
"""
import uuid
from datetime import datetime, timezone
from database import get_db
from core.logging import get_logger

logger = get_logger("services.demo_scenarios")


def seed_freshmart_demo(business_id: str):
    """
    Seeds/upserts deterministic demo resolution impact data for FreshMart.
    Demonstrates both successful resolution (IMPROVED) and insufficient resolution (REOPENED).
    """
    db = get_db()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Scenario 1: Checkout Waiting Time (IMPROVED)
    # 26 improved + (0.5 * 4 = 2) = 28 / 32 = 87.5%
    s1_key = "CHECKOUT_WAITING_TIME"
    s1_data = {
        "business_id": business_id,
        "issue_key": s1_key,
        "status": "IMPROVED",
        "you_said": "Checkout waiting time was terrible during peak hours.",
        "we_did": "Opened 2 additional checkout counters.",
        "action_taken": "Opened 2 additional checkout counters.",
        "action_taken_at": now_iso,
        "follow_up_sent_at": now_iso,
        "contacted_count": 32,
        "response_count": 32,
        "improved_count": 26,
        "somewhat_improved_count": 4,
        "not_improved_count": 2,
        "improvement_percentage": 87.5,
        "resolved_at": now_iso,
        "updated_at": now_iso,
    }

    # Scenario 2: Payment Failure (REOPENED)
    # 4 improved + (0.5 * 4 = 2) = 6 / 20 = 30.0%
    s2_key = "PAYMENT_FAILURE"
    s2_data = {
        "business_id": business_id,
        "issue_key": s2_key,
        "status": "REOPENED",
        "you_said": "Payment failure occurs intermittently during checkout.",
        "we_did": "Updated payment gateway retry handling.",
        "action_taken": "Updated payment gateway retry handling.",
        "action_taken_at": now_iso,
        "follow_up_sent_at": now_iso,
        "contacted_count": 20,
        "response_count": 20,
        "improved_count": 4,
        "somewhat_improved_count": 4,
        "not_improved_count": 12,
        "improvement_percentage": 30.0,
        "resolved_at": None,
        "updated_at": now_iso,
    }

    for key, data in [(s1_key, s1_data), (s2_key, s2_data)]:
        existing = (
            db.table("issue_resolutions")
            .select("id")
            .eq("business_id", business_id)
            .eq("issue_key", key)
            .execute()
            .data
        )
        if existing:
            db.table("issue_resolutions").update(data).eq("id", existing[0]["id"]).execute()
        else:
            data["id"] = str(uuid.uuid4())
            db.table("issue_resolutions").insert(data).execute()

    logger.info(f"Seeded FreshMart closed-loop demo scenarios for business={business_id}")
    return True
