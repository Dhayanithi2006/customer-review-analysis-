"""
Step 5 — Priority Engine (Decision Intelligence Engine)
Calculates deterministic priority score for every issue cluster.
Pure backend formula — zero AI. Gemini NEVER sets this score.

Formula (components normalized 0–100):
Priority =
  Revenue Impact × 0.35
+ Customer Reach × 0.30
+ Severity × 0.20
+ Customer Tier × 0.15

Revenue impact (estimated, not actual lost):
  affected × ARPU × severity_risk_factor

Stores individual components so the UI can show the calculation.
Negative sentiment alone does NOT auto-rank an issue highest.
"""
from database import get_db
from services.revenue_impact import (
    load_business_assumptions,
    score_clusters,
    score_issue,
    unique_affected_for_cluster,
)


# Re-export for tests / dashboard fallback that import score_cluster from here
def score_cluster(
    review_count: int,
    premium_user_count: int,
    avg_severity: float,
    total_reviews: int,
    total_premium: int,
    *,
    monthly_customers: int | None = None,
    avg_revenue_per_user: float | None = None,
    business_premium_pct: float | None = None,
    max_revenue_impact: float | None = None,
    affected_customers: int | None = None,
) -> dict:
    """
    Shared scoring used by the pipeline and dashboard fallback.
    Returns priority_score on a 0–100 scale.
    """
    return score_issue(
        affected_customers=affected_customers if affected_customers is not None else review_count,
        avg_severity=avg_severity,
        premium_user_count=premium_user_count,
        monthly_customers=monthly_customers,
        avg_revenue_per_user=avg_revenue_per_user,
        business_premium_pct=business_premium_pct,
        max_revenue_impact=max_revenue_impact,
        total_reviews=total_reviews,
        total_premium=total_premium,
    )


def run(session_id: str) -> dict:
    db = get_db()

    clusters = (
        db.table("issue_clusters")
        .select("id,issue_key,review_count,avg_severity,premium_user_count,avg_sentiment")
        .eq("session_id", session_id)
        .execute()
        .data
    )

    clusters_list = [dict(c) for c in clusters if isinstance(c, dict)] if isinstance(clusters, list) else []
    if not clusters_list:
        return {"ranked": 0}

    assumptions = load_business_assumptions(db, session_id)

    # Deduplicate observed customers per cluster when possible
    enriched = []
    for c in clusters_list:
        affected = unique_affected_for_cluster(
            db,
            session_id,
            str(c.get("issue_key") or ""),
            int(c.get("review_count") or 0),
        )
        enriched.append({**c, "affected_customers": affected})

    scored = score_clusters(
        enriched,
        monthly_customers=assumptions.get("monthly_customers"),
        avg_revenue_per_user=assumptions.get("avg_revenue_per_user"),
        business_premium_pct=(
            float(assumptions["premium_pct"])
            if assumptions.get("premium_pct") is not None
            else None
        ),
    )

    for item in scored:
        update_row = {
            "priority_score": item["priority_score"],
            "priority_rank": item["priority_rank"],
            "revenue_at_risk": item["revenue_at_risk"],
            "decision_pillars": item["decision_pillars"],
        }
        try:
            db.table("issue_clusters").update(update_row).eq("id", item["id"]).execute()
        except Exception:
            db.table("issue_clusters").update({
                "priority_score": item["priority_score"],
                "priority_rank": item["priority_rank"],
                "revenue_at_risk": item["revenue_at_risk"],
            }).eq("id", item["id"]).execute()

    return {"ranked": len(scored)}
