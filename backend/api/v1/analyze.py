import uuid
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from pydantic import BaseModel

from adapters.csv_adapter import CSVAdapter
from adapters.google_play_adapter import GooglePlayAdapter
from adapters.app_store_adapter import AppStoreAdapter
from services.cleaning_engine import CleaningEngine
from services.vader_service import VaderService
from services.gemini_service import GeminiService
from services.issue_clustering import IssueClusteringEngine
from services.priority_engine import DecisionIntelligenceEngine
from domain.schemas import UnifiedReview, PriorityResult
from core.cache import cache_service
from core.exceptions import RoadmapAIException
from core.logging import get_logger

logger = get_logger("api.v1.analyze")

router = APIRouter(prefix="/analyze", tags=["analyze"])

csv_adapter = CSVAdapter()
google_play_adapter = GooglePlayAdapter()
app_store_adapter = AppStoreAdapter()
cleaning_engine = CleaningEngine()
vader_service = VaderService()
gemini_service = GeminiService()
clustering_engine = IssueClusteringEngine()
priority_engine = DecisionIntelligenceEngine()


class ScrapeAnalysisRequest(BaseModel):
    source: str  # "play_store" or "app_store"
    app_id: str
    count: Optional[int] = 100
    country: Optional[str] = "us"


@router.post("/csv", response_model=PriorityResult)
async def analyze_csv(
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(None)
):
    """
    Phase 2 Complete Pipeline Endpoint for CSV:
    CSV Adapter -> Cleaning Engine (Dedup, Spam, Lang) -> VADER Filter ->
    Gemini Batch Categorizer -> JSON Validation -> Issue Clustering -> Decision Intelligence Engine.
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a .csv file")

    sid = session_id or str(uuid.uuid4())
    content = await file.read()

    try:
        # 1. Collection Layer
        reviews, _ = await csv_adapter.parse_bytes(content, session_id=sid)
        if not reviews:
            raise HTTPException(status_code=400, detail="No valid review text rows found in CSV")

        # 2. Cleaning Engine (Normalization, Dedup, Spam, Lang)
        cleaned_reviews = cleaning_engine.clean(reviews)

        # 3. VADER Sentiment Filter & LLM Routing
        for cr in cleaned_reviews:
            if not cr.is_spam and not cr.is_duplicate:
                # Find matching unified review for star rating
                matching_ur = next((r for r in reviews if r.id == cr.review_id), None)
                rating = matching_ur.rating if matching_ur else None
                score, label, routed = vader_service.analyze_sentiment(cr.cleaned_text, rating=rating)
                cr.sentiment_score = score
                cr.sentiment_label = label
                cr.routed_to_llm = routed

        # Filter reviews routed to LLM
        llm_input_reviews = [cr for cr in cleaned_reviews if cr.routed_to_llm]

        # 4. Gemini Batch Categorizer + 5. JSON Validation
        categorizations = await gemini_service.categorize_batch(sid, llm_input_reviews)

        # 6. Issue Clustering Engine
        clusters = clustering_engine.cluster(sid, categorizations, cleaned_reviews)

        # 7. Decision Intelligence Engine (Priority Formula)
        result = priority_engine.calculate_priorities(sid, clusters, total_reviews=len(reviews))

        # Cache result
        cache_service.set(f"priority_result:{sid}", result.model_dump())

        return result

    except RoadmapAIException as e:
        logger.error(f"Analysis error for session {sid}: {e.message}")
        raise HTTPException(status_code=500, detail=e.message)


@router.post("/scrape", response_model=PriorityResult)
async def analyze_scraped_app(body: ScrapeAnalysisRequest):
    """
    Phase 2 Complete Pipeline Endpoint for Google Play or App Store:
    Scraper Adapter -> Cleaning Engine -> VADER -> Gemini -> JSON Validation -> Issue Clustering -> Decision Intelligence.
    """
    sid = str(uuid.uuid4())

    try:
        if body.source == "play_store":
            reviews = await google_play_adapter.fetch_reviews(
                session_id=sid, app_id=body.app_id, count=body.count or 100, country=body.country or "us"
            )
        elif body.source == "app_store":
            reviews = await app_store_adapter.fetch_reviews(
                session_id=sid, app_id=body.app_id, country=body.country or "us"
            )
        else:
            raise HTTPException(status_code=400, detail="Invalid source. Use 'play_store' or 'app_store'")

        if not reviews:
            raise HTTPException(status_code=400, detail=f"No reviews retrieved for {body.source} app {body.app_id}")

        # Cleaning -> VADER -> Gemini -> Clustering -> Priority Formula
        cleaned_reviews = cleaning_engine.clean(reviews)

        for cr in cleaned_reviews:
            if not cr.is_spam and not cr.is_duplicate:
                matching_ur = next((r for r in reviews if r.id == cr.review_id), None)
                rating = matching_ur.rating if matching_ur else None
                score, label, routed = vader_service.analyze_sentiment(cr.cleaned_text, rating=rating)
                cr.sentiment_score = score
                cr.sentiment_label = label
                cr.routed_to_llm = routed

        llm_input_reviews = [cr for cr in cleaned_reviews if cr.routed_to_llm]
        categorizations = await gemini_service.categorize_batch(sid, llm_input_reviews)
        clusters = clustering_engine.cluster(sid, categorizations, cleaned_reviews)
        result = priority_engine.calculate_priorities(sid, clusters, total_reviews=len(reviews))

        cache_service.set(f"priority_result:{sid}", result.model_dump())
        return result

    except RoadmapAIException as e:
        raise HTTPException(status_code=500, detail=e.message)
