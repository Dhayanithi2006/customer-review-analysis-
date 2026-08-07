from typing import List
from domain.interfaces import IPriorityEngine
from domain.schemas import IssueCluster, PriorityResult
from config import (
    WEIGHT_REVENUE, WEIGHT_FREQUENCY, WEIGHT_SEVERITY,
    WEIGHT_TIER, WEIGHT_RECENCY, AVG_REVENUE_PER_USER
)
from core.logging import get_logger

logger = get_logger("services.priority_engine")


class DecisionIntelligenceEngine(IPriorityEngine):
    """
    Modules 17 & 18 — Decision Intelligence Engine & Priority Formula.
    Pure backend formula calculation. Zero AI math.
    
    Formula:
      Priority = (Revenue × 0.30) + (Frequency × 0.25) + (Severity × 0.20) + (Customer Tier × 0.15) + (Recency × 0.10)
    """

    def calculate_priorities(self, session_id: str, clusters: List[IssueCluster], total_reviews: int) -> PriorityResult:
        if not clusters:
            return PriorityResult(
                session_id=session_id,
                total_reviews=total_reviews,
                actionable_reviews=0,
                total_revenue_at_risk=0.0,
                ranked_clusters=[]
            )

        total_premium = sum(c.premium_user_count for c in clusters)
        max_reviews = max(c.review_count for c in clusters)
        total_revenue_risk = 0.0

        for c in clusters:
            # 1. Frequency Component (Normalized 0.0 - 1.0)
            freq_norm = c.review_count / max(total_reviews, 1)

            # 2. Severity Component (Normalized 0.0 - 1.0)
            severity_norm = (c.avg_severity or 5.0) / 10.0

            # 3. Customer Tier Component (Ratio of premium users affected)
            tier_norm = c.premium_user_count / max(c.review_count, 1)

            # 4. Revenue Component (Normalized against total premium users)
            revenue_norm = c.premium_user_count / max(total_premium, 1) if total_premium > 0 else tier_norm

            # 5. Recency Component (Default high recency 0.8 for newly ingested batch)
            recency_norm = 0.8

            # Transparent Weighted Priority Score Calculation
            score = (
                revenue_norm   * WEIGHT_REVENUE   +
                freq_norm      * WEIGHT_FREQUENCY +
                severity_norm  * WEIGHT_SEVERITY  +
                tier_norm      * WEIGHT_TIER      +
                recency_norm   * WEIGHT_RECENCY
            )

            # Estimate Revenue At Risk
            revenue_at_risk = c.premium_user_count * AVG_REVENUE_PER_USER
            total_revenue_risk += revenue_at_risk

            c.priority_score = round(score, 4)
            c.revenue_at_risk = round(revenue_at_risk, 2)

        # Sort clusters descending by priority_score and assign rank 1..N
        sorted_clusters = sorted(clusters, key=lambda x: x.priority_score, reverse=True)
        for rank, cluster in enumerate(sorted_clusters, start=1):
            cluster.priority_rank = rank

            f"Priority engine calculation finished for session {session_id}: "
            f"{len(sorted_clusters)} issues ranked, total revenue risk = INR {total_revenue_risk:.2f}"
        )

        return PriorityResult(
            session_id=session_id,
            total_reviews=total_reviews,
            actionable_reviews=sum(c.review_count for c in sorted_clusters),
            total_revenue_at_risk=round(total_revenue_risk, 2),
            ranked_clusters=sorted_clusters
        )
