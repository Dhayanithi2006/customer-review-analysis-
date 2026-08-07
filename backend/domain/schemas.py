from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from domain.enums import ReviewSource, SentimentLabel, CategoryType, BusinessArea

class UnifiedReview(BaseModel):
    """
    Module 4 — Unified Review Schema.
    Canonical data model used by all adapters (CSV, Google Play, App Store).
    """
    id: str = Field(description="Unique review identifier (UUID or source ID)")
    session_id: str = Field(description="Ingestion session identifier")
    raw_text: str = Field(description="Original uncleaned review text")
    rating: Optional[int] = Field(default=None, ge=1, le=5, description="Star rating 1-5")
    review_date: Optional[date] = Field(default=None, description="Date review was posted")
    source: ReviewSource = Field(default=ReviewSource.CSV, description="Origin platform")
    user_id: Optional[str] = Field(default=None, description="Anonymized user identifier")

    model_config = ConfigDict(from_attributes=True)


class CleanedReview(BaseModel):
    """Output from the Cleaning Engine (Modules 8-11)."""
    review_id: str
    session_id: str
    cleaned_text: str
    is_duplicate: bool = False
    is_spam: bool = False
    language: str = "en"
    sentiment_score: Optional[float] = None
    sentiment_label: Optional[SentimentLabel] = None
    routed_to_llm: bool = False


class CategorizedReview(BaseModel):
    """Output from Gemini Batch Analyzer (Module 13-15)."""
    review_index: int
    issue_key: str = Field(pattern=r"^[A-Z][A-Z0-9_]{1,49}$")
    category: CategoryType
    severity: int = Field(ge=1, le=10)
    confidence: int = Field(ge=0, le=100)
    summary: str
    business_area: BusinessArea


class IssueCluster(BaseModel):
    """Aggregated issue cluster representation (Module 16)."""
    id: Optional[str] = None
    session_id: str
    issue_key: str
    category: str
    business_area: str
    description: str
    review_count: int = 0
    avg_severity: float = 0.0
    avg_confidence: float = 0.0
    avg_sentiment: float = 0.0
    premium_user_count: int = 0
    priority_score: float = 0.0
    priority_rank: Optional[int] = None
    revenue_at_risk: float = 0.0
    platforms: List[str] = Field(default_factory=list)
    sample_reviews: List[str] = Field(default_factory=list)


class PriorityResult(BaseModel):
    """Decision Intelligence Engine Output (Modules 17-18)."""
    session_id: str
    total_reviews: int
    actionable_reviews: int
    total_revenue_at_risk: float
    ranked_clusters: List[IssueCluster]


class ExecutiveSummaryResult(BaseModel):
    """Executive Summary Output (Module 6 / Phase 2 output)."""
    session_id: str
    executive_summary: str
    headline_insights: List[str]
    ai_recommendation: str
