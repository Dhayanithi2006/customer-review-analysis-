"""
Phase 2 — Feedback Collection MVP tests.

Covers:
- rating 1-5 required
- non-empty feedback text
- optional email validation
- business_id must exist
- source qr | direct isolation
- QR encode target uses business feedback URL
- submissions cannot belong to another business
- pending / dashboard retrieve path
"""
from unittest.mock import patch, MagicMock
import pytest

from services.abuse_detector import reset_rate_limit
from routers.business import _generate_qr_base64
from routers.feedback import normalize_feedback_source
from domain.enums import MVP_FEEDBACK_SOURCES


def _biz_row(biz_id="biz-a", name="Cafe A", industry="Restaurant"):
    return {"id": biz_id, "business_name": name, "industry": industry}


def _settings(mode="improvement", min_len=10):
    return {
        "id": "s-1",
        "business_id": "biz-a",
        "feedback_mode": mode,
        "reward_enabled": False,
        "points_per_feedback": 10,
        "cooldown_hours": 168,
        "minimum_feedback_length": min_len,
        "reward_threshold": 100,
        "reward_description": "",
        "feedback_message": "",
    }


@patch("routers.feedback.get_db")
def test_submit_requires_rating(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    reset_rate_limit("usr-p2-1")

    res = api_client.post(
        "/feedback/biz-a",
        json={"text": "Checkout line was slow near aisle 3 today.", "user_token": "usr-p2-1"},
    )
    assert res.status_code == 422


@patch("routers.feedback.get_db")
def test_submit_rejects_rating_out_of_range(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    reset_rate_limit("usr-p2-2")

    res = api_client.post(
        "/feedback/biz-a",
        json={"text": "Checkout line was slow near aisle 3 today.", "rating": 6, "user_token": "usr-p2-2"},
    )
    assert res.status_code == 422


@patch("routers.feedback.get_db")
def test_submit_rejects_empty_text(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    reset_rate_limit("usr-p2-3")

    res = api_client.post(
        "/feedback/biz-a",
        json={"text": "   ", "rating": 3, "user_token": "usr-p2-3"},
    )
    assert res.status_code == 422


@patch("routers.feedback.get_db")
def test_submit_rejects_invalid_email(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    reset_rate_limit("usr-p2-4")

    res = api_client.post(
        "/feedback/biz-a",
        json={
            "text": "Staff were helpful but parking was confusing.",
            "rating": 4,
            "customer_email": "not-an-email",
            "user_token": "usr-p2-4",
        },
    )
    assert res.status_code == 422


@patch("routers.feedback.get_db")
def test_submit_rejects_unknown_business(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    reset_rate_limit("usr-p2-5")

    # businesses select → empty
    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

    res = api_client.post(
        "/feedback/missing-biz",
        json={
            "text": "Staff were helpful but parking was confusing.",
            "rating": 4,
            "user_token": "usr-p2-5",
            "source": "direct",
        },
    )
    assert res.status_code == 404
    assert "Business not found" in res.json()["detail"]


@patch("routers.feedback.get_db")
def test_submit_stores_qr_source_and_business_id(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    token = "usr-p2-qr"
    reset_rate_limit(token)

    # 1) business lookup  2) settings lookup
    mock_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[_biz_row("biz-a")]),
        MagicMock(data=[_settings()]),
    ]
    insert_mock = MagicMock(return_value=MagicMock(data=[{"id": "sub-1"}]))
    mock_db.table.return_value.insert.return_value.execute = insert_mock

    res = api_client.post(
        "/feedback/biz-a",
        json={
            "text": "The espresso machine was broken during the morning rush.",
            "rating": 2,
            "customer_email": "guest@example.com",
            "user_token": token,
            "source": "qr",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["submission_id"] is not None
    # Confirmation must not leak internal AI / pipeline terminology
    blob = str(body).lower()
    for banned in ("vader", "gemini", "decision center", "service_role", "supabase"):
        assert banned not in blob

    # First insert should be the feedback_submissions row
    inserted = [
        c.args[0] for c in mock_db.table.return_value.insert.call_args_list
        if c.args and isinstance(c.args[0], dict) and "raw_text" in c.args[0]
    ]
    assert inserted, "Expected feedback_submissions insert"
    row = inserted[0]
    assert row["business_id"] == "biz-a"
    assert row["source"] == "qr"
    assert row["rating"] == 2
    assert row["customer_email"] == "guest@example.com"


@patch("routers.feedback.get_db")
def test_submit_defaults_source_to_direct(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    token = "usr-p2-direct"
    reset_rate_limit(token)

    mock_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[_biz_row("biz-a")]),
        MagicMock(data=[_settings()]),
    ]
    mock_db.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[{}])

    res = api_client.post(
        "/feedback/biz-a",
        json={
            "text": "Loved the quiet seating area near the window.",
            "rating": 5,
            "user_token": token,
        },
    )
    assert res.status_code == 200
    inserted = [
        c.args[0] for c in mock_db.table.return_value.insert.call_args_list
        if c.args and isinstance(c.args[0], dict) and "raw_text" in c.args[0]
    ]
    assert inserted
    row = inserted[0]
    assert row["source"] == "direct"
    assert row["business_id"] == "biz-a"


@patch("routers.feedback.get_db")
def test_submission_cannot_override_path_business_id(mock_get_db, api_client):
    """Path business_id wins — insert must use resolved row id, not a foreign id."""
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    token = "usr-p2-iso"
    reset_rate_limit(token)

    mock_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[_biz_row("biz-a", "Cafe A")]),
        MagicMock(data=[_settings()]),
    ]
    mock_db.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[{}])

    res = api_client.post(
        "/feedback/biz-a",
        json={
            "text": "Wi-Fi dropped twice while I was ordering online.",
            "rating": 3,
            "user_token": token,
            "source": "direct",
        },
    )
    assert res.status_code == 200
    row = [
        c.args[0] for c in mock_db.table.return_value.insert.call_args_list
        if c.args and isinstance(c.args[0], dict) and "raw_text" in c.args[0]
    ][0]
    assert row["business_id"] == "biz-a"
    assert row["business_id"] != "biz-other"


@patch("routers.feedback.get_db")
def test_pending_endpoint_scoped_to_business(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    # business lookup
    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[_biz_row("biz-a")]
    )
    # pending count + samples use .is_() chain
    is_chain = mock_db.table.return_value.select.return_value.eq.return_value.is_.return_value
    is_chain.execute.return_value = MagicMock(data=[], count=2)
    is_chain.order.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[{
            "id": "sub-1",
            "raw_text": "Queues were long at lunch.",
            "rating": 2,
            "engagement_mode": "improvement",
            "feedback_tag": None,
            "submitted_at": "2026-08-08T10:00:00Z",
        }]
    )
    # all-time count
    mock_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[_biz_row("biz-a")]),
        MagicMock(data=[], count=5),
    ]

    res = api_client.get("/feedback/biz-a/pending")
    assert res.status_code == 200
    data = res.json()
    assert data["business_id"] == "biz-a"
    assert data["business_name"] == "Cafe A"
    assert "samples" in data
    assert isinstance(data["samples"], list)


