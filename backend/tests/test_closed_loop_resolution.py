"""
Backend Automated Test Suite for Closed-Loop Feedback Resolution Engine
Phase 6 — covers lifecycle, follow-up, improvement math, tokens, isolation.
"""
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from main import app
from services.email_service import render_follow_up_template, send_follow_up_email
from routers.followup import (
    calculate_improvement_percentage,
    evaluate_resolution_status,
    IMPROVEMENT_THRESHOLD,
)

client = TestClient(app)


def test_improvement_percentage_calculation():
    """Effective Improvements = Improved + 0.5 × Somewhat Improved."""
    # 26 improved, 4 somewhat, 2 not -> effective 28 / 32 = 87.5%
    eff, pct = calculate_improvement_percentage(26, 4, 2)
    assert eff == 28.0
    assert pct == 87.5

    # 4 improved, 4 somewhat, 12 not -> effective 6 / 20 = 30.0%
    eff2, pct2 = calculate_improvement_percentage(4, 4, 12)
    assert eff2 == 6.0
    assert pct2 == 30.0


def test_improvement_threshold_state_transition():
    """Threshold 70%: IMPROVED vs REOPENED."""
    _, high_pct = calculate_improvement_percentage(26, 4, 2)  # 87.5%
    assert evaluate_resolution_status(high_pct, 32) == "IMPROVED"

    _, low_pct = calculate_improvement_percentage(4, 4, 12)  # 30.0%
    assert evaluate_resolution_status(low_pct, 20) == "REOPENED"

    assert evaluate_resolution_status(100.0, 0) == "FOLLOW_UP_SENT"
    assert IMPROVEMENT_THRESHOLD == 70.0


def test_console_email_mode_rendering(capsys):
    """EMAIL_MODE=console works without external provider."""
    success = send_follow_up_email(
        to_email="testcustomer@example.com",
        business_name="FreshMart",
        issue_title="Checkout Waiting Time",
        action_taken="Opened 2 additional checkout counters.",
        token="mock_token_12345",
    )
    assert success is True


def test_followup_template_security():
    """Secure link uses token only — no internal IDs."""
    subject, body, link = render_follow_up_template(
        business_name="FreshMart",
        issue_title="Checkout Waiting Time",
        action_taken="Opened 2 additional counters",
        token="secure_token_abc123",
    )
    assert "FreshMart" in subject
    assert "Checkout Waiting Time" in body
    assert "Opened 2 additional counters" in body
    assert "Has your experience improved?" in body
    assert "secure_token_abc123" in link
    assert "/follow-up/secure_token_abc123" in link
    assert "business_id" not in link
    assert "issue_key" not in link
    assert "12345" not in link


def test_feedback_submit_optional_email(monkeypatch):
    """Optional email field handling."""
    mock_db = MagicMock()
    monkeypatch.setattr("routers.feedback.get_db", lambda: mock_db)
    monkeypatch.setattr(
        "routers.feedback._get_or_create_settings",
        lambda db, b_id, ind: {"feedback_mode": "product", "minimum_feedback_length": 10},
    )

    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"id": "biz-123", "business_name": "TestBiz", "industry": "retail"}
    ]

    resp1 = client.post(
        "/feedback/biz-123",
        json={"text": "Checkout queue was extremely slow today.", "rating": 2},
    )
    assert resp1.status_code == 200
    assert resp1.json()["success"] is True

    resp2 = client.post(
        "/feedback/biz-123",
        json={
            "text": "Checkout queue was extremely slow today.",
            "rating": 2,
            "customer_email": "customer@example.com",
        },
    )
    assert resp2.status_code == 200
    assert resp2.json()["success"] is True


