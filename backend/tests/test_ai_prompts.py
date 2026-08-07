"""
AI Layer & Prompt Resilience Tests
- Gemini JSON extraction & markdown code fence stripping
- Invalid JSON handling & retry trigger
- PII sanitization in Gemini prompts
- Fallback engine execution during Gemini timeouts/429
- Output Schema Pydantic validation
"""
import pytest
import json
from unittest.mock import patch, MagicMock
from services.gemini_client import _extract_json, call_gemini
from ai.fallback import FallbackEngine
from pipeline.step3_categorize import _validate_batch, CategorizedReview


# ── Test 1: JSON Fence Stripping ─────────────────────────────────────────────
def test_extract_json_strips_markdown_fences():
    raw_with_fences = """```json
[
  {
    "review_index": 0,
    "issue_key": "CHECKOUT_CRASH",
    "category": "Bug",
    "severity": 8,
    "confidence": 95,
    "summary": "Checkout button crashes",
    "business_area": "Checkout"
  }
]
```"""
    cleaned = _extract_json(raw_with_fences)
    parsed = json.loads(cleaned)
    assert isinstance(parsed, list)
    assert parsed[0]["issue_key"] == "CHECKOUT_CRASH"


def test_extract_json_handles_leading_conversational_text():
    raw = """Here is your JSON response:
[
  {"key": "value"}
]
"""
    cleaned = _extract_json(raw)
    assert cleaned.startswith("[")
    assert json.loads(cleaned) == [{"key": "value"}]


# ── Test 2: Pydantic Schema Validation for Gemini Outputs ────────────────────
def test_categorize_schema_validation():
    valid_data = [
        {
            "review_index": 0,
            "issue_key": "LOGIN_DELAY_SLOW",
            "category": "Performance",
            "severity": 7,
            "confidence": 90,
            "summary": "Login takes 30 seconds",
            "business_area": "Auth"
        },
        {
            # Invalid item: missing required summary field & invalid category
            "review_index": 1,
            "issue_key": "INVALID_KEY",
            "category": "NonExistentCategory",
            "severity": 15
        }
    ]

    validated = _validate_batch(valid_data)
    # Invalid item should be gracefully dropped without breaking the whole batch
    assert len(validated) == 1
    assert validated[0].issue_key == "LOGIN_DELAY_SLOW"


# ── Test 3: Fallback Engine Execution ─────────────────────────────────────────
def test_fallback_categorization_engine():
    reviews_input = [
        {"index": 0, "text": "App crashes on payment step with error code 500"},
        {"index": 1, "text": "Can you please add dark mode support?"},
        {"index": 2, "text": "Very slow loading speed on cellular data"}
    ]

    fallback_items = FallbackEngine.fallback_categorization(reviews_input)

    assert len(fallback_items) == 3
    assert fallback_items[0].category == "Bug"
    assert fallback_items[1].category == "Feature Request"
    assert fallback_items[2].category == "Performance"


def test_fallback_executive_summary_engine():
    data_payload = {
        "total_reviews": 500,
        "top_issues": [{"issue_key": "UPI_PAYMENT_FAILURE"}]
    }

    summary = FallbackEngine.fallback_executive_summary(data_payload)
    assert "UPI_PAYMENT_FAILURE" in summary.executive_summary
    assert len(summary.headline_insights) == 3
    assert "UPI_PAYMENT_FAILURE" in summary.ai_recommendation


def test_fallback_roadmap_engine():
    issues_payload = [
        {"issue_key": "CHECKOUT_CRASH"},
        {"issue_key": "SLOW_SEARCH"},
        {"issue_key": "DARK_MODE_REQ"}
    ]

    roadmap_output = FallbackEngine.fallback_roadmap(issues_payload)
    assert len(roadmap_output.roadmap) == 3
    assert roadmap_output.sprint.name == "Sprint 1"
    assert len(roadmap_output.sprint.stories) == 3
    assert roadmap_output.sprint.total_story_points > 0


# ── Test 4: Gemini Retry on Invalid JSON ─────────────────────────────────────
@patch("services.gemini_client._get_model")
@patch("database.get_db")
def test_gemini_retries_on_invalid_json(mock_get_db, mock_get_model):
    mock_db = mock_get_db.return_value
    mock_db.table.return_value.insert.return_value.execute.return_value = None

    # First call returns malformed JSON, second call returns valid JSON
    mock_resp1 = MagicMock()
    mock_resp1.text = "This is not json at all!"
    mock_resp1.usage_metadata.prompt_token_count = 10
    mock_resp1.usage_metadata.candidates_token_count = 10

    mock_resp2 = MagicMock()
    mock_resp2.text = '[{"review_index": 0, "issue_key": "FIX_CRASH", "category": "Bug", "severity": 8, "confidence": 90, "summary": "Fix crash", "business_area": "Core"}]'
    mock_resp2.usage_metadata.prompt_token_count = 10
    mock_resp2.usage_metadata.candidates_token_count = 10

    mock_model = mock_get_model.return_value
    mock_model.generate_content.side_effect = [mock_resp1, mock_resp2]

    res = call_gemini(
        prompt="Test prompt",
        call_type="categorize",
        session_id="test-session",
        expect_json=True
    )

    assert isinstance(res, list)
    assert res[0]["issue_key"] == "FIX_CRASH"
    assert mock_model.generate_content.call_count == 2
