import json
from typing import List, Dict, Any, Tuple
from ai.config import (
    TEMP_CATEGORIZATION, TEMP_SUMMARY, TEMP_ROADMAP, TEMP_WEEKLY_REVIEW,
    MAX_BATCH_SIZE
)
from ai.prompt_manager import PromptManager
from ai.gemini_client import GeminiFlashClient
from ai.parser import ResponseParser
from ai.schemas import (
    CategorizationItem, ExecutiveSummarySchema,
    RoadmapSchema, WeeklyProductReviewSchema
)
from ai.fallback import FallbackEngine
from domain.schemas import CleanedReview
from core.cache import cache_service
from core.exceptions import RoadmapAIException
from core.logging import get_logger

logger = get_logger("ai.engine")


class AILayerEngine:
    """
    High-Level AI Layer Engine & Orchestrator.
    Executes all 4 core LLM call types with:
      1. Batch Categorization (Temp 0.1, Confidence Extraction, JSON Validation)
      2. Executive Summary (Temp 0.2, Grounded Narrative, Headline Insights)
      3. Roadmap & Sprint (Temp 0.3, Priority-Constrained Effort & User Story Generation)
      4. Weekly Product Review (Temp 0.2, Grounded Q&A Interactive Meeting)
    Integrated with in-memory TTL caching and deterministic rule-based fallback.
    """

    def __init__(self):
        self.prompt_manager = PromptManager()
        self.client = GeminiFlashClient()
        self.parser = ResponseParser()
        self.fallback = FallbackEngine()

    async def batch_categorization(
        self, session_id: str, reviews: List[CleanedReview]
    ) -> Tuple[List[CategorizationItem], float]:
        """
        AI Call Type 1: Categorization.
        Batches reviews (50 max), invokes Gemini Flash at Temp 0.1,
        extracts confidence scores, and enforces Pydantic JSON schema validation.
        """
        if not reviews:
            return [], 0.0

        # Check Cache
        cache_key = f"ai_cat:{session_id}"
        cached = cache_service.get(cache_key)
        if cached:
            logger.info(f"Returning cached categorizations for session {session_id}")
            items = [CategorizationItem.model_validate(x) for x in cached["items"]]
            return items, cached["mean_confidence"]

        # Batch reviews
        batches = [reviews[i:i + MAX_BATCH_SIZE] for i in range(0, len(reviews), MAX_BATCH_SIZE)]
        all_items: List[CategorizationItem] = []
        confidences: List[float] = []

        for batch_idx, batch in enumerate(batches):
            prompt_payload = [
                {"index": i, "text": r.cleaned_text}
                for i, r in enumerate(batch)
            ]
            prompt = self.prompt_manager.render_categorization(
                reviews_json=json.dumps(prompt_payload, ensure_ascii=False),
                count=len(batch)
            )

            try:
                raw_response = await self.client.generate(
                    prompt=prompt,
                    call_type="categorize",
                    session_id=session_id,
                    temperature=TEMP_CATEGORIZATION
                )
                items, mean_conf = self.parser.parse_categorization_list(raw_response)
                all_items.extend(items)
                confidences.append(mean_conf)

            except Exception as e:
                logger.error(f"Categorization batch {batch_idx} failed: {e}. Running fallback.")
                fallback_items = self.fallback.fallback_categorization(prompt_payload)
                all_items.extend(fallback_items)
                confidences.append(60.0)

        overall_confidence = round(sum(confidences) / max(len(confidences), 1), 2)

        # Cache result
        cache_service.set(cache_key, {
            "items": [item.model_dump() for item in all_items],
            "mean_confidence": overall_confidence
        })

        return all_items, overall_confidence

    async def generate_executive_summary(
        self, session_id: str, data_payload: Dict[str, Any]
    ) -> ExecutiveSummarySchema:
        """
        AI Call Type 2: Executive Summary.
        Invokes Gemini Flash at Temp 0.2 with pre-calculated aggregated statistics.
        Returns 3-paragraph narrative, 3 headline insights, and 1 recommendation.
        """
        cache_key = f"ai_summary:{session_id}"
        cached = cache_service.get(cache_key)
        if cached:
            return ExecutiveSummarySchema.model_validate(cached)

        prompt = self.prompt_manager.render_executive_summary(
            data_json=json.dumps(data_payload, ensure_ascii=False)
        )

        try:
            raw_response = await self.client.generate(
                prompt=prompt,
                call_type="summary",
                session_id=session_id,
                temperature=TEMP_SUMMARY
            )
            result = self.parser.parse_and_validate(raw_response, ExecutiveSummarySchema)
        except Exception as e:
            logger.error(f"Executive Summary generation failed for {session_id}: {e}. Running fallback.")
            result = self.fallback.fallback_executive_summary(data_payload)

        cache_service.set(cache_key, result.model_dump())
        return result

    async def generate_roadmap(
        self, session_id: str, team_size: str, priority_issues: List[Dict[str, Any]]
    ) -> RoadmapSchema:
        """
        AI Call Type 3: Roadmap & Sprint Plan.
        Invokes Gemini Flash at Temp 0.3 with priority-ranked issues.
        Returns 6-week roadmap themes and Sprint 1 Jira user stories.
        """
        cache_key = f"ai_roadmap:{session_id}"
        cached = cache_service.get(cache_key)
        if cached:
            return RoadmapSchema.model_validate(cached)

        prompt = self.prompt_manager.render_roadmap(
            team_size=team_size,
            issues_json=json.dumps(priority_issues, ensure_ascii=False)
        )

        try:
            raw_response = await self.client.generate(
                prompt=prompt,
                call_type="roadmap",
                session_id=session_id,
                temperature=TEMP_ROADMAP
            )
            result = self.parser.parse_and_validate(raw_response, RoadmapSchema)
        except Exception as e:
            logger.error(f"Roadmap generation failed for {session_id}: {e}. Running fallback.")
            result = self.fallback.fallback_roadmap(priority_issues)

        cache_service.set(cache_key, result.model_dump())
        return result

    async def conduct_weekly_product_review(
        self, session_id: str, user_message: str, review_count: int, context_payload: Dict[str, Any]
    ) -> WeeklyProductReviewSchema:
        """
        AI Call Type 4: Weekly Product Review Meeting.
        Invokes Gemini Flash at Temp 0.2 for interactive founder Q&A.
        Returns grounded 2-4 sentence response with referenced issue keys.
        """
        prompt = self.prompt_manager.render_weekly_product_review(
            user_message=user_message,
            review_count=review_count,
            context_json=json.dumps(context_payload, ensure_ascii=False)
        )

        try:
            raw_response = await self.client.generate(
                prompt=prompt,
                call_type="meeting",
                session_id=session_id,
                temperature=TEMP_WEEKLY_REVIEW
            )
            result = self.parser.parse_and_validate(raw_response, WeeklyProductReviewSchema)
        except Exception as e:
            logger.error(f"Weekly Product Review Q&A failed for {session_id}: {e}. Running fallback.")
            result = self.fallback.fallback_weekly_product_review(context_payload)

        return result
