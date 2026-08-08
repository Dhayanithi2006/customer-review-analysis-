"""
Unit Tests — Core Engines & Services
- PII Stripper
- Spam & Duplicate Detector
- Cleaning Engine
- VADER Sentiment Analyzer
- Priority Calculation Engine
"""
import pytest
from services.pii_stripper import strip_pii
from services.spam_detector import is_spam, text_hash, is_fuzzy_duplicate, normalize
from services.vader_service import VaderService
from services.priority_engine import DecisionIntelligenceEngine
from domain.schemas import IssueCluster


# ── Unit Test 1: PII Stripper ─────────────────────────────────────────────────
def test_pii_stripper_masks_sensitive_data():
    raw = "My email is john.doe@acme.com and phone is 555-867-5309, SSN 123-45-6789."
    cleaned = strip_pii(raw)
    assert "john.doe@acme.com" not in cleaned
    assert "555-867-5309" not in cleaned
    assert "123-45-6789" not in cleaned


def test_pii_stripper_leaves_clean_feedback():
    raw = "Checkout button crashes on Android 14."
    assert strip_pii(raw) == raw


# ── Unit Test 2: Spam & Duplicate Detection ───────────────────────────────────
def test_spam_detection_short_or_repetitive_text():
    assert is_spam("k") is True
    assert is_spam("good app") is True  # under SPAM_MIN_CHARS
    assert is_spam("!!!!!???? $$$$#####") is True  # excessive special chars
    assert is_spam("The payment page keeps hanging when clicking submit order") is False


def test_exact_hash_deduplication():
    t1 = "Checkout button crashes when tapped"
    t2 = "  checkout button crashes when tapped "
    assert text_hash(normalize(t1)) == text_hash(normalize(t2))


def test_fuzzy_duplicate_detection():
    t1 = "Checkout button crashes on pixel 8"
    t2 = "Checkout button crashes on pixel 8 pro"
    assert is_fuzzy_duplicate(normalize(t1), normalize(t2)) is True

    t3 = "Dark mode color contrast is too low"
    assert is_fuzzy_duplicate(normalize(t1), normalize(t3)) is False


# ── Unit Test 3: VADER Sentiment Service ──────────────────────────────────────
def test_vader_sentiment_routing():
    vader = VaderService()

    # Highly negative feedback -> route to LLM
    score, label, routed = vader.analyze_sentiment("App is completely broken, checkout fails every time!", rating=1)
    assert score < 0
    assert routed is True

    # Low rating neutral feedback -> route to LLM
    score, label, routed = vader.analyze_sentiment("Search bar does not filter results properly", rating=2)
    assert routed is True

    # Generic positive praise -> filter out (do not route to LLM)
    score, label, routed = vader.analyze_sentiment("Great app love it so much five stars!", rating=5)
    assert routed is False


# ── Unit Test 4: Priority Engine Pure Math ────────────────────────────────────
def test_priority_engine_formula_calculation():
    engine = DecisionIntelligenceEngine()

    clusters = [
        IssueCluster(
            session_id="test-session",
            issue_key="CHECKOUT_CRASH",
            category="Bug",
            business_area="Checkout",
            description="Checkout button crashes",
            review_count=50,
            avg_severity=9.0,
            premium_user_count=20,
            avg_sentiment=-0.8,
            sample_reviews=["crashes on checkout"]
        ),
        IssueCluster(
            session_id="test-session",
            issue_key="DARK_MODE_CONTRAST",
            category="UX",
            business_area="UI",
            description="Low contrast in dark mode",
            review_count=10,
            avg_severity=3.0,
            premium_user_count=2,
            avg_sentiment=-0.2,
            sample_reviews=["hard to read text"]
        ),
    ]

    result = engine.calculate_priorities(
        "test-session",
        clusters,
        total_reviews=100,
        monthly_customers=5000,
        avg_revenue_per_user=500,
        business_premium_pct=20,
    )

    assert len(result.ranked_clusters) == 2
    top = result.ranked_clusters[0]

    # Highest impact issue must be #1
    assert top.issue_key == "CHECKOUT_CRASH"
    assert top.priority_rank == 1
    assert top.priority_score > result.ranked_clusters[1].priority_score
    # estimated = affected × ARPU × severity_factor(5→1.0) = 50 × 500 × 1.0
    assert top.revenue_at_risk == 50 * 500 * 1.0
    assert result.total_revenue_at_risk == (50 * 500 * 1.0) + (10 * 500 * 0.40)
