import uuid
import httpx
from typing import List, Optional
from datetime import datetime
from domain.schemas import UnifiedReview
from domain.enums import ReviewSource
from adapters.base import BaseReviewAdapter
from core.exceptions import IngestionError
from core.logging import get_logger

logger = get_logger("adapters.app_store")


class AppStoreAdapter(BaseReviewAdapter):
    """
    Module 7 — App Store Adapter.
    Fetches real-time iOS app store reviews via Apple's RSS Customer Reviews API
    by Apple App ID (numeric, e.g. '324684580' for Spotify) and maps to UnifiedReview models.
    """

    def __init__(self):
        super().__init__(source_name="App Store")

    async def fetch_reviews(
        self,
        session_id: str,
        app_id: Optional[str] = None,
        country: str = "us",
        page: int = 1,
        **kwargs
    ) -> List[UnifiedReview]:
        if not app_id:
            raise IngestionError("App Store Adapter requires numeric 'app_id' (e.g. '324684580')", source="App Store")

        url = f"https://itunes.apple.com/{country}/rss/customerreviews/page={page}/id={app_id}/sortby=mostrecent/json"
        logger.info(f"Fetching App Store reviews from {url}")

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(url)
                if response.status_code != 200:
                    raise IngestionError(f"Apple RSS API returned status {response.status_code}", source="App Store")
                data = response.json()
        except Exception as e:
            raise IngestionError(f"Failed to fetch App Store reviews: {e}", source="App Store")

        entries = data.get("feed", {}).get("entry", [])
        if isinstance(entries, dict):
            entries = [entries]

        unified_list: List[UnifiedReview] = []

        for entry in entries:
            # Skip the app metadata entry (it has im:name but no content)
            content_obj = entry.get("content", {})
            raw_text = content_obj.get("label", "").strip() if isinstance(content_obj, dict) else ""
            if not raw_text:
                continue

            # Rating
            rating = None
            rating_str = entry.get("im:rating", {}).get("label")
            if rating_str:
                try:
                    rating = int(rating_str)
                except ValueError:
                    pass

            # Author
            user_id = entry.get("author", {}).get("name", {}).get("label")
            
            # Review ID / Date
            rev_id = entry.get("id", {}).get("label") or str(uuid.uuid4())

            unified_list.append(
                UnifiedReview(
                    id=str(uuid.uuid4()),
                    session_id=session_id,
                    raw_text=raw_text,
                    rating=rating,
                    review_date=datetime.now().date(),
                    source=ReviewSource.APP_STORE,
                    user_id=user_id,
                )
            )

        logger.info(f"Successfully scraped {len(unified_list)} App Store reviews for app_id={app_id}")
        return unified_list
