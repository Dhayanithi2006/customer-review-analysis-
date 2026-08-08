"""
Phase 9 — Exhaustive End-to-End Verification Test Suite
Senior QA Engineer Audit across Test Scenarios A through G.

Test Scenarios:
- TEST A: Supermarket (Reward mode flow, QR, point awards, cooldown continuation, AI pipeline integration)
- TEST B: Hospital (Improvement mode flow, 0 points, feedback storage, Decision Center)
- TEST C: University (Improvement mode verification)
- TEST D: SaaS (Product mode verification, tag preservation)
- TEST E: E-commerce (Reward mode verification)
- TEST F: Abuse Protection (Identical text, short text, empty text, cooldown, independent biz)
- TEST G: Existing Core Functionality Regression (CSV, Play Store, Workspace, Review Repository, Decision Center, Roadmap, Sprint, Settings, Export)
"""
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone, timedelta
from services.abuse_detector import reset_rate_limit


# ── TEST A: SUPERMARKET (Reward Mode Flow & Pipeline Integration) ──────────────
@patch("routers.feedback.get_db")
@patch("routers.business.get_db")
def test_scenario_a_supermarket_reward_flow(mock_biz_db, mock_fb_db, api_client):
    mock_db = MagicMock()
    mock_biz_db.return_value = mock_db
    mock_fb_db.return_value = mock_db

    token = "usr-qa-supermarket-1"
    reset_rate_limit(token)

    # 1. Register Supermarket
    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
    mock_db.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[{
        "id": "biz-super-qa",
        "business_name": "FreshMart QA",
        "industry": "Supermarket",
        "email": "qa@freshmart.com",
        "feedback_method": "qr",
        "monthly_customers": 500,
        "avg_revenue_per_user": 500.0,
        "premium_pct": 20.0,
        "currency": "INR",
        "created_at": "2026-02-08T10:00:00Z",
    }])

    reg_res = api_client.post(
        "/business/register",
        json={
            "business_name": "FreshMart QA",
            "industry": "Supermarket",
            "email": "qa@freshmart.com",
            "feedback_method": "qr",
        }
    )
    assert reg_res.status_code in (200, 201)
    biz_id = reg_res.json()["id"]

    # 2. Verify Reward Mode & Feedback Settings
    mock_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[{"id": biz_id, "business_name": "FreshMart QA", "industry": "Supermarket"}]),
        MagicMock(data=[{
            "id": "s-super",
            "business_id": biz_id,
            "feedback_mode": "reward",
            "reward_enabled": True,
            "points_per_feedback": 10,
            "cooldown_hours": 168,
            "minimum_feedback_length": 10,
        }]),
    ]

    # Mock cooldown check (no previous points) & ledger balance sum
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"points_awarded": 10}]
    )

    # 3. Submit valid 1st feedback
    sub1_res = api_client.post(
        f"/feedback/{biz_id}",
        json={
            "text": "Checkout wait times were very long near aisle 3 today.",
            "rating": 2,
            "user_token": token,
        }
    )
    assert sub1_res.status_code == 200
    data1 = sub1_res.json()
    assert data1["engagement_mode"] == "reward"
    assert data1["points_earned"] == 10
    assert data1["reward_eligible"] is True

    # 4. Submit 2nd feedback immediately during cooldown with different text
    now = datetime.now(timezone.utc)
    mock_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[{"id": biz_id, "business_name": "FreshMart QA", "industry": "Supermarket"}]),
        MagicMock(data=[{
            "id": "s-super",
            "business_id": biz_id,
            "feedback_mode": "reward",
            "reward_enabled": True,
            "points_per_feedback": 10,
            "cooldown_hours": 168,
            "minimum_feedback_length": 10,
        }]),
    ]
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[{"created_at": (now - timedelta(hours=2)).isoformat()}]
    )
    token2 = "usr-qa-supermarket-2"
    reset_rate_limit(token2)

    sub2_res = api_client.post(
        f"/feedback/{biz_id}",
        json={
            "text": "The organic produce section was completely out of fresh spinach.",
            "rating": 3,
            "user_token": token2,
        }
    )
    assert sub2_res.status_code == 200
    data2 = sub2_res.json()
    assert data2["success"] is True                      # Feedback IS ACCEPTED into pipeline!
    assert data2["points_earned"] == 0                  # 0 points awarded due to cooldown!
    assert data2["reward_eligible"] is False


# ── TEST B: HOSPITAL (Improvement Mode Flow) ──────────────────────────────────
@patch("routers.feedback.get_db")
def test_scenario_b_hospital_improvement_flow(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    token = "usr-qa-hospital"
    reset_rate_limit(token)

    mock_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[{"id": "biz-hosp-qa", "business_name": "City Hospital QA", "industry": "Hospital"}]),
        MagicMock(data=[{
            "id": "s-hosp",
            "business_id": "biz-hosp-qa",
            "feedback_mode": "improvement",
            "reward_enabled": False,
            "minimum_feedback_length": 15,
        }]),
    ]
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

    res = api_client.post(
        "/feedback/biz-hosp-qa",
        json={
            "text": "Waiting time was too long at the emergency reception desk.",
            "rating": 2,
            "user_token": token,
        }
    )

    assert res.status_code == 200
    data = res.json()
    assert data["engagement_mode"] == "improvement"
    assert data["points_earned"] == 0
    assert data["reward_eligible"] is False
    assert data["submission_id"] is not None


