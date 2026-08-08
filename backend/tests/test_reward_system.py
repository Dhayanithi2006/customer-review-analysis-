"""
Unit and Integration Tests for Phase 3 — Lightweight Feedback Reward System
Requirements Tested:
1. First valid feedback → reward awarded & points logged to ledger
2. Second feedback during cooldown → feedback recorded, but reward skipped (cooldown_skipped)
3. Empty feedback → rejected (HTTP 400 validation error)
4. Short feedback → rejected if below configured minimum_feedback_length
5. Different businesses → independent cooldowns
6. Improvement mode → no reward (reward_status = 'ineligible', 0 points)
7. Product mode → no reward (reward_status = 'ineligible', 0 points)
"""
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone, timedelta
from services.abuse_detector import reset_rate_limit


# ── Test 1: First valid feedback in reward mode → reward awarded ─────────────
@patch("routers.feedback.get_db")
def test_first_valid_feedback_awards_reward(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    token = "usr-anon-test-1"
    reset_rate_limit(token)

    # Business query, Settings query, Cooldown check query, Balance sum query
    mock_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[{"id": "biz-reward-1", "business_name": "FreshMart", "industry": "Supermarket"}]),  # business
        MagicMock(data=[{                                                                                  # settings
            "id": "s-1",
            "business_id": "biz-reward-1",
            "feedback_mode": "reward",
            "reward_enabled": True,
            "points_per_feedback": 10,
            "cooldown_hours": 168,
            "minimum_feedback_length": 10,
        }]),
    ]

    # Mock cooldown check (no previous rewards found)
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
    # Mock balance sum calculation
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"points_awarded": 10}]
    )

    res = api_client.post(
        "/feedback/biz-reward-1",
        json={
            "text": "The grocery checkout experience was super smooth and fast today!",
            "rating": 5,
            "user_token": token,
        }
    )

    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["engagement_mode"] == "reward"
    assert data["points_earned"] == 10
    assert data["current_balance"] == 10
    assert data["reward_eligible"] is True


# ── Test 2: Second feedback during cooldown → submission succeeds, no reward ──
@patch("routers.feedback.get_db")
def test_second_feedback_during_cooldown_skips_reward(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    token = "usr-anon-test-2"
    reset_rate_limit(token)

    now = datetime.now(timezone.utc)
    recent_award_time = (now - timedelta(hours=1)).isoformat()  # Awarded 1 hour ago (cooldown is 168h)

    mock_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[{"id": "biz-reward-1", "business_name": "FreshMart", "industry": "Supermarket"}]),
        MagicMock(data=[{
            "id": "s-1",
            "business_id": "biz-reward-1",
            "feedback_mode": "reward",
            "reward_enabled": True,
            "points_per_feedback": 10,
            "cooldown_hours": 168,
            "minimum_feedback_length": 10,
        }]),
    ]

    # Cooldown query returns recent award
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[{"created_at": recent_award_time}]
    )
    # Balance remains previous 10
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"points_awarded": 10}]
    )

    res = api_client.post(
        "/feedback/biz-reward-1",
        json={
            "text": "Second submission on same day. Loved the clean aisles!",
            "rating": 5,
            "user_token": token,
        }
    )

    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["points_earned"] == 0
    assert data["reward_eligible"] is False
    assert data["next_reward_at"] is not None


# ── Test 3: Empty feedback → rejected with HTTP 400 ──────────────────────────
@patch("routers.feedback.get_db")
def test_empty_feedback_rejected(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    token = "usr-anon-test-3"
    reset_rate_limit(token)

    mock_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[{"id": "biz-1", "business_name": "FreshMart", "industry": "Supermarket"}]),
        MagicMock(data=[{"id": "s-1", "business_id": "biz-1", "minimum_feedback_length": 10}]),
    ]

    res = api_client.post(
        "/feedback/biz-1",
        json={"text": "   ", "rating": 5, "user_token": token}
    )
    assert res.status_code in (400, 422)


# ── Test 4: Short feedback → rejected if below configured min length ──────────
@patch("routers.feedback.get_db")
def test_short_feedback_rejected_based_on_settings(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    token = "usr-anon-test-4"
    reset_rate_limit(token)

    mock_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[{"id": "biz-1", "business_name": "FreshMart", "industry": "Supermarket"}]),
        MagicMock(data=[{"id": "s-1", "business_id": "biz-1", "minimum_feedback_length": 25}]),
    ]

    res = api_client.post(
        "/feedback/biz-1",
        json={"text": "Good store", "rating": 5, "user_token": token}  # 10 chars, below 25
    )
    assert res.status_code == 400
    assert "at least 25 characters" in res.json()["detail"]


# ── Test 5: Different businesses → independent cooldowns ─────────────────────
@patch("routers.feedback.get_db")
def test_different_businesses_have_independent_cooldowns(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    token = "usr-anon-test-5"
    reset_rate_limit(token)

    # Query for Business B (which user has never submitted to before)
    mock_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[{"id": "biz-super-B", "business_name": "Bakery B", "industry": "Supermarket"}]),
        MagicMock(data=[{
            "id": "s-2",
            "business_id": "biz-super-B",
            "feedback_mode": "reward",
            "reward_enabled": True,
            "points_per_feedback": 15,
            "cooldown_hours": 168,
            "minimum_feedback_length": 10,
        }]),
    ]

    # Cooldown query for Business B returns empty (no previous awards for Biz B)
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"points_awarded": 15}]
    )

    res = api_client.post(
        "/feedback/biz-super-B",
        json={
            "text": "The fresh pastries at Bakery B were incredible!",
            "rating": 5,
            "user_token": token,
        }
    )

    assert res.status_code == 200
    data = res.json()
    assert data["points_earned"] == 15
    assert data["reward_eligible"] is True


# ── Test 6: Improvement mode → no reward ─────────────────────────────────────
@patch("routers.feedback.get_db")
def test_improvement_mode_gives_no_reward(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    token = "usr-anon-test-6"
    reset_rate_limit(token)

    mock_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[{"id": "biz-hosp", "business_name": "City Hospital", "industry": "Hospital"}]),
        MagicMock(data=[{
            "id": "s-hosp",
            "business_id": "biz-hosp",
            "feedback_mode": "improvement",
            "reward_enabled": False,
            "minimum_feedback_length": 10,
        }]),
    ]
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

    res = api_client.post(
        "/feedback/biz-hosp",
        json={
            "text": "Doctor and nursing staff were very caring and professional.",
            "rating": 5,
            "user_token": token,
        }
    )

    assert res.status_code == 200
    data = res.json()
    assert data["engagement_mode"] == "improvement"
    assert data["points_earned"] == 0
    assert data["reward_eligible"] is False


# ── Test 7: Product mode → no reward ──────────────────────────────────────────
@patch("routers.feedback.get_db")
def test_product_mode_gives_no_reward(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    token = "usr-anon-test-7"
    reset_rate_limit(token)

    mock_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[{"id": "biz-saas", "business_name": "SaaS Platform", "industry": "SaaS"}]),
        MagicMock(data=[{
            "id": "s-saas",
            "business_id": "biz-saas",
            "feedback_mode": "product",
            "reward_enabled": False,
            "minimum_feedback_length": 10,
        }]),
    ]
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

    res = api_client.post(
        "/feedback/biz-saas",
        json={
            "text": "Would love an automated CSV export option for weekly reports.",
            "rating": 4,
            "feedback_tag": "Feature Request",
            "user_token": token,
        }
    )

    assert res.status_code == 200
    data = res.json()
    assert data["engagement_mode"] == "product"
    assert data["points_earned"] == 0
    assert data["reward_eligible"] is False
