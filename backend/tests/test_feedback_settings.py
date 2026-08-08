"""
Unit and Integration Tests for Feedback Engagement Settings Endpoint (Phase 1)
- GET /business/{business_id}/feedback-settings (Default behavior & Industry classification)
- PATCH /business/{business_id}/feedback-settings (Validation, Partial updates, Business Overrides)
"""
import pytest
from unittest.mock import patch, MagicMock


# ── Test 1: GET settings auto-creates defaults based on industry ─────────────
@patch("routers.feedback_settings.get_db")
def test_get_feedback_settings_defaults_supermarket(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    # Business query returns Supermarket
    mock_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[{"id": "biz-123", "industry": "Supermarket"}]),  # business lookup
        MagicMock(data=[]),  # existing settings (none yet)
    ]
    # Insert call returns created row
    mock_db.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[{
            "id": "setting-1",
            "business_id": "biz-123",
            "feedback_mode": "reward",
            "reward_enabled": True,
            "points_per_feedback": 10,
            "cooldown_hours": 168,
            "minimum_feedback_length": 10,
            "reward_threshold": 100,
            "reward_description": "Loyalty points redeemable at your next visit",
            "feedback_message": "Share your experience and earn loyalty points!",
            "created_at": "2026-02-08T10:00:00Z",
            "updated_at": "2026-02-08T10:00:00Z",
        }]
    )

    res = api_client.get("/business/biz-123/feedback-settings")
    assert res.status_code == 200
    data = res.json()
    assert data["business_id"] == "biz-123"
    assert data["feedback_mode"] == "reward"
    assert data["reward_enabled"] is True
    assert data["points_per_feedback"] == 10
    assert data["cooldown_hours"] == 168
    assert data["minimum_feedback_length"] == 10


@patch("routers.feedback_settings.get_db")
def test_get_feedback_settings_defaults_hospital(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    mock_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[{"id": "biz-hosp", "industry": "Hospital"}]),
        MagicMock(data=[]),
    ]
    mock_db.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[{
            "id": "setting-2",
            "business_id": "biz-hosp",
            "feedback_mode": "improvement",
            "reward_enabled": False,
            "points_per_feedback": 0,
            "cooldown_hours": 0,
            "minimum_feedback_length": 20,
            "reward_threshold": 0,
            "reward_description": "",
            "feedback_message": "Your feedback is confidential and helps us serve you better.",
            "created_at": "2026-02-08T10:00:00Z",
            "updated_at": "2026-02-08T10:00:00Z",
        }]
    )

    res = api_client.get("/business/biz-hosp/feedback-settings")
    assert res.status_code == 200
    data = res.json()
    assert data["feedback_mode"] == "improvement"
    assert data["reward_enabled"] is False


@patch("routers.feedback_settings.get_db")
def test_get_feedback_settings_defaults_saas(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    mock_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[{"id": "biz-saas", "industry": "SaaS"}]),
        MagicMock(data=[]),
    ]
    mock_db.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[{
            "id": "setting-3",
            "business_id": "biz-saas",
            "feedback_mode": "product",
            "reward_enabled": False,
            "points_per_feedback": 0,
            "cooldown_hours": 24,
            "minimum_feedback_length": 15,
            "reward_threshold": 0,
            "reward_description": "",
            "feedback_message": "Your feedback directly shapes our product roadmap.",
            "created_at": "2026-02-08T10:00:00Z",
            "updated_at": "2026-02-08T10:00:00Z",
        }]
    )

    res = api_client.get("/business/biz-saas/feedback-settings")
    assert res.status_code == 200
    data = res.json()
    assert data["feedback_mode"] == "product"
    assert data["reward_enabled"] is False


# ── Test 2: PATCH updates setting fields ──────────────────────────────────────
@patch("routers.feedback_settings.get_db")
def test_patch_feedback_settings_success(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    # Business check
    mock_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[{"id": "biz-123", "industry": "Supermarket"}]),
        MagicMock(data=[{"id": "setting-1", "business_id": "biz-123", "feedback_mode": "reward"}]),
    ]
    # Update call returns modified row
    mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{
            "id": "setting-1",
            "business_id": "biz-123",
            "feedback_mode": "product",
            "reward_enabled": False,
            "points_per_feedback": 10,
            "cooldown_hours": 24,
            "minimum_feedback_length": 15,
            "reward_threshold": 100,
            "reward_description": "",
            "feedback_message": "Help us build what you need next!",
            "created_at": "2026-02-08T10:00:00Z",
            "updated_at": "2026-02-08T11:00:00Z",
        }]
    )

    res = api_client.patch(
        "/business/biz-123/feedback-settings",
        json={
            "feedback_mode": "product",
            "reward_enabled": False,
            "cooldown_hours": 24,
            "minimum_feedback_length": 15,
            "feedback_message": "Help us build what you need next!",
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["feedback_mode"] == "product"
    assert data["cooldown_hours"] == 24
    assert data["minimum_feedback_length"] == 15


# ── Test 3: Validations ──────────────────────────────────────────────────────
def test_patch_feedback_settings_invalid_mode(api_client):
    res = api_client.patch(
        "/business/biz-123/feedback-settings",
        json={"feedback_mode": "invalid_mode"}
    )
    assert res.status_code == 422


def test_patch_feedback_settings_negative_points(api_client):
    res = api_client.patch(
        "/business/biz-123/feedback-settings",
        json={"points_per_feedback": -5}
    )
    assert res.status_code == 422


@patch("routers.feedback_settings.get_db")
def test_patch_feedback_settings_improvement_mode_reward_conflict(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    mock_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[{"id": "biz-hosp", "industry": "Hospital"}]),
        MagicMock(data=[{"id": "setting-hosp", "business_id": "biz-hosp", "feedback_mode": "improvement"}]),
    ]

    res = api_client.patch(
        "/business/biz-hosp/feedback-settings",
        json={"feedback_mode": "improvement", "reward_enabled": True}
    )
    assert res.status_code == 422
    assert "Improvement mode is designed for institutional settings" in res.json()["detail"]