def test_action_endpoint_and_state_machine(monkeypatch):
    """IDENTIFIED → ACTION_TAKEN records real-world action."""
    mock_db = MagicMock()
    monkeypatch.setattr("routers.followup.get_db", lambda: mock_db)

    # Business lookup
    biz_chain = MagicMock()
    biz_chain.select.return_value.eq.return_value.execute.return_value.data = [
        {"id": "biz-123", "business_name": "TestBiz"}
    ]

    # Resolution lookup returns empty → create path; then updates
    empty = MagicMock()
    empty.data = []

    def table_side_effect(name):
        m = MagicMock()
        if name == "businesses":
            return biz_chain
        if name == "issue_resolutions":
            m.select.return_value.eq.return_value.eq.return_value.execute.return_value = empty
            m.insert.return_value.execute.return_value = MagicMock()
            m.update.return_value.eq.return_value.execute.return_value = MagicMock()
            return m
        if name == "feedback_submissions":
            m.select.return_value.eq.return_value.not_.is_.return_value.neq.return_value.eq.return_value.execute.return_value.data = []
            return m
        if name == "sessions":
            m.select.return_value.eq.return_value.execute.return_value.data = []
            return m
        return m

    mock_db.table.side_effect = table_side_effect

    res = client.post(
        "/business/biz-123/issues/CHECKOUT_DELAY/action",
        json={
            "action_taken": "Opened 2 extra counters",
            "status": "ACTION_TAKEN",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["action_taken"] == "Opened 2 extra counters"
    assert data["status"] in {"ACTION_TAKEN", "FOLLOW_UP_SENT"}


def test_invalid_status_transition_rejection(monkeypatch):
    """Invalid action status values are rejected with 422."""
    mock_db = MagicMock()
    monkeypatch.setattr("routers.followup.get_db", lambda: mock_db)

    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"id": "biz-123", "business_name": "TestBiz"}
    ]
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
        {
            "id": "res-1",
            "business_id": "biz-123",
            "issue_key": "CHECKOUT_DELAY",
            "status": "IMPROVED",
        }
    ]

    res = client.post(
        "/business/biz-123/issues/CHECKOUT_DELAY/action",
        json={"action_taken": "Invalid jump", "status": "FOLLOW_UP_SENT"},
    )
    assert res.status_code == 422


def test_business_isolation_protection(monkeypatch):
    """Business A cannot mutate Business B's issue."""
    mock_db = MagicMock()
    monkeypatch.setattr("routers.followup.get_db", lambda: mock_db)

    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

    res = client.post(
        "/business/biz-unauthorized/issues/CHECKOUT_DELAY/action",
        json={"action_taken": "Malicious edit", "status": "ACTION_TAKEN"},
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "Business not found."


def test_followup_response_endpoint_flow(monkeypatch):
    """Customer response + single-use token protection."""
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
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
        {
            "id": "res-1",
            "business_id": "biz-123",
            "issue_key": "CHECKOUT_DELAY",
            "status": "FOLLOW_UP_SENT",
            "improved_count": 0,
            "somewhat_improved_count": 0,
            "not_improved_count": 0,
            "response_count": 0,
        }
    ]

    res = client.post(
        f"/follow-up/{token}/response",
        json={"response": "improved", "comment": "Much faster now!"},
    )
    assert res.status_code == 200
    assert res.json()["success"] is True
    assert res.json()["status"] == "IMPROVED"

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
        json={"response": "improved"},
    )
    assert res_reuse.status_code == 400
    assert "already been used" in res_reuse.json()["detail"]


def test_reopened_status_requires_attention():
    """REOPENED must stay an active-attention status."""
    from routers.followup import ACTIVE_ATTENTION_STATUSES

    assert "REOPENED" in ACTIVE_ATTENTION_STATUSES
    assert evaluate_resolution_status(30.0, 10) == "REOPENED"


