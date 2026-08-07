from typing import List
from domain.interfaces import IPriorityEngine
from domain.schemas import IssueCluster, PriorityResult
from config import (
    WEIGHT_REVENUE, WEIGHT_FREQUENCY, WEIGHT_SEVERITY,
    WEIGHT_TIER, AVG_REVENUE_PER_USER
)
from core.logging import get_logger

logger = get_logger("services.priority_engine")


class DecisionIntelligenceEngine(IPriorityEngine):
    """
    Decision Intelligence Engine — Pure Deterministic Backend Algorithm.
    Zero AI math. Gemini never touches this calculation.

    Priority Score = (Revenue × 0.35) + (Frequency × 0.30) + (Severity × 0.20) + (Customer Tier × 0.15)

    This formula ensures high-revenue bugs outrank popular-but-low-impact feature requests.
    Example:
      Payment Failure:  Revenue=10, Freq=8, Sev=9, Tier=9  → Score 9.05
      Dark Mode:        Revenue=2,  Freq=10, Sev=3, Tier=4  → Score 4.65

    Business Impact Formula:
      Revenue at Risk = premium_user_count × avg_revenue_per_user (default INR 500/mo)

    Note: Revenue figures are ESTIMATED from simulated customer tier weights and assumptions.
    Real revenue data should be injected via the API for production use.
    """

    def _normalize(self, value: float, max_value: float) -> float:
        """Safe normalized value between 0.0 and 1.0."""
        if max_value <= 0:
            return 0.0
        return min(1.0, value / max_value)

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
            # ── Algorithm Step 1: Frequency Component (normalized 0–1)
            # Measures how widespread the problem is across all reviews
            freq_norm = self._normalize(c.review_count, total_reviews)

            # ── Algorithm Step 2: Severity Component (normalized 0–1)
            # Measures how bad the user experience is when they hit this issue
            severity_norm = (c.avg_severity or 5.0) / 10.0

            # ── Algorithm Step 3: Customer Tier Component (premium ratio)
            # Premium users contribute more weight because they directly affect MRR
            # Weight range: free user = 0.2, premium user = 1.0
            premium_ratio = c.premium_user_count / max(c.review_count, 1)
            # Blend: 20% floor (every user matters) + 80% premium weighted
            tier_norm = 0.2 + (0.8 * premium_ratio)

            # ── Algorithm Step 4: Revenue Impact Component (normalized 0–1)
            # Normalizes premium user count against total premium affected users
            if total_premium > 0:
                revenue_norm = self._normalize(c.premium_user_count, total_premium)
            else:
                # Fallback: use severity as proxy when no premium data
                revenue_norm = severity_norm

            # ── Decision Score Pillars (raw normalized contributions per pillar)
            revenue_pillar   = revenue_norm   * WEIGHT_REVENUE
            frequency_pillar = freq_norm      * WEIGHT_FREQUENCY
            severity_pillar  = severity_norm  * WEIGHT_SEVERITY
            tier_pillar      = tier_norm      * WEIGHT_TIER

            # ── Final Priority Score (deterministic, no AI)
            score = revenue_pillar + frequency_pillar + severity_pillar + tier_pillar

            # ── Estimated Business Impact (INR)
            # Formula: premium_users × avg_revenue_per_user (configurable, default INR 500/mo)
            revenue_at_risk = c.premium_user_count * AVG_REVENUE_PER_USER
            total_revenue_risk += revenue_at_risk

            # Persist computed values to the cluster
            c.priority_score = round(score, 4)
            c.revenue_at_risk = round(revenue_at_risk, 2)

            # ── Store Decision Score Pillars for transparent frontend display
            # Each pillar shows its raw weighted contribution (0.0–max_weight)
            c.decision_pillars = {
                "revenue_impact":   round(revenue_pillar, 4),
                "customer_reach":   round(frequency_pillar, 4),
                "severity":         round(severity_pillar, 4),
                "premium_users":    round(tier_pillar, 4),
                # Percentages of total score (for UI display)
                "revenue_pct":      round((revenue_pillar / max(score, 0.001)) * 100),
                "reach_pct":        round((frequency_pillar / max(score, 0.001)) * 100),
                "severity_pct":     round((severity_pillar / max(score, 0.001)) * 100),
                "premium_pct":      round((tier_pillar / max(score, 0.001)) * 100),
            }

        # ── Sort descending by priority_score and assign rank 1..N
        sorted_clusters = sorted(clusters, key=lambda x: x.priority_score, reverse=True)
        for rank, cluster in enumerate(sorted_clusters, start=1):
            cluster.priority_rank = rank

        logger.info(
            f"Decision Intelligence Engine: session={session_id} | "
            f"{len(sorted_clusters)} issues ranked | "
            f"top_issue={sorted_clusters[0].issue_key if sorted_clusters else 'none'} | "
            f"total_revenue_risk=INR {total_revenue_risk:.2f}"
        )

        return PriorityResult(
            session_id=session_id,
            total_reviews=total_reviews,
            actionable_reviews=sum(c.review_count for c in sorted_clusters),
            total_revenue_at_risk=round(total_revenue_risk, 2),
            ranked_clusters=sorted_clusters
        )
