import uuid
from typing import List, Optional
from datetime import datetime
from google_play_scraper import reviews as play_reviews, Sort
from domain.schemas import UnifiedReview
from domain.enums import ReviewSource
from adapters.base import BaseReviewAdapter
from core.exceptions import IngestionError
from core.logging import get_logger

logger = get_logger("adapters.google_play")


class GooglePlayAdapter(BaseReviewAdapter):
    """
    Module 6 — Google Play Store Adapter.
    Fetches real-time app reviews from Google Play Store by package ID (e.g. 'com.spotify.music')
    and maps raw JSON response into canonical UnifiedReview models.
    """

    def __init__(self):
        super().__init__(source_name="Google Play")

    async def fetch_reviews(
        self,
        session_id: str,
        app_id: Optional[str] = None,
        count: int = 200,
        lang: str = "en",
        country: str = "us",
        **kwargs
    ) -> List[UnifiedReview]:
        if not app_id:
            raise IngestionError("Google Play Adapter requires 'app_id' (e.g. 'com.example.app')", source="Google Play")

        logger.info(f"Fetching {count} reviews for Google Play app_id={app_id}")

        try:
            result, _ = play_reviews(
                app_id,
                lang=lang,
                country=country,
                sort=Sort.NEWEST,
                count=count
            )
        except Exception as e:
            raise IngestionError(f"Failed to scrape Google Play reviews for '{app_id}': {e}", source="Google Play")

        unified_list: List[UnifiedReview] = []

        for r in result:
            raw_text = r.get("content", "").strip()
            if not raw_text:
                continue

            # Parse rating
            rating = r.get("score")
            if rating and not (1 <= rating <= 5):
                rating = None

            # Parse date
            rev_date = None
            at_dt = r.get("at")
            if isinstance(at_dt, datetime):
                rev_date = at_dt.date()

            user_id = r.get("userName") or r.get("reviewId")

            unified_list.append(
                UnifiedReview(
                    id=str(uuid.uuid4()),
                    session_id=session_id,
                    raw_text=raw_text,
                    rating=rating,
                    review_date=rev_date,
                    source=ReviewSource.PLAY_STORE,
                    user_id=user_id,
                )
            )

        logger.info(f"Successfully scraped {len(unified_list)} reviews from Google Play for {app_id}")
        return unified_list