def test_action_taken_triggers_followup_when_email_exists(monkeypatch):
    """Follow-up is triggered by ACTION_TAKEN when customer email exists."""
    mock_db = MagicMock()
    monkeypatch.setattr("routers.followup.get_db", lambda: mock_db)

    sent = {"count": 0}

    def fake_send(**kwargs):
        sent["count"] += 1
        assert "token" in kwargs
        assert kwargs["issue_title"] == "Checkout Delay"
        assert "counters" in kwargs["action_taken"]
        return True

    monkeypatch.setattr("routers.followup.send_follow_up_email", fake_send)

    def table_side_effect(name):
        m = MagicMock()
        if name == "businesses":
            m.select.return_value.eq.return_value.execute.return_value.data = [
                {"id": "biz-123", "business_name": "FreshMart"}
            ]
            return m
        if name == "issue_resolutions":
            m.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
                {
                    "id": "res-1",
                    "business_id": "biz-123",
                    "issue_key": "CHECKOUT_DELAY",
                    "status": "IDENTIFIED",
                    "contacted_count": 0,
                    "you_said": "Checkout Waiting Time",
                }
            ]
            return m
        if name == "feedback_submissions":
            # Chain: select.eq.not_.is_.neq.eq.execute
            chain = m.select.return_value.eq.return_value.not_.is_.return_value.neq.return_value.eq.return_value
            chain.execute.return_value.data = [
                {
                    "id": "fb-1",
                    "customer_email": "shopper@example.com",
                    "raw_text": "Long wait",
                    "follow_up_sent": False,
                    "follow_up_eligible": True,
                }
            ]
            return m
        if name == "sessions":
            m.select.return_value.eq.return_value.execute.return_value.data = []
            return m
        if name == "follow_up_tokens":
            return m
        return m

    mock_db.table.side_effect = table_side_effect

    res = client.post(
        "/business/biz-123/issues/CHECKOUT_DELAY/action",
        json={
            "action_taken": "Opened 2 additional checkout counters.",
            "status": "ACTION_TAKEN",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "FOLLOW_UP_SENT"
    assert data["followup"]["followups_triggered"] is True
    assert data["followup"]["sent_count"] == 1
    assert sent["count"] == 1


def test_public_followup_context_hides_internal_ids(monkeypatch):
    mock_db = MagicMock()
    monkeypatch.setattr("routers.followup.get_db", lambda: mock_db)

    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {
            "token": "tok_public",
            "business_id": "biz-internal-uuid",
            "issue_key": "CHECKOUT_DELAY",
            "feedback_id": "fb-internal-uuid",
            "email": "cust@example.com",
            "is_used": False,
        }
    ]
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
        {
            "id": "res-1",
            "action_taken": "Opened 2 additional checkout counters.",
            "status": "FOLLOW_UP_SENT",
        }
    ]

    # businesses name
    def table_side_effect(name):
        m = MagicMock()
        if name == "follow_up_tokens":
            m.select.return_value.eq.return_value.execute.return_value.data = [
                {
                    "token": "tok_public",
                    "business_id": "biz-internal-uuid",
                    "issue_key": "CHECKOUT_DELAY",
                    "feedback_id": "fb-internal-uuid",
                    "email": "cust@example.com",
                    "is_used": False,
                }
            ]
            return m
        if name == "businesses":
            m.select.return_value.eq.return_value.execute.return_value.data = [
                {"business_name": "FreshMart"}
            ]
            return m
        if name == "issue_resolutions":
            m.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
                {
                    "id": "res-1",
                    "action_taken": "Opened 2 additional checkout counters.",
                    "status": "FOLLOW_UP_SENT",
                }
            ]
            return m
        return m

    mock_db.table.side_effect = table_side_effect

    res = client.get("/follow-up/tok_public")
    assert res.status_code == 200
    data = res.json()
    assert data["already_submitted"] is False
    assert data["business_name"] == "FreshMart"
    assert data["issue_title"] == "Checkout Delay"
    assert "counters" in data["action_taken"]
    assert "business_id" not in data
    assert "issue_key" not in data
    assert "feedback_id" not in data