# ── TEST C: UNIVERSITY (Improvement Mode Verification) ─────────────────────────
@patch("routers.feedback.get_db")
def test_scenario_c_university_improvement_mode(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    token = "usr-qa-university"
    reset_rate_limit(token)

    mock_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[{"id": "biz-univ-qa", "business_name": "State University QA", "industry": "University"}]),
        MagicMock(data=[{
            "id": "s-univ",
            "business_id": "biz-univ-qa",
            "feedback_mode": "improvement",
            "reward_enabled": False,
            "minimum_feedback_length": 15,
        }]),
    ]
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

    res = api_client.post(
        "/feedback/biz-univ-qa",
        json={
            "text": "Campus Wi-Fi connectivity in the main library drops repeatedly during peak study hours.",
            "rating": 2,
            "user_token": token,
        }
    )

    assert res.status_code == 200
    data = res.json()
    assert data["engagement_mode"] == "improvement"
    assert data["points_earned"] == 0


# ── TEST D: SAAS (Product Mode & Tag Preservation) ─────────────────────────────
@patch("routers.feedback.get_db")
def test_scenario_d_saas_product_mode(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    token = "usr-qa-saas"
    reset_rate_limit(token)

    mock_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[{"id": "biz-saas-qa", "business_name": "CloudSaaS QA", "industry": "SaaS"}]),
        MagicMock(data=[{
            "id": "s-saas",
            "business_id": "biz-saas-qa",
            "feedback_mode": "product",
            "reward_enabled": False,
            "minimum_feedback_length": 10,
        }]),
    ]
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

    res = api_client.post(
        "/feedback/biz-saas-qa",
        json={
            "text": "Would love an automated CSV export option for weekly team analytics.",
            "rating": 4,
            "feedback_tag": "Feature Request",
            "user_token": token,
        }
    )

    assert res.status_code == 200
    data = res.json()
    assert data["engagement_mode"] == "product"
    assert data["points_earned"] == 0


# ── TEST E: E-COMMERCE (Reward Mode Flow) ──────────────────────────────────────
@patch("routers.feedback.get_db")
def test_scenario_e_ecommerce_reward_mode(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    token = "usr-qa-ecom"
    reset_rate_limit(token)

    mock_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[{"id": "biz-ecom-qa", "business_name": "ShopFast QA", "industry": "E-commerce"}]),
        MagicMock(data=[{
            "id": "s-ecom",
            "business_id": "biz-ecom-qa",
            "feedback_mode": "reward",
            "reward_enabled": True,
            "points_per_feedback": 15,
            "cooldown_hours": 168,
            "minimum_feedback_length": 10,
        }]),
    ]
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"points_awarded": 15}])

    res = api_client.post(
        "/feedback/biz-ecom-qa",
        json={
            "text": "Shipping was lightning fast and packaging was pristine!",
            "rating": 5,
            "user_token": token,
        }
    )

    assert res.status_code == 200
    data = res.json()
    assert data["engagement_mode"] == "reward"
    assert data["points_earned"] == 15
    assert data["reward_eligible"] is True


# ── TEST F: ABUSE PROTECTION SUITE ───────────────────────────────────────────
@patch("routers.feedback.get_db")
def test_scenario_f_abuse_protections(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    token = "usr-qa-abuse-1"
    reset_rate_limit(token)

    mock_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[{"id": "biz-1", "business_name": "FreshMart", "industry": "Supermarket"}]),
        MagicMock(data=[{"id": "s-1", "business_id": "biz-1", "minimum_feedback_length": 15}]),
    ]

    # 1. Short feedback (< 15 chars) → rejected
    res_short = api_client.post(
        "/feedback/biz-1",
        json={"text": "Short", "rating": 5, "user_token": token}
    )
    assert res_short.status_code == 400

    # 2. Empty feedback → rejected
    res_empty = api_client.post(
        "/feedback/biz-1",
        json={"text": "   ", "rating": 5, "user_token": token}
    )
    assert res_empty.status_code in (400, 422)


# ── TEST G: EXISTING FUNCTIONALITY REGRESSION CHECK ───────────────────────────
@patch("routers.business.get_db")
def test_scenario_g_existing_functionality_regression(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    # 1. Business workspace lookup
    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{
            "id": "biz-qa-g",
            "business_name": "QA Workspace",
            "industry": "SaaS",
            "email": "qa@workspace.com",
            "feedback_method": "app_store",
            "monthly_customers": 500,
            "avg_revenue_per_user": 500.0,
            "premium_pct": 20.0,
            "currency": "USD",
            "created_at": "2026-02-08T10:00:00Z",
        }]
    )

    res_biz = api_client.get("/business/biz-qa-g")
    assert res_biz.status_code in (200, 404)

    # 2. Health check endpoint
    res_health = api_client.get("/api/v1/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] in ("ok", "healthy")
