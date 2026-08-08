"""
Revenue Impact + Priority formula tests (Decision Center phase).

Covers: revenue calc, reach, severity factors, tier, ranking,
Payment Failure > Dark Mode, sentiment≠auto top, dedupe-friendly affected,
missing/zero assumptions, empty/one/multi issues.
"""
from services.revenue_impact import (
    SEVERITY_RISK_FACTORS,
    severity_risk_factor,
    customer_reach_percentage,
    estimated_revenue_impact,
    score_issue,
    score_clusters,
    decision_center_kpis,
    build_fix_first_why,
)
from pipeline.step5_priority import score_cluster
from config import WEIGHT_REVENUE, WEIGHT_FREQUENCY, WEIGHT_SEVERITY, WEIGHT_TIER


# ── Formula primitives ────────────────────────────────────────────────────────

def test_severity_risk_factors():
    assert SEVERITY_RISK_FACTORS[1] == 0.10
    assert SEVERITY_RISK_FACTORS[2] == 0.20
    assert SEVERITY_RISK_FACTORS[3] == 0.40
    assert SEVERITY_RISK_FACTORS[4] == 0.70
    assert SEVERITY_RISK_FACTORS[5] == 1.00
    assert severity_risk_factor(5) == 1.0
    assert severity_risk_factor(2.2) == 0.20
    assert severity_risk_factor(4.6) == 1.0  # rounds to 5


def test_customer_reach_percentage():
    assert customer_reach_percentage(50, 5000) == 1.0
    assert customer_reach_percentage(5000, 5000) == 100.0
    assert customer_reach_percentage(6000, 5000) == 100.0  # capped
    assert customer_reach_percentage(10, 0) == 0.0
    assert customer_reach_percentage(10, None) == 0.0


def test_estimated_revenue_impact_formula():
    # FreshMart: 35 affected × ₹10k ARPU × sev5 factor 1.0
    assert estimated_revenue_impact(35, 10000, 5) == 350000.0
    # Dark mode-ish: 200 × 10k × 0.20
    assert estimated_revenue_impact(200, 10000, 2) == 400000.0
    assert estimated_revenue_impact(10, 0, 5) == 0.0
    assert estimated_revenue_impact(0, 10000, 5) == 0.0


def test_priority_weights():
    assert WEIGHT_REVENUE == 0.35
    assert WEIGHT_FREQUENCY == 0.30
    assert WEIGHT_SEVERITY == 0.20
    assert WEIGHT_TIER == 0.15


# ── Score cluster / issue ─────────────────────────────────────────────────────

def test_score_cluster_returns_pillars_0_100():
    result = score_cluster(
        review_count=35,
        premium_user_count=28,
        avg_severity=5,
        total_reviews=200,
        total_premium=40,
        monthly_customers=5000,
        avg_revenue_per_user=10000,
    )
    assert 0 <= result["priority_score"] <= 100
    pillars = result["decision_pillars"]
    for key in (
        "revenue_impact",
        "customer_reach",
        "severity",
        "customer_tier",
        "premium_users",
        "formula",
        "estimated_revenue_impact",
        "affected_customers",
        "customer_reach_percentage",
    ):
        assert key in pillars
    assert pillars["estimated_revenue_impact"] == 350000.0
    assert pillars["affected_customers"] == 35
    assert pillars["customer_reach_percentage"] == 0.7


def test_payment_failure_outranks_dark_mode_freshmart():
    """Mandatory: fewer high-severity payment issues beat high-volume dark mode."""
    payment = score_issue(
        affected_customers=35,
        avg_severity=5,
        premium_user_count=30,
        monthly_customers=5000,
        avg_revenue_per_user=10000,
        business_premium_pct=25,
        max_revenue_impact=400000,
        total_reviews=600,
        total_premium=50,
    )
    dark = score_issue(
        affected_customers=200,
        avg_severity=2,
        premium_user_count=5,
        monthly_customers=5000,
        avg_revenue_per_user=10000,
        business_premium_pct=25,
        max_revenue_impact=400000,
        total_reviews=600,
        total_premium=50,
    )
    assert payment["estimated_revenue_impact"] == 350000.0
    assert dark["estimated_revenue_impact"] == 400000.0
    # Dark has slightly higher absolute revenue estimate, but Payment wins priority
    assert payment["priority_score"] > dark["priority_score"]


def test_checkout_between_payment_and_dark_mode():
    ranked = score_clusters(
        [
            {
                "issue_key": "payment_failure",
                "review_count": 35,
                "avg_severity": 5,
                "premium_user_count": 30,
            },
            {
                "issue_key": "checkout_waiting",
                "review_count": 55,
                "avg_severity": 3.5,
                "premium_user_count": 18,
            },
            {
                "issue_key": "dark_mode",
                "review_count": 200,
                "avg_severity": 2,
                "premium_user_count": 5,
            },
        ],
        monthly_customers=5000,
        avg_revenue_per_user=10000,
        business_premium_pct=25,
    )
    keys = [c["issue_key"] for c in ranked]
    assert keys[0] == "payment_failure"
    assert keys.index("checkout_waiting") < keys.index("dark_mode")


