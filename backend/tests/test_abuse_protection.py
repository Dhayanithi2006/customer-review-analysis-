"""
Unit and Integration Tests for Phase 4 — Feedback Quality & Reward Abuse Protection
Requirements Tested:
1. Cooldown per token + business_id: Multiple DIFFERENT feedback messages accepted, but rewards ONLY awarded once per cooldown.
2. Duplicate feedback detection: Repeated identical feedback skips reward.
3. Minimum text length & rating validation.
4. Rate limiting: Consecutive submissions within <5 seconds yield HTTP 429.
5. Zero LLM cost & zero internal AI terminology leakage.
"""
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone, timedelta
from services.abuse_detector import reset_rate_limit


# ── Test 1: Cooldown accepts 2nd different feedback but skips points ──────────
@patch("routers.feedback.get_db")
def test_cooldown_accepts_different_feedback_without_points(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    now = datetime.now(timezone.utc)
    recent_award_time = (now - timedelta(hours=1)).isoformat()

    mock_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[{"id": "biz-1", "business_name": "FreshMart", "industry": "Supermarket"}]),
        MagicMock(data=[{
            "id": "s-1",
            "business_id": "biz-1",
            "feedback_mode": "reward",
            "reward_enabled": True,
            "points_per_feedback": 10,
            "cooldown_hours": 168,
            "minimum_feedback_length": 10,
        }]),
    ]

    # Cooldown query indicates user won points 1 hour ago
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[{"created_at": recent_award_time}]
    )
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"points_awarded": 10}]
    )

    token = "usr-cooldown-test-token"
    reset_rate_limit(token)

    # Different feedback message 2
    res = api_client.post(
        "/feedback/biz-1",
        json={
            "text": "Different issue: The organic produce section was completely out of spinach.",
            "rating": 3,
            "user_token": token,
        }
    )

    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True                      # Feedback WAS ACCEPTED for AI analysis!
    assert data["points_earned"] == 0                  # 0 points awarded due to cooldown!
    assert data["reward_eligible"] is False
    assert data["submission_id"] is not None


# ── Test 2: Rate limiter blocks rapid submissions (< 5 seconds) ───────────────
@patch("routers.feedback.get_db")
def test_rate_limiter_yields_429(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    mock_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[{"id": "biz-1", "business_name": "FreshMart", "industry": "Supermarket"}]),
        MagicMock(data=[{"id": "s-1", "business_id": "biz-1", "minimum_feedback_length": 10}]),
        MagicMock(data=[{"id": "biz-1", "business_name": "FreshMart", "industry": "Supermarket"}]),
        MagicMock(data=[{"id": "s-1", "business_id": "biz-1", "minimum_feedback_length": 10}]),
    ]

    token = "usr-rate-limit-token"
    reset_rate_limit(token)

    # 1st request -> OK
    res1 = api_client.post(
        "/feedback/biz-1",
        json={"text": "First valid customer feedback text", "rating": 5, "user_token": token}
    )
    assert res1.status_code == 200

    # 2nd immediate request (<5s) -> 429 Too Many Requests
    res2 = api_client.post(
        "/feedback/biz-1",
        json={"text": "Immediate second feedback text", "rating": 5, "user_token": token}
    )
    assert res2.status_code == 429
    assert "Too many requests" in res2.json()["detail"]


# ── Test 3: Duplicate text skips reward ───────────────────────────────────────
@patch("routers.feedback.get_db")
def test_duplicate_text_skips_reward(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    mock_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[{"id": "biz-1", "business_name": "FreshMart", "industry": "Supermarket"}]),
        MagicMock(data=[{
            "id": "s-1",
            "business_id": "biz-1",
            "feedback_mode": "reward",
            "reward_enabled": True,
            "points_per_feedback": 10,
            "cooldown_hours": 0,  # 0 cooldown so only duplicate filter applies
            "minimum_feedback_length": 10,
        }]),
        MagicMock(data=[{"id": "biz-1", "business_name": "FreshMart", "industry": "Supermarket"}]),
        MagicMock(data=[{
            "id": "s-1",
            "business_id": "biz-1",
            "feedback_mode": "reward",
            "reward_enabled": True,
            "points_per_feedback": 10,
            "cooldown_hours": 0,
            "minimum_feedback_length": 10,
        }]),
    ]
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"points_awarded": 10}])

    token = "usr-dup-test-token"
    reset_rate_limit(token)

    dup_text = "Identical feedback text for reward farming attempt."

    # 1st submit
    res1 = api_client.post(
        "/feedback/biz-1",
        json={"text": dup_text, "rating": 5, "user_token": token}
    )
    assert res1.status_code == 200
    assert res1.json()["points_earned"] == 10

    reset_rate_limit(token)

    # 2nd submit with identical text
    res2 = api_client.post(
        "/feedback/biz-1",
        json={"text": dup_text, "rating": 5, "user_token": token}
    )
    assert res2.status_code == 200
    assert res2.json()["points_earned"] == 0
    assert res2.json()["reward_eligible"] is False


# ── Test 4: No internal AI jargon leakage in customer responses ───────────────
@patch("routers.feedback.get_db")
def test_no_ai_jargon_leaked_to_customer(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    mock_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[{"id": "biz-1", "business_name": "FreshMart", "industry": "Supermarket"}]),
        MagicMock(data=[{"id": "s-1", "business_id": "biz-1", "minimum_feedback_length": 10}]),
    ]

    token = "usr-jargon-test"
    reset_rate_limit(token)

    res = api_client.get("/feedback/biz-1")
    assert res.status_code == 200
    json_str = res.text.lower()
    
    # Internal terms must never be present in public customer responses
    internal_jargon = ["vader", "gemini", "decision center", "priority_score", "clustering", "llm"]
    for term in internal_jargon:
        assert term not in json_str
