"""
Decision Intelligence Engine — thin wrapper over centralized revenue_impact service.
Zero AI math. Gemini never touches this calculation.
"""
from typing import List, Optional

from domain.interfaces import IPriorityEngine
from domain.schemas import IssueCluster, PriorityResult
from services.revenue_impact import score_clusters
from core.logging import get_logger

logger = get_logger("services.priority_engine")


class DecisionIntelligenceEngine(IPriorityEngine):
    """
    Priority Score = (Revenue × 0.35) + (Reach × 0.30) + (Severity × 0.20) + (Tier × 0.15)

    Estimated Revenue Impact = affected × ARPU × severity_risk_factor
    (Never presented as actual revenue lost.)
    """

    def calculate_priorities(
        self,
        session_id: str,
        clusters: List[IssueCluster],
        total_reviews: int,
        *,
        monthly_customers: Optional[int] = None,
        avg_revenue_per_user: Optional[float] = None,
        business_premium_pct: Optional[float] = None,
    ) -> PriorityResult:
        if not clusters:
            return PriorityResult(
                session_id=session_id,
                total_reviews=total_reviews,
                actionable_reviews=0,
                total_revenue_at_risk=0.0,
                ranked_clusters=[],
            )

        by_key = {c.issue_key: c for c in clusters}
        as_dicts = [
            {
                "issue_key": c.issue_key,
                "review_count": c.review_count,
                "affected_customers": c.review_count,
                "avg_severity": c.avg_severity,
                "premium_user_count": c.premium_user_count,
            }
            for c in clusters
        ]

        scored = score_clusters(
            as_dicts,
            monthly_customers=monthly_customers,
            avg_revenue_per_user=avg_revenue_per_user,
            business_premium_pct=business_premium_pct,
        )

        ranked: List[IssueCluster] = []
        total_revenue_risk = 0.0
        for item in scored:
            obj = by_key.get(item.get("issue_key"))
            if obj is None:
                continue
            obj.priority_score = item["priority_score"]
            obj.priority_rank = item["priority_rank"]
            obj.revenue_at_risk = item["revenue_at_risk"]
            obj.decision_pillars = item["decision_pillars"]
            total_revenue_risk += float(item["revenue_at_risk"] or 0)
            ranked.append(obj)

        logger.info(
            f"Decision Intelligence Engine: session={session_id} | "
            f"{len(ranked)} issues ranked | "
            f"top_issue={ranked[0].issue_key if ranked else 'none'} | "
            f"total_estimated_revenue_impact=INR {total_revenue_risk:.2f}"
        )

        return PriorityResult(
            session_id=session_id,
            total_reviews=total_reviews,
            actionable_reviews=sum(c.review_count for c in ranked),
            total_revenue_at_risk=round(total_revenue_risk, 2),
            ranked_clusters=ranked,
        )
