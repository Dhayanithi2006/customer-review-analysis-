"""
Unit and Integration Tests for Phase 5 — You Said → We Did Feedback Closure System
Requirements Tested:
1. Workspace Resolution Management (GET, POST, PATCH /business/{business_id}/resolutions)
2. Status Lifecycle: Open → Investigating → Planned → In Progress → Resolved
3. Public Customer-Facing Endpoint (GET /feedback/{business_id}/updates)
4. Strict Privacy: Zero revenue calculations, PII, or internal AI reasoning exposed on public updates endpoint.
"""
import pytest
from unittest.mock import patch, MagicMock


# ── Test 1: Workspace Create & List Resolutions ────────────────────────────────
@patch("routers.resolutions.get_db")
def test_create_and_list_workspace_resolutions(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    # Business check
    mock_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[{"id": "biz-1"}]),  # business lookup
        MagicMock(data=[]),                 # existing resolution lookup (none yet)
    ]

    res = api_client.post(
        "/business/biz-1/resolutions",
        json={
            "issue_key": "CHECKOUT_DELAY",
            "you_said": "Checkout queues are too long during peak evening hours.",
            "we_did": "Added 2 additional express checkout counters.",
            "status": "In Progress",
            "is_public": True,
        }
    )

    assert res.status_code == 200
    data = res.json()
    assert data["issue_key"] == "CHECKOUT_DELAY"
    assert data["status"] == "In Progress"
    assert data["you_said"] == "Checkout queues are too long during peak evening hours."
    assert data["we_did"] == "Added 2 additional express checkout counters."


# ── Test 2: Update Resolution Status to Resolved ──────────────────────────────
@patch("routers.resolutions.get_db")
def test_update_resolution_status_to_resolved(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    mock_db.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{
            "id": "res-101",
            "business_id": "biz-1",
            "issue_key": "CHECKOUT_DELAY",
            "status": "Resolved",
            "you_said": "Checkout queues are too long.",
            "we_did": "Added express counters.",
            "is_public": True,
            "resolved_at": "2026-02-08T11:00:00Z",
            "updated_at": "2026-02-08T11:00:00Z",
        }]
    )

    res = api_client.patch(
        "/business/biz-1/resolutions/res-101",
        json={"status": "Resolved", "we_did": "Added express counters."}
    )

    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "Resolved"
    assert data["resolved_at"] is not None


# ── Test 3: Public Customer-Facing Endpoint (No AI/Pll leakage) ────────────────
@patch("routers.resolutions.get_db")
def test_public_feedback_updates_feed_privacy(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    # Business query
    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"id": "biz-1", "business_name": "FreshMart"}]
    )
    # Public resolutions query (chain: select -> eq -> eq -> order -> execute)
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(
        data=[{
            "id": "res-101",
            "issue_key": "CHECKOUT_DELAY",
            "status": "Resolved",
            "you_said": "Checkout queue is too long.",
            "we_did": "Added an additional checkout counter during peak hours.",
            "updated_at": "2026-02-08T10:00:00Z",
            "resolved_at": "2026-02-08T10:00:00Z",
        }]
    )

    res = api_client.get("/feedback/biz-1/updates")
    assert res.status_code == 200
    data = res.json()
    assert data["business_name"] == "FreshMart"
    assert len(data["updates"]) == 1

    item = data["updates"][0]
    assert item["status"] == "Resolved"
    assert item["you_said"] == "Checkout queue is too long."
    assert item["we_did"] == "Added an additional checkout counter during peak hours."

    # Zero internal revenue calculations, AI scores, or customer PII in payload
    response_text = res.text.lower()
    for forbidden in ["revenue_at_risk", "priority_score", "customer_email", "customer_name", "vader", "gemini"]:
        assert forbidden not in response_text


# ── Test 4: Invalid Status Validation ─────────────────────────────────────────
@patch("routers.resolutions.get_db")
def test_invalid_resolution_status_rejected(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": "biz-1"}])

    res = api_client.post(
        "/business/biz-1/resolutions",
        json={
            "issue_key": "BUG_1",
            "you_said": "Some issue text",
            "status": "InvalidStatusName",
        }
    )
    assert res.status_code == 422
    assert "Invalid status" in res.json()["detail"]
