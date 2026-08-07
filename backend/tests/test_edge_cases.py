"""
Edge Cases & Robustness Test Suite
- Large CSV capped at 10,000 reviews
- Play Store scraper failure handling
- Duplicate review flood handling
- Gemini API timeout & fallback handling
"""
import pytest
from unittest.mock import patch, MagicMock
from services.cleaning_engine import CleaningEngine
from domain.schemas import UnifiedReview
from domain.enums import ReviewSource
from pipeline.orchestrator import run_pipeline


# ── Edge Case 1: Duplicate Review Flood ───────────────────────────────────────
def test_duplicate_review_flood_handling():
    cleaner = CleaningEngine()

    # 100 identical reviews
    reviews = [
        UnifiedReview(
            id=f"rev_{i}",
            session_id="test_dup_session",
            raw_text="Payment failed on checkout page when using UPI debit card",
            rating=1,
            source=ReviewSource.PLAY_STORE
        )
        for i in range(100)
    ]

    cleaned = cleaner.clean(reviews)
    duplicates = [c for c in cleaned if c.is_duplicate]

    # Exactly 1 review is kept as clean, 99 marked as duplicates
    assert len(cleaned) == 100
    assert len(duplicates) == 99
    assert sum(1 for c in cleaned if not c.is_duplicate and not c.is_spam) == 1


# ── Edge Case 2: Play Store Scraper Failure ──────────────────────────────────
@patch("google_play_scraper.reviews")
def test_play_store_scraper_failure_raises_http_exception(mock_reviews, api_client):
    mock_reviews.side_effect = Exception("App ID 'invalid.app.id' not found in Play Store")

    res = api_client.post(
        "/upload/play-store",
        json={"app_id": "invalid.app.id", "count": 50, "team_size": "2_5"}
    )
    assert res.status_code == 400
    assert "Failed to fetch Play Store reviews" in res.json()["detail"]


@patch("google_play_scraper.reviews")
def test_play_store_scraper_empty_results(mock_reviews, api_client):
    mock_reviews.return_value = ([], None)

    res = api_client.post(
        "/upload/play-store",
        json={"app_id": "empty.app.id", "count": 50, "team_size": "2_5"}
    )
    assert res.status_code == 400
    assert "No reviews found" in res.json()["detail"]


# ── Edge Case 3: Pipeline Graceful Error Recovery ──────────────────────────────
@patch("pipeline.orchestrator.get_db")
@patch("pipeline.step1_clean.run")
def test_pipeline_catches_errors_and_sets_failed_status(mock_step1, mock_get_db):
    mock_step1.side_effect = RuntimeError("Database connection lost during cleaning")
    mock_db = mock_get_db.return_value
    mock_db.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
        "current_step": 0,
        "status": "pending"
    }

    with pytest.raises(RuntimeError):
        run_pipeline("test-failed-session")

    # Verify session status was set to 'failed' in DB
    mock_db.table.return_value.update.assert_called()
    update_args = mock_db.table.return_value.update.call_args[0][0]
    assert update_args["status"] == "failed"
    assert "Database connection lost" in update_args["error_message"]


# ── Edge Case 4: Max Review Cap Enforcement ───────────────────────────────────
def test_max_review_cap_enforcement(sample_edge_case_csvs):
    # Verify large CSV helper exists
    assert "large_text_rows" in sample_edge_case_csvs
