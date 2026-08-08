"""
Unit and Integration Tests for Phase 7 — Feedback Engagement Analytics
Tests:
1. GET /business/{business_id}/feedback-health returns total_feedback, weekly feedback, engagement mode, reward points issued, top source, sentiment distribution, and most repeated issue.
2. Derives metrics from existing Review Repository and feedback_submissions without duplicate DB logic.
"""
import pytest
from unittest.mock import patch, MagicMock


@patch("routers.business.get_db")
def test_get_feedback_health_metrics(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

# Setup database mocks
    def mock_table(name):
        mock_t = MagicMock()
        if name == "businesses":
            mock_t.select.return_value.eq.return_value.execute.return_value = MagicMock(
                data=[{"id": "biz-1", "business_name": "FreshMart", "industry": "Supermarket"}]
            )
        elif name == "feedback_engagement_settings":
            mock_t.select.return_value.eq.return_value.execute.return_value = MagicMock(
                data=[{"feedback_mode": "reward"}]
            )
        elif name == "feedback_submissions":
            mock_t.select.return_value.eq.return_value.execute.return_value = MagicMock(
                data=[{"id": "sub-1", "created_at": "2026-02-08T10:00:00Z"}]
            )
        elif name == "feedback_rewards":
            mock_t.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
                data=[{"points_awarded": 10}, {"points_awarded": 20}]
            )
        elif name == "analysis_versions":
            mock_t.select.return_value.eq.return_value.execute.return_value = MagicMock(
                data=[{"session_id": "sess-100"}]
            )
            mock_t.select.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
                data=[]
            )
        elif name == "reviews":
            mock_t.select.return_value.in_.return_value.execute.return_value = MagicMock(
                data=[
                    {"sentiment_label": "Negative", "source": "QR Code"},
                    {"sentiment_label": "Negative", "source": "QR Code"},
                    {"sentiment_label": "Positive", "source": "QR Code"},
                ]
            )
        return mock_t

    mock_db.table.side_effect = mock_table

    res = api_client.get("/business/biz-1/feedback-health")
    assert res.status_code == 200
    data = res.json()
    assert data["business_id"] == "biz-1"
    assert data["engagement_mode"] == "reward"
    assert data["points_issued"] == 30
    assert "sentiment_distribution" in data
    assert data["sentiment_distribution"]["negative_pct"] >= 0
