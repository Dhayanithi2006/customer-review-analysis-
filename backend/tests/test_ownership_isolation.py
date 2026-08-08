"""
Ownership isolation tests — Business A cannot access Business B.
"""
import os
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from core.ownership import generate_owner_token, hash_owner_token, tokens_match
from main import app

client = TestClient(app)


def test_tokens_match_roundtrip():
    token = generate_owner_token()
    stored = hash_owner_token(token)
    assert tokens_match(token, stored)
    assert not tokens_match("wrong-token", stored)


@patch("core.ownership.get_db")
@patch("routers.business.get_db")
def test_business_a_cannot_read_business_b(mock_biz_db, mock_own_db):
    """Wrong owner token → 403 even if business_id is guessed."""
    prev = os.environ.get("OWNER_AUTH_ENFORCE")
    os.environ["OWNER_AUTH_ENFORCE"] = "true"
    try:
        token_a = generate_owner_token()
        hash_a = hash_owner_token(token_a)
        token_b = generate_owner_token()

        mock_db = MagicMock()
        mock_biz_db.return_value = mock_db
        mock_own_db.return_value = mock_db

        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{
                "id": "biz-a",
                "owner_token_hash": hash_a,
                "industry": "Supermarket",
                "business_name": "FreshMart",
                "email": "a@example.com",
                "feedback_url": "http://localhost:3000/feedback/biz-a",
                "dashboard_url": "http://localhost:3000/business/biz-a",
                "qr_code": None,
                "feedback_method": "qr",
                "engagement_mode": "reward",
                "monthly_customers": 500,
                "avg_revenue_per_user": 500,
                "premium_pct": 20,
                "currency": "INR",
                "created_at": "2026-01-01T00:00:00Z",
            }]
        )

        res = client.get("/business/biz-a")
        assert res.status_code == 403

        res = client.get("/business/biz-a", headers={"X-Owner-Token": token_b})
        assert res.status_code == 403

        res = client.get("/business/biz-a", headers={"X-Owner-Token": token_a})
        assert res.status_code == 200
        assert res.json()["id"] == "biz-a"
        assert res.json().get("owner_token") in (None, "")
    finally:
        if prev is None:
            os.environ["OWNER_AUTH_ENFORCE"] = "false"
        else:
            os.environ["OWNER_AUTH_ENFORCE"] = prev


@patch("core.ownership.get_db")
@patch("routers.followup.get_db")
def test_cross_business_action_forbidden(mock_fu_db, mock_own_db):
    prev = os.environ.get("OWNER_AUTH_ENFORCE")
    os.environ["OWNER_AUTH_ENFORCE"] = "true"
    try:
        token_a = generate_owner_token()
        hash_b = hash_owner_token(generate_owner_token())

        mock_db = MagicMock()
        mock_fu_db.return_value = mock_db
        mock_own_db.return_value = mock_db
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{
                "id": "biz-b",
                "owner_token_hash": hash_b,
                "industry": "Hotel",
                "business_name": "OtherBiz",
                "email": "b@example.com",
            }]
        )

        res = client.post(
            "/business/biz-b/issues/PAYMENT_FAILURE/action",
            headers={"X-Owner-Token": token_a},
            json={"action_taken": "Tried to mutate peer business", "status": "ACTION_TAKEN"},
        )
        assert res.status_code == 403
    finally:
        if prev is None:
            os.environ["OWNER_AUTH_ENFORCE"] = "false"
        else:
            os.environ["OWNER_AUTH_ENFORCE"] = prev


def test_identity_hash_prefers_email():
    from services.identity_hash import build_identity_hash

    a = build_identity_hash(email="  Alice@Example.COM ", user_token="tok-1")
    b = build_identity_hash(email="alice@example.com", user_token="tok-2")
    assert a == b
    assert a.startswith("email:")

    device = build_identity_hash(user_token="device-uuid")
    assert device == "device:device-uuid"