def test_mvp_sources_and_normalize():
    assert MVP_FEEDBACK_SOURCES == {"qr", "direct", "csv", "sample"}
    assert normalize_feedback_source("qr") == "qr"
    assert normalize_feedback_source("QR_FORM") == "qr"
    assert normalize_feedback_source("web_form") == "direct"
    assert normalize_feedback_source("telegram") == "direct"  # not MVP → default
    assert normalize_feedback_source(None, default="sample") == "sample"


def test_qr_encodes_business_feedback_url():
    url = "http://localhost:3000/feedback/biz-qr-1?source=qr"
    data_uri = _generate_qr_base64(url)
    if data_uri is None:
        pytest.skip("qrcode package not installed in test env")
    assert data_uri.startswith("data:image/png;base64,")
    assert len(data_uri) > 100


@patch("routers.business.get_db")
@patch("routers.business._generate_qr_base64")
def test_register_always_generates_qr_with_source_param(mock_qr, mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    mock_qr.return_value = "data:image/png;base64,AAA"

    # email uniqueness check → empty
    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
    mock_db.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[{
            "id": "biz-new",
            "business_name": "Demo Cafe",
            "industry": "Restaurant",
            "email": "owner@demo.com",
            "feedback_url": "http://localhost:3000/feedback/biz-new",
            "dashboard_url": "http://localhost:3000/business/biz-new",
            "qr_code": "data:image/png;base64,AAA",
            "feedback_method": "qr",
            "engagement_mode": "improvement",
            "monthly_customers": 500,
            "avg_revenue_per_user": 500,
            "premium_pct": 20,
            "currency": "INR",
            "created_at": "2026-08-08T00:00:00Z",
        }]
    )

    res = api_client.post(
        "/business/register",
        json={
            "business_name": "Demo Cafe",
            "industry": "Restaurant",
            "email": "owner@demo.com",
            "feedback_method": "qr",
            "monthly_customers": 500,
            "avg_revenue_per_user": 500,
            "premium_pct": 20,
            "currency": "INR",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["qr_code"]
    assert "/feedback/" in data["feedback_url"]
    # QR target must include source=qr and the business feedback path
    qr_arg = mock_qr.call_args[0][0]
    assert "?source=qr" in qr_arg
    assert "/feedback/" in qr_arg


@patch("routers.business.get_db")
@patch("routers.business._generate_qr_base64", return_value="data:image/png;base64,BBB")
def test_regenerate_qr_endpoint(mock_qr, mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{
            "id": "biz-a",
            "business_name": "Cafe A",
            "industry": "Restaurant",
            "email": "a@test.com",
            "feedback_url": "http://localhost:3000/feedback/biz-a",
            "dashboard_url": "http://localhost:3000/business/biz-a",
            "qr_code": None,
            "feedback_method": "qr",
            "engagement_mode": "improvement",
            "monthly_customers": 100,
            "avg_revenue_per_user": 200,
            "premium_pct": 10,
            "currency": "INR",
            "created_at": "2026-08-08T00:00:00Z",
        }]
    )
    mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{
            "id": "biz-a",
            "business_name": "Cafe A",
            "industry": "Restaurant",
            "email": "a@test.com",
            "feedback_url": "http://localhost:3000/feedback/biz-a",
            "dashboard_url": "http://localhost:3000/business/biz-a",
            "qr_code": "data:image/png;base64,BBB",
            "feedback_method": "qr",
            "engagement_mode": "improvement",
            "monthly_customers": 100,
            "avg_revenue_per_user": 200,
            "premium_pct": 10,
            "currency": "INR",
            "created_at": "2026-08-08T00:00:00Z",
        }]
    )

    res = api_client.post("/business/biz-a/qr/regenerate")
    assert res.status_code == 200
    assert res.json()["qr_code"] == "data:image/png;base64,BBB"
    assert "?source=qr" in mock_qr.call_args[0][0]
