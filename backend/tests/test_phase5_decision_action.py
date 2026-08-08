"""
Phase 5 — Decision-to-Action: roadmap, sprint, AI PM briefing.
"""
from services.decision_outputs import (
    EFFORT_ESTIMATE_NOTE,
    build_ai_pm_briefing,
    build_decision_outputs,
    build_roadmap_items,
    build_sprint_plan,
)
from pipeline.step7_roadmap import _merge_gemini
from pipeline.step8_meeting import _fallback_reply


def _sample_clusters():
    return [
        {
            "issue_key": "payment_failures",
            "category": "payment",
            "description": "Checkout fails on UPI retries",
            "review_count": 42,
            "avg_severity": 4.5,
            "priority_rank": 1,
            "priority_score": 82,
            "revenue_at_risk": 120000,
            "premium_user_count": 8,
            "decision_pillars": {
                "customer_reach": 78,
                "severity": 90,
                "revenue_impact": 85,
                "customer_tier": 40,
            },
        },
        {
            "issue_key": "slow_search",
            "category": "performance",
            "description": "Search latency on catalog",
            "review_count": 18,
            "avg_severity": 3.2,
            "priority_rank": 2,
            "priority_score": 55,
            "revenue_at_risk": 25000,
            "premium_user_count": 2,
            "decision_pillars": {
                "customer_reach": 40,
                "severity": 50,
                "revenue_impact": 35,
                "customer_tier": 20,
            },
        },
    ]


def test_roadmap_items_have_required_fields():
    items = build_roadmap_items(_sample_clusters())
    assert len(items) == 2
    top = items[0]
    assert top["issue"] == "Payment Failures"
    assert top["priority"] == "Critical"
    assert "recommended_action" in top
    assert "expected_business_outcome" in top
    assert "suggested_timeframe" in top
    assert top["priority_score"] == 82.0
    assert "120,000" in top["expected_business_outcome"] or "120000" in top["expected_business_outcome"].replace(",", "")


def test_sprint_effort_clearly_estimated():
    sprint = build_sprint_plan(_sample_clusters())
    assert sprint["effort_disclaimer"] == EFFORT_ESTIMATE_NOTE
    assert "estimate" in EFFORT_ESTIMATE_NOTE.lower()
    story = sprint["stories"][0]
    assert story["user_story"]
    assert story["acceptance_criteria"]
    assert story["priority"]
    assert story["effort_is_estimate"] is True
    assert "estimate" in story["effort_estimate"].lower()
    assert story["story_points"] > 0
    assert "estimate" in (story.get("story_points_note") or "").lower()


def test_ai_pm_briefing_uses_analysis_metrics():
    briefing = build_ai_pm_briefing(_sample_clusters(), total_reviews=200)
    assert briefing["issue"] == "Payment Failures"
    assert "42" in briefing["why_it_matters"]
    assert "82" in briefing["why_prioritized"] or "82/100" in briefing["why_prioritized"]
    assert "Revenue" in briefing["why_prioritized"] or "reach" in briefing["why_prioritized"].lower()
    assert briefing["if_ignored"]
    assert briefing["recommended_next_action"]
    metrics = briefing["metrics"]
    assert metrics["priority_score"] == 82.0
    assert metrics["customer_reach"] == 78
    assert metrics["severity"] == 4.5
    assert metrics["revenue_at_risk"] == 120000
    assert metrics["total_reviews_analysed"] == 200


def test_build_decision_outputs_bundle():
    out = build_decision_outputs(_sample_clusters(), total_reviews=200)
    assert out["roadmap"]["items"]
    assert len(out["roadmap"]["weeks"]) == 6
    assert out["sprint"]["stories"]
    assert out["ai_pm_briefing"]["issue"]


def test_merge_gemini_preserves_priority_order():
    baseline = build_decision_outputs(_sample_clusters())
    gemini = {
        "roadmap_items": [
            {
                "issue_key": "slow_search",
                "recommended_action": "Should not jump to #1",
            },
            {
                "issue_key": "payment_failures",
                "recommended_action": "Stabilize UPI retries this sprint",
                "expected_business_outcome": "Recover checkout revenue",
                "suggested_timeframe": "Week 1",
            },
        ],
        "sprint": {
            "stories": [
                {
                    "id": "S1-001",
                    "title": "Fix payments",
                    "user_story": "As a buyer…",
                    "acceptance_criteria": ["Works on UPI"],
                    "effort": "M",
                    "story_points": 5,
                    "priority": "Critical",
                    "linked_issue": "payment_failures",
                }
            ]
        },
    }
    merged = _merge_gemini(baseline, gemini)
    assert merged["roadmap"]["items"][0]["issue_key"] == "payment_failures"
    assert "UPI" in merged["roadmap"]["items"][0]["recommended_action"]
    assert merged["sprint"]["stories"][0]["effort_is_estimate"] is True
    assert "estimate" in merged["sprint"]["effort_disclaimer"].lower()


def test_ai_pm_fallback_is_product_focused():
    briefing = build_ai_pm_briefing(_sample_clusters(), total_reviews=200)
    clusters = _sample_clusters()
    reply = _fallback_reply("Why was this prioritized?", briefing, clusters)
    assert "82" in reply or "rank" in reply.lower() or "priority" in reply.lower()
    ignored = _fallback_reply("What happens if we ignore it?", briefing, clusters)
    assert ignored == briefing["if_ignored"]
