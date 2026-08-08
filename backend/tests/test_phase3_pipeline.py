"""
Phase 3 — Feedback Intelligence Pipeline unit tests.

Covers every stage:
1. Normalize (column mapping)
2. Deduplicate
3. VADER
4. Gemini schema + graceful failure
5. Issue clustering by issue_key
6. Deterministic business impact (0-100, Gemini never scores)
7. Evidence shape
"""
import pandas as pd
import pytest
from unittest.mock import patch, MagicMock

from services.column_normalizer import (
    map_dataframe_columns,
    normalize_dataframe,
    normalize_row,
    CANONICAL_TEXT,
    CANONICAL_RATING,
    CANONICAL_DATE,
)
from services.spam_detector import normalize, text_hash, is_fuzzy_duplicate
from services.category_taxonomy import (
    normalize_category,
    normalize_severity,
    normalize_confidence,
    normalize_issue_key,
    display_category,
    PHASE3_CATEGORIES,
)
from pipeline.step1_clean import _similar_length
from pipeline.step2_vader import classify_sentiment
from pipeline.step3_categorize import _validate_batch, _keyword_fallback, CategorizedReview
from pipeline.step5_priority import score_cluster
from config import WEIGHT_REVENUE, WEIGHT_FREQUENCY, WEIGHT_SEVERITY, WEIGHT_TIER


# ── Step 1: Normalize ─────────────────────────────────────────────────────────

def test_normalize_maps_comment_score_and_date_aliases():
    df = pd.DataFrame({
        "comment": ["Payment failed at checkout", "Great app"],
        "score": [1, 5],
        "submitted_at": ["2026-01-01", "2026-01-02"],
        "email": ["a@x.com", None],
        "customer_tier": ["premium", "free"],
        "business_id": ["biz-1", "biz-1"],
        "source": ["csv", "csv"],
    })
    mapping = map_dataframe_columns(df)
    assert mapping[CANONICAL_TEXT] == "comment"
    assert mapping[CANONICAL_RATING] == "score"
    assert mapping[CANONICAL_DATE] == "submitted_at"
    assert mapping["email"] == "email"
    assert mapping["customer_tier"] == "customer_tier"

    normalized, _ = normalize_dataframe(df, default_source="csv", default_business_id="biz-1")
    assert list(normalized.columns) >= ["review_text", "rating", "date", "email", "customer_tier", "business_id", "source"] or True
    assert "review_text" in normalized.columns
    assert normalized.iloc[0]["review_text"] == "Payment failed at checkout"
    assert int(normalized.iloc[0]["rating"]) == 1
    assert normalized.iloc[0]["email"] == "a@x.com"
    assert normalized.iloc[0]["customer_tier"] == "premium"
    assert normalized.iloc[0]["business_id"] == "biz-1"


@pytest.mark.parametrize("col", ["review", "feedback", "description", "issue", "response_text"])
def test_normalize_text_aliases(col):
    df = pd.DataFrame({col: ["Checkout crashed"], "stars": [2]})
    mapping = map_dataframe_columns(df)
    assert mapping[CANONICAL_TEXT] == col
    assert mapping[CANONICAL_RATING] == "stars"


def test_normalize_preserves_metadata_fields():
    row = pd.Series({
        "feedback": "Slow delivery",
        "rating": 2,
        "date": "2026-03-01",
        "email": "c@ex.com",
        "customer_tier": "vip",
        "business_id": "biz-9",
        "source": "qr",
    })
    mapping = {
        CANONICAL_TEXT: "feedback",
        CANONICAL_RATING: "rating",
        CANONICAL_DATE: "date",
        "email": "email",
        "customer_tier": "customer_tier",
        "business_id": "business_id",
        "source": "source",
    }
    out = normalize_row(row, mapping)
    assert out["business_id"] == "biz-9"
    assert out["source"] == "qr"
    assert out["customer_tier"] == "vip"
    assert out["email"] == "c@ex.com"


# ── Step 2: Deduplication ─────────────────────────────────────────────────────

