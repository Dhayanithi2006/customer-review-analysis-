"""
Step 5 — Priority Engine (Decision Intelligence Engine)
Calculates deterministic priority score for every issue cluster.
Pure backend formula — zero AI.

Formula:
Priority = Revenue×0.35 + Frequency×0.30 + Severity×0.20 + CustomerTier×0.15
"""
from database import get_db
from config import (
    WEIGHT_REVENUE, WEIGHT_FREQUENCY, WEIGHT_SEVERITY,
    WEIGHT_TIER, AVG_REVENUE_PER_USER,
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

    total_reviews = sum(int(c.get("review_count") or 0) for c in clusters_list)
    total_premium = sum(int(c.get("premium_user_count") or 0) for c in clusters_list)

    scored = []
    for c in clusters_list:
        rev_cnt = int(c.get("review_count") or 0)
        prem_cnt = int(c.get("premium_user_count") or 0)
        avg_sev = float(c.get("avg_severity") or 5)

        freq_norm     = rev_cnt / max(total_reviews, 1)
        severity_norm = avg_sev / 10.0
        premium_ratio = prem_cnt / max(rev_cnt, 1)
        tier_norm     = 0.2 + (0.8 * premium_ratio)

        if total_premium > 0:
            revenue_norm = prem_cnt / max(total_premium, 1)
        else:
            revenue_norm = severity_norm

        rev_part  = revenue_norm  * WEIGHT_REVENUE
        reach_part = freq_norm     * WEIGHT_FREQUENCY
        sev_part   = severity_norm * WEIGHT_SEVERITY
        tier_part  = tier_norm     * WEIGHT_TIER

        score = rev_part + reach_part + sev_part + tier_part
        revenue_at_risk = prem_cnt * AVG_REVENUE_PER_USER

        scored.append({
            "id":             c.get("id"),
            "issue_key":      c.get("issue_key"),
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
