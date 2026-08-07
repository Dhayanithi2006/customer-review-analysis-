import uuid
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from pydantic import BaseModel
from adapters.csv_adapter import CSVAdapter
from adapters.google_play_adapter import GooglePlayAdapter
from adapters.app_store_adapter import AppStoreAdapter
from domain.schemas import UnifiedReview
from core.exceptions import RoadmapAIException
from core.logging import get_logger

logger = get_logger("api.v1.ingest")

router = APIRouter(prefix="/ingest", tags=["ingest"])

csv_adapter = CSVAdapter()
google_play_adapter = GooglePlayAdapter()
app_store_adapter = AppStoreAdapter()


class ScrapeRequest(BaseModel):
    app_id: str
    count: Optional[int] = 100
    country: Optional[str] = "us"


@router.post("/csv")
async def ingest_csv(
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(None)
):
    """Ingest customer reviews from a CSV file."""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a .csv file")

    sid = session_id or str(uuid.uuid4())
    content = await file.read()

    try:
        reviews, detected_columns = await csv_adapter.parse_bytes(content, session_id=sid)
        return {
            "session_id": sid,
            "source": "csv",
            "total_reviews": len(reviews),
            "detected_columns": detected_columns,
            "sample_review": reviews[0] if reviews else None
        }
    except RoadmapAIException as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.post("/google-play")
async def ingest_google_play(body: ScrapeRequest, session_id: Optional[str] = Query(None)):
    """Fetch customer reviews directly from Google Play Store by package ID."""
    sid = session_id or str(uuid.uuid4())
    try:
        reviews = await google_play_adapter.fetch_reviews(
            session_id=sid,
            app_id=body.app_id,
            count=body.count or 100,
            country=body.country or "us"
        )
        return {
            "session_id": sid,
            "source": "play_store",
            "app_id": body.app_id,
            "total_reviews": len(reviews),
            "sample_review": reviews[0] if reviews else None
        }
    except RoadmapAIException as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.post("/app-store")
async def ingest_app_store(body: ScrapeRequest, session_id: Optional[str] = Query(None)):
    """Fetch customer reviews directly from Apple App Store by Apple App ID."""
    sid = session_id or str(uuid.uuid4())
    try:
        reviews = await app_store_adapter.fetch_reviews(
            session_id=sid,
            app_id=body.app_id,
            country=body.country or "us"
        )
        return {
            "session_id": sid,
            "source": "app_store",
            "app_id": body.app_id,
            "total_reviews": len(reviews),
            "sample_review": reviews[0] if reviews else None
        }
    except RoadmapAIException as e:
        raise HTTPException(status_code=400, detail=e.message)