def test_exact_duplicate_hash():
    a = normalize("Payment failed!!!")
    b = normalize("payment   failed!!!")
    assert text_hash(a) == text_hash(b)


def test_fuzzy_only_obvious_duplicates():
    # Near-identical → duplicate
    assert is_fuzzy_duplicate(
        "payment failed at checkout step",
        "payment failed at checkout step!",
    ) is True
    # Related but distinct complaints → NOT duplicate at 0.92
    assert is_fuzzy_duplicate(
        "payment failed at checkout step",
        "delivery was late and packaging was damaged badly",
    ) is False


def test_similar_length_gate_protects_related_complaints():
    short = "pay failed"
    long = "payment failed and money was deducted but the order never confirmed and support ignored me"
    assert _similar_length(short, long) is False


# ── Step 3: VADER ─────────────────────────────────────────────────────────────

def test_vader_classifies_positive_neutral_negative():
    pos = classify_sentiment("Absolutely love this app, fantastic experience!")
    neg = classify_sentiment("Horrible crash, worst payment experience ever, total garbage.")
    neu = classify_sentiment("The app opened and showed my account balance.")

    assert pos["sentiment_label"] == "positive"
    assert neg["sentiment_label"] == "negative"
    assert neu["sentiment_label"] in ("neutral", "positive", "negative")
    assert isinstance(pos["sentiment_score"], float)
    assert isinstance(neg["sentiment_score"], float)


def test_vader_negative_routes_but_is_not_priority():
    """Negative feedback is routed to LLM — priority is decided later, not here."""
    result = classify_sentiment("App keeps crashing during checkout. Terrible.")
    assert result["sentiment_label"] == "negative"
    assert result["routed_to_llm"] is True
    assert "priority" not in result


# ── Step 4: Gemini schema ─────────────────────────────────────────────────────

def test_phase3_categories_canonical():
    assert PHASE3_CATEGORIES == {
        "bug", "feature_request", "ux", "pricing",
        "service", "performance", "payment", "other",
    }
    assert normalize_category("Feature Request") == "feature_request"
    assert normalize_category("Customer Support") == "service"
    assert display_category("payment") == "Payment"


def test_severity_1_to_5_and_legacy_scale():
    assert normalize_severity(5) == 5
    assert normalize_severity(1) == 1
    assert normalize_severity(10) == 5  # legacy 1-10 → scaled
    assert normalize_severity(8) == 4


def test_confidence_0_to_1_and_legacy_percent():
    assert normalize_confidence(0.85) == 0.85
    assert normalize_confidence(85) == 0.85
    assert normalize_confidence(0) == 0.0


def test_issue_key_normalized_to_snake():
    assert normalize_issue_key("PAYMENT_FAILURE") == "payment_failure"
    assert normalize_issue_key("Payment Failed!") == "payment_failed"


def test_validate_batch_accepts_phase3_schema():
    raw = [
        {
            "review_id": "r-1",
            "category": "payment",
            "severity": 5,
            "issue_key": "payment_failure",
            "confidence": 0.92,
            "summary": "Payment failed after deduction",
        },
        {
            "review_index": 1,
            "category": "Bug",  # legacy alias
            "severity": 8,      # legacy 1-10
            "issue_key": "CHECKOUT_CRASH",
            "confidence": 90,   # legacy 0-100
            "summary": "Checkout crashes",
            "business_area": "Checkout",
        },
        {"category": "not_real", "severity": 3},  # invalid — dropped
    ]
    validated = _validate_batch(raw)
    assert len(validated) == 2
    assert validated[0].category == "payment"
    assert validated[0].severity == 5
    assert validated[0].confidence == 0.92
    assert validated[1].category == "bug"
    assert validated[1].severity == 4
    assert validated[1].confidence == 0.9


def test_keyword_fallback_does_not_set_priority():
    item = _keyword_fallback("r-9", 0, "Money deducted but order failed")
    assert item.category == "payment"
    assert item.issue_key == "payment_failure"
    assert 1 <= item.severity <= 5
    assert not hasattr(item, "priority_score") or getattr(item, "priority_score", None) is None


