"""
Phase C4 / Phase 3 — Priority pillars + score cluster unit tests.
Ensures decision pillars are backend-computed (never AI) and Payment-like
high-impact issues can outrank high-volume low-impact issues.
Scores are on a 0–100 scale; severity scale is 1–5.
"""
from pipeline.step5_priority import score_cluster
from services.revenue_impact import score_issue


def test_score_cluster_returns_decision_pillars():
    result = score_cluster(
        review_count=35,
        premium_user_count=28,
        avg_severity=5,
        total_reviews=200,
        total_premium=40,
        monthly_customers=5000,
        avg_revenue_per_user=10000,
    )
    assert "priority_score" in result
    assert 0 <= result["priority_score"] <= 100
    assert "decision_pillars" in result
    pillars = result["decision_pillars"]
    for key in (
        "revenue_impact",
        "customer_reach",
        "severity",
        "premium_users",
        "revenue_pct",
        "reach_pct",
        "severity_pct",
        "premium_pct",
        "formula",
    ):
        assert key in pillars
    pct_sum = (
        pillars["revenue_pct"]
        + pillars["reach_pct"]
        + pillars["severity_pct"]
        + pillars["premium_pct"]
    )
    assert 95 <= pct_sum <= 105


def test_high_impact_outranks_high_volume_feature():
    """Payment-failure style cluster beats dark-mode volume when impact is higher."""
    payment = score_issue(
        affected_customers=35,
        premium_user_count=30,
        avg_severity=5,
        monthly_customers=5000,
        avg_revenue_per_user=10000,
        max_revenue_impact=400000,
        total_reviews=600,
        total_premium=50,
    )
    dark_mode = score_issue(
        affected_customers=200,
        premium_user_count=5,
        avg_severity=2,
        monthly_customers=5000,
        avg_revenue_per_user=10000,
        max_revenue_impact=400000,
        total_reviews=600,
        total_premium=50,
    )
    assert payment["priority_score"] > dark_mode["priority_score"]
