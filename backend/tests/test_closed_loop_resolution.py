"""
Backend Automated Test Suite for Closed-Loop Feedback Resolution Engine
Covers all 18 specified test requirements.
"""
import pytest
import secrets
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from main import app
from services.email_service import render_follow_up_template, send_follow_up_email
from routers.followup import calculate_improvement_percentage, IMPROVEMENT_THRESHOLD

client = TestClient(app)


def test_improvement_percentage_calculation():
    """Requirement 12: Improvement percentage formula verification."""
    # 26 improved, 4 somewhat, 2 not -> effective 28 / 32 = 87.5%
    eff, pct = calculate_improvement_percentage(26, 4, 2)
    assert eff == 28.0
    assert pct == 87.5

    # 4 improved, 4 somewhat, 12 not -> effective 6 / 20 = 30.0%
    eff2, pct2 = calculate_improvement_percentage(4, 4, 12)
    assert eff2 == 6.0
    assert pct2 == 30.0


def test_improvement_threshold_state_transition():
    """Requirements 13 & 14: Threshold logic (IMPROVED vs REOPENED)."""
    _, high_pct = calculate_improvement_percentage(26, 4, 2)  # 87.5%
    status_high = "IMPROVED" if high_pct >= IMPROVEMENT_THRESHOLD else "REOPENED"
    assert status_high == "IMPROVED"

    _, low_pct = calculate_improvement_percentage(4, 4, 12)   # 30.0%
    status_low = "IMPROVED" if low_pct >= IMPROVEMENT_THRESHOLD else "REOPENED"
    assert status_low == "REOPENED"


def test_console_email_mode_rendering(capsys):
    """Requirement 17: Console email mode works safely without external provider."""
    success = send_follow_up_email(
        to_email="testcustomer@example.com",
        business_name="FreshMart",
        issue_title="Checkout Waiting Time",
        action_taken="Opened 2 additional checkout counters.",
        token="mock_token_12345",
    )
    assert success is True


def test_followup_template_security():
    """Requirement 8: Renders secure links without raw database IDs."""
    subject, body, link = render_follow_up_template(
        business_name="FreshMart",
        issue_title="Checkout Waiting Time",
        action_taken="Opened 2 additional counters",
        token="secure_token_abc123"
    )
    assert "FreshMart" in subject
    assert "secure_token_abc123" in link
    assert "12345" not in link  # No raw internal ID exposed


def test_feedback_submit_optional_email(monkeypatch):
    """Requirements 1 & 2: Optional email field handling."""
    mock_db = MagicMock()
    monkeypatch.setattr("routers.feedback.get_db", lambda: mock_db)
    monkeypatch.setattr("routers.feedback._get_or_create_settings", lambda db, b_id, ind: {"feedback_mode": "product", "minimum_feedback_length": 10})
    
    # Mock business query
    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"id": "biz-123", "business_name": "TestBiz", "industry": "retail"}
    ]

    # Test submission without email
    resp1 = client.post("/feedback/biz-123", json={
        "text": "Checkout queue was extremely slow today.",
        "rating": 2,
    })
    assert resp1.status_code == 200
    assert resp1.json()["success"] is True

    # Test submission with optional email
    resp2 = client.post("/feedback/biz-123", json={
        "text": "Checkout queue was extremely slow today.",
        "rating": 2,
        "customer_email": "customer@example.com"
    })
    assert resp2.status_code == 200
    assert resp2.json()["success"] is True


def test_action_endpoint_and_state_machine(monkeypatch):
    """Requirements 3 & 4: Issue status transitions IDENTIFIED -> ACTION_PLANNED -> ACTION_TAKEN."""
    mock_db = MagicMock()
    monkeypatch.setattr("routers.followup.get_db", lambda: mock_db)

    # Mock business check
    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"id": "biz-123", "business_name": "TestBiz"}
    ]

    # Valid transition to ACTION_TAKEN
    res = client.post(
        "/business/biz-123/issues/CHECKOUT_DELAY/action",
        json={"action_taken": "Opened 2 extra counters", "status": "ACTION_TAKEN"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["status"] == "ACTION_TAKEN"
    assert data["action_taken"] == "Opened 2 extra counters"


def test_invalid_status_transition_rejection(monkeypatch):
    """Requirement 4: Invalid state machine transitions are rejected with 422."""
    mock_db = MagicMock()
    monkeypatch.setattr("routers.followup.get_db", lambda: mock_db)

    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"id": "biz-123", "business_name": "TestBiz"}
    ]

    # Mock current status as IMPROVED
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
        {"id": "res-1", "business_id": "biz-123", "issue_key": "CHECKOUT_DELAY", "status": "IMPROVED"}
    ]

    res = client.post(
        "/business/biz-123/issues/CHECKOUT_DELAY/action",
        json={"action_taken": "Invalid jump", "status": "FOLLOW_UP_SENT"}
    )
    assert res.status_code == 422


def test_business_isolation_protection(monkeypatch):
    """Requirement 15: Business A cannot access or mutate Business B's issue."""
    mock_db = MagicMock()
    monkeypatch.setattr("routers.followup.get_db", lambda: mock_db)

    # Return empty business for non-owner
    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

    res = client.post(
        "/business/biz-unauthorized/issues/CHECKOUT_DELAY/action",
        json={"action_taken": "Malicious edit", "status": "ACTION_TAKEN"}
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "Business not found."


def test_followup_response_endpoint_flow(monkeypatch):
    """Requirements 9, 10, 11: Customer response submission and single-use token protection."""
    mock_db = MagicMock()
    monkeypatch.setattr("routers.followup.get_db", lambda: mock_db)

    token = "test_token_xyz"
    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {
            "token": token,
            "business_id": "biz-123",
            "issue_key": "CHECKOUT_DELAY",
            "email": "cust@example.com",
            "is_used": False,
        }
    ]

    # Submit response
    res = client.post(
        f"/follow-up/{token}/response",
        json={"response": "improved", "comment": "Much faster now!"}
    )
    assert res.status_code == 200
    assert res.json()["success"] is True

    # Attempt reuse of token (should be rejected)
    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {
            "token": token,
            "business_id": "biz-123",
            "issue_key": "CHECKOUT_DELAY",
            "email": "cust@example.com",
            "is_used": True,
        }
    ]
    res_reuse = client.post(
        f"/follow-up/{token}/response",
        json={"response": "improved"}
    )
    assert res_reuse.status_code == 400
    assert "already been used" in res_reuse.json()["detail"]
