from typing import List
from ai.schemas import (
    CategorizationItem, ExecutiveSummarySchema,
    RoadmapSchema, RoadmapWeekItem, SprintPlanItem, SprintStoryItem,
    WeeklyProductReviewSchema
)
from core.logging import get_logger

logger = get_logger("ai.fallback")


class FallbackEngine:
    """
    Fallback Logic Engine.
    Provides rule-based, deterministic fallback responses when Gemini Flash API is unreachable or rate-limited.
    Guarantees graceful degradation without pipeline failure.
    """

    @staticmethod
    def fallback_categorization(reviews_json: list) -> List[CategorizationItem]:
        logger.warning("Executing Fallback Logic for Categorization")
        items = []
        for item in reviews_json:
            idx = item.get("index", 0)
            text = item.get("text", "")
            items.append(
                CategorizedReview_fallback(idx, text)
            )
        return items

    @staticmethod
    def fallback_executive_summary(data_json: dict) -> ExecutiveSummarySchema:
        logger.warning("Executing Fallback Logic for Executive Summary")
        total = data_json.get("total_reviews", 0)
        top_issues = data_json.get("top_issues", [])
        top_name = top_issues[0].get("issue_key", "UNKNOWN_BUG") if top_issues else "CRITICAL_ISSUE"

        return ExecutiveSummarySchema(
            executive_summary=(
                f"Analysis of {total} customer reviews identified core patterns across your product.\n\n"
                f"The highest priority concern identified is {top_name}. Immediate developer action is recommended.\n\n"
                f"Focus engineering efforts on addressing top priority bugs before introducing new features."
            ),
            headline_insights=[
                f"{total} reviews processed via rule-based fallback",
                f"Top priority issue identified: {top_name}",
                "Recommend stabilizing core features"
            ],
            ai_recommendation=f"Fix {top_name} to prevent customer churn."
        )

    @staticmethod
    def fallback_roadmap(issues_json: list) -> RoadmapSchema:
        logger.warning("Executing Fallback Logic for Roadmap & Sprint")
        weeks = []
        stories = []

        for i, issue in enumerate(issues_json[:6], start=1):
            key = issue.get("issue_key", f"ISSUE_{i}")
            weeks.append(
                RoadmapWeekItem(
                    week=i,
                    theme=f"Address {key.replace('_', ' ')}",
                    issues=[key],
                    effort="Medium" if i <= 3 else "Quick Win",
                    rationale=f"Rule-based scheduling for priority issue #{i}"
                )
            )

        for i, issue in enumerate(issues_json[:4], start=1):
            key = issue.get("issue_key", f"ISSUE_{i}")
            stories.append(
                SprintStoryItem(
                    id=f"S1-00{i}",
                    title=f"Resolve {key.replace('_', ' ')}",
                    user_story=f"As a user, I want {key} resolved so that the product functions properly.",
                    acceptance_criteria=[
                        f"Identify root cause of {key}",
                        "Write unit tests verifying fix",
                        "Deploy fix to production"
                    ],
                    effort="M" if i <= 2 else "S",
                    story_points=5 if i <= 2 else 2,
                    priority="High" if i <= 2 else "Medium",
                    linked_issue=key
                )
            )

        return RoadmapSchema(
            roadmap=weeks,
            sprint=SprintPlanItem(
                name="Sprint 1",
                owner="Engineering Team",
                duration_weeks=2,
                total_story_points=sum(s.story_points for s in stories),
                stories=stories
            )
        )

    @staticmethod
    def fallback_weekly_product_review(context_json: dict) -> WeeklyProductReviewSchema:
        logger.warning("Executing Fallback Logic for Weekly Product Review")
        issues = context_json.get("top_issues", [])
        top_key = issues[0].get("issue_key", "top bug") if issues else "critical issue"
        return WeeklyProductReviewSchema(
            reply=f"Based on your review data, your primary focus should be resolving {top_key}. This issue carries the highest priority and severity impact.",
            referenced_issues=[top_key] if top_key != "critical issue" else []
        )


def CategorizedReview_fallback(index: int, text: str) -> CategorizationItem:
    lower = text.lower()
    if any(k in lower for k in ["bug", "error", "fail", "crash", "broken"]):
        cat, area, sev = "Bug", "Core Feature", 8
    elif any(k in lower for k in ["slow", "lag", "delay", "freeze"]):
        cat, area, sev = "Performance", "UI", 6
    elif any(k in lower for k in ["price", "cost", "pay", "charge", "subscription"]):
        cat, area, sev = "Pricing", "Billing", 7
    elif any(k in lower for k in ["wish", "would love", "add", "feature", "want"]):
        cat, area, sev = "Feature Request", "Core Feature", 4
    else:
        cat, area, sev = "UX", "UI", 5

    words = [w.upper() for w in re.findall(r"\w+", text) if len(w) > 3][:3]
    key = "_".join(words) if words else "GENERAL_ISSUE"

    return CategorizationItem(
        review_index=index,
        issue_key=key,
        category=cat,
        severity=sev,
        confidence=60,
        summary=text[:60],
        business_area=area
    )