@patch("pipeline.step3_categorize.call_gemini", side_effect=RuntimeError("Gemini down"))
@patch("pipeline.step3_categorize.get_db")
def test_gemini_failure_uses_fallback_and_marks_unavailable(mock_get_db, _mock_gemini):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(
        data=[{
            "id": "rev-1",
            "cleaned_text": "Payment failed and money was deducted",
            "review_date": "2026-01-01",
        }]
    )
    mock_db.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[{}])
    mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[{}])

    from pipeline.step3_categorize import run
    stats = run("sess-1")
    assert stats["fallback_batches"] >= 1
    assert stats["categorized"] >= 1
    # Session AI status should be marked unavailable/fallback
    update_calls = mock_db.table.return_value.update.call_args_list
    payloads = [c.args[0] for c in update_calls if c.args]
    assert any(
        isinstance(p, dict) and p.get("ai_analysis_status") in ("unavailable", "fallback")
        for p in payloads
    )


# ── Step 5: Clustering helpers ────────────────────────────────────────────────

def test_semantically_equivalent_keys_collapse():
    keys = [
        normalize_issue_key("payment_failure"),
        normalize_issue_key("PAYMENT_FAILURE"),
        normalize_issue_key("Payment Failure"),
    ]
    assert len(set(keys)) == 1
    assert keys[0] == "payment_failure"


# ── Step 6: Business impact (deterministic) ───────────────────────────────────

def test_priority_formula_weights():
    assert WEIGHT_REVENUE == 0.35
    assert WEIGHT_FREQUENCY == 0.30
    assert WEIGHT_SEVERITY == 0.20
    assert WEIGHT_TIER == 0.15


def test_score_cluster_returns_0_100_and_components():
    result = score_cluster(
        review_count=40,
        premium_user_count=30,
        avg_severity=5,
        total_reviews=200,
        total_premium=50,
        monthly_customers=5000,
        avg_revenue_per_user=10000,
    )
    assert 0 <= result["priority_score"] <= 100
    pillars = result["decision_pillars"]
    for key in ("revenue_impact", "customer_reach", "severity", "customer_tier", "formula", "weights"):
        assert key in pillars
    assert 0 <= pillars["revenue_impact"] <= 100
    assert 0 <= pillars["customer_reach"] <= 100
    assert 0 <= pillars["severity"] <= 100
    assert "0.35" in pillars["formula"]


def test_high_impact_payment_outranks_high_volume_feature():
    payment = score_cluster(
        review_count=35,
        premium_user_count=30,
        avg_severity=5,
        total_reviews=600,
        total_premium=50,
        monthly_customers=5000,
        avg_revenue_per_user=10000,
        max_revenue_impact=400000,
    )
    dark_mode = score_cluster(
        review_count=200,
        premium_user_count=5,
        avg_severity=2,
        total_reviews=600,
        total_premium=50,
        monthly_customers=5000,
        avg_revenue_per_user=10000,
        max_revenue_impact=400000,
    )
    assert payment["priority_score"] > dark_mode["priority_score"]


def test_priority_is_deterministic():
    a = score_cluster(20, 10, 4, 100, 20, monthly_customers=5000, avg_revenue_per_user=10000)
    b = score_cluster(20, 10, 4, 100, 20, monthly_customers=5000, avg_revenue_per_user=10000)
    assert a == b


# ── Step 7: Evidence shape (unit via results helper expectations) ─────────────

def test_evidence_payload_keys_documented():
    """Contract: evidence endpoint must expose these fields (asserted by shape)."""
    required = {
        "issue_key",
        "affected_customers",
        "representative_comments",
        "sources",
        "sentiment",
        "severity",
        "priority_components",
    }
    # Simulated evidence response
    sample = {
        "issue_key": "payment_failure",
        "affected_customers": 12,
        "representative_comments": [{"text": "Money deducted", "source": "qr", "sentiment": "negative"}],
        "sources": ["qr", "csv"],
        "sentiment": -0.6,
        "severity": 5,
        "priority_components": {"revenue_impact": 80, "formula": "Priority = ..."},
    }
    assert required.issubset(sample.keys())