def test_high_volume_negative_sentiment_does_not_auto_win():
    """Severity/revenue matter more than raw volume (sentiment proxy via volume)."""
    ranked = score_clusters(
        [
            {
                "issue_key": "dark_mode",
                "review_count": 500,
                "avg_severity": 1.5,
                "premium_user_count": 10,
            },
            {
                "issue_key": "payment_failure",
                "review_count": 20,
                "avg_severity": 5,
                "premium_user_count": 18,
            },
        ],
        monthly_customers=5000,
        avg_revenue_per_user=10000,
        business_premium_pct=30,
    )
    assert ranked[0]["issue_key"] == "payment_failure"


def test_missing_and_zero_assumptions_graceful():
    zero = score_issue(
        affected_customers=40,
        avg_severity=5,
        premium_user_count=10,
        monthly_customers=0,
        avg_revenue_per_user=0,
        total_reviews=100,
        total_premium=20,
    )
    assert zero["estimated_revenue_impact"] >= 0
    assert zero["customer_reach_percentage"] == 0
    assert 0 <= zero["priority_score"] <= 100

    missing = score_issue(
        affected_customers=40,
        avg_severity=4,
        premium_user_count=10,
        monthly_customers=None,
        avg_revenue_per_user=None,
        total_reviews=100,
        total_premium=20,
    )
    assert 0 <= missing["priority_score"] <= 100


def test_empty_one_multi_clusters():
    assert score_clusters([]) == []

    one = score_clusters(
        [{"issue_key": "only", "review_count": 12, "avg_severity": 4, "premium_user_count": 4}],
        monthly_customers=5000,
        avg_revenue_per_user=10000,
    )
    assert len(one) == 1
    assert one[0]["priority_rank"] == 1

    multi = score_clusters(
        [
            {"issue_key": "a", "review_count": 10, "avg_severity": 5, "premium_user_count": 8},
            {"issue_key": "b", "review_count": 30, "avg_severity": 2, "premium_user_count": 2},
            {"issue_key": "c", "review_count": 15, "avg_severity": 3, "premium_user_count": 5},
        ],
        monthly_customers=5000,
        avg_revenue_per_user=10000,
    )
    assert len(multi) == 3
    assert multi[0]["priority_score"] >= multi[1]["priority_score"] >= multi[2]["priority_score"]
    ranks = [m["priority_rank"] for m in multi]
    assert ranks == [1, 2, 3]


def test_decision_center_kpis_and_why():
    ranked = score_clusters(
        [
            {
                "issue_key": "payment_failure",
                "review_count": 35,
                "avg_severity": 5,
                "premium_user_count": 30,
            },
            {
                "issue_key": "dark_mode",
                "review_count": 200,
                "avg_severity": 2,
                "premium_user_count": 5,
            },
        ],
        monthly_customers=5000,
        avg_revenue_per_user=10000,
    )
    kpis = decision_center_kpis(ranked)
    assert kpis["total_estimated_revenue_impact"] > 0
    assert kpis["customers_affected"] > 0
    assert kpis["critical_issue_count"] >= 1
    why = build_fix_first_why(ranked[0], "INR")
    assert "estimated revenue" in why.lower() or "₹" in why
    assert "complaint volume" in why.lower() or "business impact" in why.lower()


def test_example_calculation_documented():
    """
    Example (FreshMart): monthly_customers=5000, ARPU=₹10,000
    Payment Failure: affected=35, severity=5
      reach = 35/5000*100 = 0.7%
      est_rev = 35 × 10000 × 1.00 = ₹350,000
    """
    est = estimated_revenue_impact(35, 10000, 5)
    reach = customer_reach_percentage(35, 5000)
    assert est == 350_000
    assert abs(reach - 0.7) < 1e-9
    result = score_issue(
        affected_customers=35,
        avg_severity=5,
        premium_user_count=30,
        monthly_customers=5000,
        avg_revenue_per_user=10000,
        max_revenue_impact=350000,
    )
    assert result["estimated_revenue_impact"] == 350000
    assert abs(result["decision_pillars"]["severity"] - 100.0) < 0.01


def test_priority_is_deterministic():
    a = score_issue(
        affected_customers=20,
        avg_severity=4,
        premium_user_count=10,
        monthly_customers=5000,
        avg_revenue_per_user=10000,
        max_revenue_impact=100000,
        total_reviews=100,
        total_premium=20,
    )
    b = score_issue(
        affected_customers=20,
        avg_severity=4,
        premium_user_count=10,
        monthly_customers=5000,
        avg_revenue_per_user=10000,
        max_revenue_impact=100000,
        total_reviews=100,
        total_premium=20,
    )
    assert a == b
