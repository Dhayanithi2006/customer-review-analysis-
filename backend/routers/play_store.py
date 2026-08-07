"""
Play Store Router — POST /upload/play-store
Fetches reviews from Google Play using google-play-scraper, inserts them,
and fires the same background pipeline as CSV upload.
"""
import uuid
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field
from database import get_db
from pipeline.orchestrator import run_pipeline

router = APIRouter(prefix="/upload", tags=["upload"])


class PlayStoreRequest(BaseModel):
    app_id: str = Field(..., description="Google Play package ID, e.g. 'com.spotify.music'")
    count: int = Field(default=200, ge=10, le=2000)
    lang: str = Field(default="en")
    country: str = Field(default="us")
    team_size: str = Field(default="2_5")
    business_id: str | None = Field(default=None, description="Phase 2: link to business workspace")


@router.post("/play-store")
async def upload_play_store(
    body: PlayStoreRequest,
    background_tasks: BackgroundTasks,
):
    """
    Scrape reviews from the Google Play Store for the given app_id,
    insert them into the database, and run the analysis pipeline.
    """
    try:
        from google_play_scraper import reviews as play_reviews, Sort  # type: ignore
    except ImportError:
        raise HTTPException(
            500,
            "google-play-scraper is not installed. Run: pip install google-play-scraper"
        )

    try:
        result, _ = play_reviews(
            body.app_id,
            lang=body.lang,
            country=body.country,
            sort=Sort.NEWEST,
            count=body.count,
        )
    except Exception as e:
        raise HTTPException(400, f"Failed to fetch Play Store reviews for '{body.app_id}': {str(e)[:200]}")

    if not result:
        raise HTTPException(400, f"No reviews found for app '{body.app_id}'. Check the app_id and try again.")

    # Filter empty reviews
    valid = [r for r in result if r.get("content", "").strip()]
    if len(valid) < 10:
        raise HTTPException(400, f"Only {len(valid)} non-empty reviews found. Need at least 10.")

    db = get_db()
    session_id = str(uuid.uuid4())

    session_row = {
        "id":            session_id,
        "filename":      f"play_store:{body.app_id}",
        "source":        "play_store",
        "team_size":     body.team_size,
        "status":        "pending",
        "total_reviews": len(valid),
    }
    if body.business_id:
        session_row["business_id"] = body.business_id

    db.table("sessions").insert(session_row).execute()

    # ── Link session to business with version tracking ────────────────────────
    if body.business_id:
        try:
            existing = (
                db.table("analysis_versions")
                .select("version")
                .eq("business_id", body.business_id)
                .order("version", desc=True)
                .limit(1)
                .execute()
                .data
            )
            next_version = (existing[0]["version"] + 1) if existing else 1
            db.table("analysis_versions").insert({
                "business_id": body.business_id,
                "session_id":  session_id,
                "version":     next_version,
                "label":       f"Version {next_version}",
                "status":      "pending",
            }).execute()
        except Exception:
            pass

    # Build rows
    rows = []
    for r in valid:
        from datetime import datetime
        rating = r.get("score")
        if rating and not (1 <= rating <= 5):
            rating = None

        rev_date = None
        at_dt = r.get("at")
        if isinstance(at_dt, datetime):
            rev_date = at_dt.date().isoformat()

        rows.append({
            "id":          str(uuid.uuid4()),
            "session_id":  session_id,
            "raw_text":    r["content"].strip(),
            "source":      "play_store",
            "rating":      rating,
            "review_date": rev_date,
        })

    # Insert in batches of 500
    for i in range(0, len(rows), 500):
        db.table("reviews").insert(rows[i:i + 500]).execute()

    background_tasks.add_task(run_pipeline, session_id)

    return {
        "session_id":    session_id,
        "business_id":   body.business_id,
        "app_id":        body.app_id,
        "total_reviews": len(valid),
        "status_url":    f"/pipeline/{session_id}/status",
        "dashboard_url": f"/results/{session_id}/dashboard",
        "workspace_url": f"/business/{body.business_id}/analysis" if body.business_id else None,
    }
