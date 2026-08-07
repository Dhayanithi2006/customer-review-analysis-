"""
Step 5 — Priority Engine
Calculates priority score for every issue cluster.
Pure backend formula — zero AI.

Priority = Revenue×0.30 + Frequency×0.25 + Severity×0.20 + Tier×0.15 + Recency×0.10
"""
from datetime import date, datetime
from database import get_db
from config import (
    WEIGHT_REVENUE, WEIGHT_FREQUENCY, WEIGHT_SEVERITY,
    WEIGHT_TIER, WEIGHT_RECENCY, AVG_REVENUE_PER_USER,
)


def _recency_norm(latest_date_str: str | None) -> float:
    """Returns 1.0 for today, decays to 0 over 90 days."""
    if not latest_date_str:
        return 0.5  # Unknown date → neutral recency
    try:
        if isinstance(latest_date_str, str):
            latest = datetime.fromisoformat(latest_date_str[:10]).date()
        else:
            latest = latest_date_str
        days_ago = (date.today() - latest).days
        return max(0.0, 1.0 - days_ago / 90.0)
    except Exception:
        return 0.5


def run(session_id: str) -> dict:
    db = get_db()

    clusters = (
        db.table("issue_clusters")
        .select("id,issue_key,review_count,avg_severity,premium_user_count,avg_sentiment")
        .eq("session_id", session_id)
        .execute()
        .data
    )

    if not clusters:
        return {"ranked": 0}

    total_reviews = sum(c["review_count"] for c in clusters)
    total_premium = sum(c["premium_user_count"] for c in clusters)
    max_count     = max(c["review_count"] for c in clusters)

    # Fetch latest review date per cluster for recency
    # (Use the categorizations table since it links reviews to issues)
    latest_dates: dict[str, str] = {}
    for cluster in clusters:
        result = (
            db.table("categorizations")
            .select("reviews(review_date)")
            .eq("session_id", session_id)
            .eq("issue_key", cluster["issue_key"])
            .order("reviews(review_date)", desc=True)
            .limit(1)
            .execute()
            .data
        )
        if result and result[0].get("reviews"):
            latest_dates[cluster["issue_key"]] = result[0]["reviews"].get("review_date", "")

    scored = []
    for c in clusters:
        freq_norm    = c["review_count"] / max(total_reviews, 1)
        severity_norm = (c["avg_severity"] or 5) / 10.0
        tier_norm    = c["premium_user_count"] / max(c["review_count"], 1)
        revenue_norm = c["premium_user_count"] / max(total_premium, 1)
        recency      = _recency_norm(latest_dates.get(c["issue_key"]))

        score = (
            revenue_norm   * WEIGHT_REVENUE   +
            freq_norm      * WEIGHT_FREQUENCY +
            severity_norm  * WEIGHT_SEVERITY  +
            tier_norm      * WEIGHT_TIER      +
            recency        * WEIGHT_RECENCY
        )

        revenue_at_risk = c["premium_user_count"] * AVG_REVENUE_PER_USER

        scored.append({
            "id":             c["id"],
            "issue_key":      c["issue_key"],
            "priority_score": round(score, 4),
            "revenue_at_risk": round(revenue_at_risk, 2),
        })

    # Sort descending by score and assign rank
    scored.sort(key=lambda x: x["priority_score"], reverse=True)
    for rank, item in enumerate(scored, start=1):
        db.table("issue_clusters").update({
            "priority_score": item["priority_score"],
            "priority_rank":  rank,
            "revenue_at_risk": item["revenue_at_risk"],
        }).eq("id", item["id"]).execute()

    return {"ranked": len(scored)}
