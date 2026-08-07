from collections import defaultdict
from typing import List, Dict, Any
from domain.interfaces import IIssueClusteringEngine
from domain.schemas import CategorizedReview, CleanedReview, IssueCluster
from core.logging import get_logger

logger = get_logger("services.issue_clustering")


class IssueClusteringEngine(IIssueClusteringEngine):
    """
    Module 16 — Issue Clustering Engine.
    Groups categorizations by issue_key.
    Aggregates review counts, average severities, confidence scores, VADER sentiments,
    identifies premium user proxy counts, and collects sample reviews.
    Pure backend logic — zero LLM calculation.
    """

    def cluster(
        self,
        session_id: str,
        categorizations: List[CategorizedReview],
        cleaned_reviews: List[CleanedReview]
    ) -> List[IssueCluster]:
        if not categorizations:
            return []

        review_map = {r.review_id: r for r in cleaned_reviews}

        # Cluster accumulator map
        groups: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            "category": "",
            "business_area": "",
            "description": "",
            "severities": [],
            "confidences": [],
            "sentiments": [],
            "sample_texts": [],
            "premium_count": 0,
            "platforms": set(),
        })

        for cat in categorizations:
            key = cat.issue_key
            g = groups[key]

            g["category"] = g["category"] or (cat.category.value if hasattr(cat.category, 'value') else str(cat.category))
            g["business_area"] = g["business_area"] or (cat.business_area.value if hasattr(cat.business_area, 'value') else str(cat.business_area))
            g["description"] = g["description"] or cat.summary

            g["severities"].append(cat.severity)
            g["confidences"].append(cat.confidence)

            # Match with cleaned review details if available
            if cat.review_index < len(cleaned_reviews):
                cr = cleaned_reviews[cat.review_index]
                sentiment = cr.sentiment_score or 0.0
                g["sentiments"].append(sentiment)
                if sentiment < -0.5:
                    g["premium_count"] += 1
                if cr.cleaned_text and len(g["sample_texts"]) < 5:
                    g["sample_texts"].append(cr.cleaned_text)

        clusters: List[IssueCluster] = []
        for issue_key, g in groups.items():
            count = len(g["severities"])
            avg_sev = sum(g["severities"]) / count
            avg_conf = sum(g["confidences"]) / count
            avg_sent = sum(g["sentiments"]) / max(len(g["sentiments"]), 1)

            clusters.append(
                IssueCluster(
                    session_id=session_id,
                    issue_key=issue_key,
                    category=g["category"],
                    business_area=g["business_area"],
                    description=g["description"],
                    review_count=count,
                    avg_severity=round(avg_sev, 2),
                    avg_confidence=round(avg_conf, 2),
                    avg_sentiment=round(avg_sent, 4),
                    premium_user_count=g["premium_count"],
                    platforms=list(g["platforms"]),
                    sample_reviews=g["sample_texts"][:5],
                )
            )

        logger.info(f"Clustered {len(categorizations)} categorizations into {len(clusters)} unique issue clusters")
        return clusters
