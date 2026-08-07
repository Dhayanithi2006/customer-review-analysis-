import io
import uuid
import pandas as pd
from typing import List, Tuple, Dict, Any, Optional
from domain.schemas import UnifiedReview
from domain.enums import ReviewSource
from adapters.base import BaseReviewAdapter
from core.exceptions import ColumnDetectionError, IngestionError
from core.logging import get_logger

logger = get_logger("adapters.csv")

# Column detection keyword sets
TEXT_KEYWORDS   = {"review", "text", "feedback", "comment", "body", "content", "description"}
RATING_KEYWORDS = {"rating", "stars", "score", "note", "star"}
DATE_KEYWORDS   = {"date", "time", "created", "submitted", "timestamp"}
USER_KEYWORDS   = {"user", "author", "customer", "id", "userid", "user_id", "reviewer"}


class CSVAdapter(BaseReviewAdapter):
    """
    Module 5 — CSV Adapter.
    In-memory / streaming CSV parser with intelligent column auto-detection.
    Converts raw CSV rows into UnifiedReview schemas.
    """
    
    def __init__(self):
        super().__init__(source_name="CSV")

    def _detect_column(self, headers: List[str], keywords: set, exclude: set = None) -> Optional[str]:
        exclude = exclude or set()
        for h in headers:
            if h in exclude:
                continue
            h_words = set(h.lower().replace("_", " ").replace("-", " ").split())
            if any(kw == h.lower() or kw in h_words or (len(kw) > 3 and kw in h.lower()) for kw in keywords):
                return h
        return None

    def detect_columns(self, headers: List[str]) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        text_col = self._detect_column(headers, TEXT_KEYWORDS)
        rating_col = self._detect_column(headers, RATING_KEYWORDS, exclude={text_col} if text_col else set())
        date_col = self._detect_column(headers, DATE_KEYWORDS, exclude={text_col, rating_col} - {None})
        return text_col, rating_col, date_col

    async def parse_bytes(self, content: bytes, session_id: str) -> Tuple[List[UnifiedReview], Dict[str, Optional[str]]]:
        """Parse raw CSV bytes into UnifiedReview models with auto-detected columns."""
        try:
            df = pd.read_csv(io.BytesIO(content), encoding="utf-8", on_bad_lines="skip")
        except Exception:
            try:
                df = pd.read_csv(io.BytesIO(content), encoding="latin-1", on_bad_lines="skip")
            except Exception as e:
                raise IngestionError(f"Failed to parse CSV encoding: {e}", source="CSV")

        if df.empty:
            raise IngestionError("CSV file is completely empty", source="CSV")

        headers = list(df.columns)
        text_col, rating_col, date_col = self.detect_columns(headers)

        if not text_col:
            raise ColumnDetectionError("Could not auto-detect review text column", headers=headers)

        df = df.dropna(subset=[text_col])
        df = df[df[text_col].astype(str).str.strip() != ""]

        reviews: List[UnifiedReview] = []
        for _, row in df.iterrows():
            raw_text = str(row[text_col]).strip()
            rating = None
            rev_date = None

            if rating_col and rating_col in row and pd.notna(row[rating_col]):
                try:
                    r = int(float(row[rating_col]))
                    if 1 <= r <= 5:
                        rating = r
                except ValueError:
                    pass

            if date_col and date_col in row and pd.notna(row[date_col]):
                try:
                    rev_date = pd.to_datetime(row[date_col]).date()
                except Exception:
                    pass

            reviews.append(
                UnifiedReview(
                    id=str(uuid.uuid4()),
                    session_id=session_id,
                    raw_text=raw_text,
                    rating=rating,
                    review_date=rev_date,
                    source=ReviewSource.CSV,
                )
            )

        detected_map = {"text": text_col, "rating": rating_col, "date": date_col}
        logger.info(f"Parsed {len(reviews)} reviews from CSV (session_id={session_id})")
        return reviews, detected_map

    async def fetch_reviews(self, session_id: str, content: bytes = None, **kwargs) -> List[UnifiedReview]:
        if not content:
            raise IngestionError("CSV adapter requires 'content' bytes parameter", source="CSV")
        reviews, _ = await self.parse_bytes(content, session_id)
        return reviews
