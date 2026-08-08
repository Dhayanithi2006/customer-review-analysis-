"""
Feedback Router — Public Feedback Submission Endpoint (Phase 2)
GET  /feedback/{business_id}  → Returns public form config (dynamic per mode & settings)
POST /feedback/{business_id}  → Accepts a single review from the public form with validation

Architecture:
  Phone/Browser → GET /feedback/{id} (to get form config)
  Phone/Browser → POST /feedback/{id} (to submit review)
  → Stored in feedback_submissions (buffer)
  → Migrated into reviews table when owner runs analysis

Engagement Modes:
  REWARD MODE      — Points & incentives ("Thank you! You've earned 10 points.")
  IMPROVEMENT MODE — Formal/Institutional ("Thank you for sharing your experience.")
  PRODUCT MODE     — Feature/roadmap ("Feedback received. Your feedback can help shape future product improvements.")
"""
import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from database import get_db
from core.logging import get_logger
from services.spam_detector import is_spam
from routers.feedback_settings import _get_or_create_settings, _get_engagement_mode

logger = get_logger("routers.feedback")

router = APIRouter(prefix="/feedback", tags=["Feedback"])

VALID_FEEDBACK_TAGS = {"Bug", "Feature Request", "Performance", "UX", "Praise", "Other"}


# ── Request / Response Schemas ───────────────────────────────────────────────

class FeedbackSubmitRequest(BaseModel):
    text: str = Field(..., min_length=5, max_length=2000,
                      description="Customer feedback text.")
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    customer_name: Optional[str] = Field(default=None, max_length=80)
    customer_email: Optional[str] = Field(default=None, max_length=200)
    feedback_tag: Optional[str] = Field(default=None, description="Bug | Feature Request | Performance | UX | Praise | Other")

    model_config = {
        "json_schema_extra": {
            "example": {
                "text": "The checkout kept freezing on the payment step. Very frustrating.",
                "rating": 2,
                "customer_name": "Priya S.",
                "feedback_tag": "Bug"
            }
        }
    }


class FeedbackFormConfig(BaseModel):
    business_id: str
    business_name: str
    industry: str
    engagement_mode: str       # 'reward' | 'improvement' | 'product'
    mode_headline: str
    mode_subtext: str
    mode_success_message: str
    show_reward_promise: bool
    show_tag_selector: bool    # Only for PRODUCT mode
    requires_rating: bool
    minimum_feedback_length: int
    points_per_feedback: int
    reward_enabled: bool
    reward_description: str
    reward_threshold: int


def _build_mode_dynamic_copy(settings: dict, business_name: str, industry: str) -> dict:
    """
    Constructs dynamic headlines, subtexts, and success messages based on mode and settings.
    No internal AI terminology (VADER, Gemini, Decision Center) is ever exposed to the end customer.
    """
    mode = settings.get("feedback_mode") or _get_engagement_mode(industry)
    reward_enabled = bool(settings.get("reward_enabled", False))
    points = int(settings.get("points_per_feedback", 10))
    min_len = int(settings.get("minimum_feedback_length", 10))
    custom_msg = (settings.get("feedback_message") or "").strip()
    reward_desc = (settings.get("reward_description") or "").strip()

    if mode == "reward":
        headline = custom_msg if custom_msg else f"How was your experience at {business_name}?"
        subtext = "Tell us what we can improve. Submit valid feedback to earn loyalty points."
        success_msg = f"Thank you! You've earned {points} points. Your feedback helps us improve your experience."
        return {
            "mode": "reward",
            "headline": headline,
            "subtext": subtext,
            "success": success_msg,
            "show_reward_promise": reward_enabled,
            "show_tag_selector": False,
            "requires_rating": True,
        }

    if mode == "improvement":
        headline = custom_msg if custom_msg else f"How was your experience today?"
        subtext = "Tell us what we can improve. Your feedback is confidential and helps us improve service quality."
        success_msg = "Thank you for sharing your experience. Your feedback helps us improve service quality."
        return {
            "mode": "improvement",
            "headline": headline,
            "subtext": subtext,
            "success": success_msg,
            "show_reward_promise": False,
            "show_tag_selector": False,
            "requires_rating": True,
        }

    # Product Mode
    headline = custom_msg if custom_msg else "How was your experience?"
    subtext = "What should we improve? Your feedback directly shapes future product improvements."
    success_msg = "Feedback received. Your feedback can help shape future product improvements."
    return {
        "mode": "product",
        "headline": headline,
        "subtext": subtext,
        "success": success_msg,
        "show_reward_promise": False,
        "show_tag_selector": True,
        "requires_rating": False,
    }


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/{business_id}", response_model=FeedbackFormConfig)
async def get_feedback_form_config(business_id: str):
    """
    Public endpoint — no auth required.
    Returns the dynamic form configuration for a business's feedback page.
    Directly reflects business feedback_mode and settings from Phase 1.
    """
    db = get_db()

    biz = (
        db.table("businesses")
        .select("id,business_name,industry")
        .eq("id", business_id)
        .execute()
        .data
    )

    if not biz:
        raise HTTPException(
            status_code=404,
            detail="Business not found. The QR code may be outdated."
        )

    row = biz[0]
    industry = row["industry"]
    settings = _get_or_create_settings(db, business_id, industry)
    copy = _build_mode_dynamic_copy(settings, row["business_name"], industry)

    return FeedbackFormConfig(
        business_id=row["id"],
        business_name=row["business_name"],
        industry=industry,
        engagement_mode=copy["mode"],
        mode_headline=copy["headline"],
        mode_subtext=copy["subtext"],
        mode_success_message=copy["success"],
        show_reward_promise=copy["show_reward_promise"],
        show_tag_selector=copy["show_tag_selector"],
        requires_rating=copy["requires_rating"],
        minimum_feedback_length=int(settings.get("minimum_feedback_length", 10)),
        points_per_feedback=int(settings.get("points_per_feedback", 10)),
        reward_enabled=bool(settings.get("reward_enabled", False)),
        reward_description=settings.get("reward_description", "") or "",
        reward_threshold=int(settings.get("reward_threshold", 100)),
    )


@router.post("/{business_id}")
async def submit_feedback(business_id: str, body: FeedbackSubmitRequest):
    """
    Public endpoint — no auth required.
    Accepts a single feedback submission from the public form.

    Flow:
    1. Validate business exists & fetch settings
    2. Check minimum length validation according to business settings
    3. Spam-check the text
    4. Store in feedback_submissions buffer table
    5. Return mode-specific engagement success response
    """
    db = get_db()

    biz = (
        db.table("businesses")
        .select("id,business_name,industry")
        .eq("id", business_id)
        .execute()
        .data
    )

    if not biz:
        raise HTTPException(
            status_code=404,
            detail="Business not found."
        )

    row = biz[0]
    industry = row["industry"]
    settings = _get_or_create_settings(db, business_id, industry)
    copy = _build_mode_dynamic_copy(settings, row["business_name"], industry)

    mode = copy["mode"]
    min_length = int(settings.get("minimum_feedback_length", 10))

    # ── Minimum length validation ─────────────────────────────────────────────
    text = body.text.strip()
    if len(text) < min_length:
        raise HTTPException(
            status_code=400,
            detail=f"Feedback is too short. Please enter at least {min_length} characters."
        )

    # ── Spam detection ────────────────────────────────────────────────────────
    if is_spam(text):
        # Return 200 (silent reject) to prevent bot reverse engineering
        return {
            "success": True,
            "message": copy["success"],
            "engagement_mode": mode,
            "points_earned": settings.get("points_per_feedback", 10) if mode == "reward" and settings.get("reward_enabled") else 0,
            "submission_id": None,
        }

    # ── Validate feedback tag ─────────────────────────────────────────────────
    feedback_tag = None
    if body.feedback_tag:
        tag = body.feedback_tag.strip()
        if tag in VALID_FEEDBACK_TAGS:
            feedback_tag = tag

    # ── Store submission ──────────────────────────────────────────────────────
    submission_id = str(uuid.uuid4())

    submission_row = {
        "id":              submission_id,
        "business_id":     business_id,
        "raw_text":        text,
        "engagement_mode": mode,
    }
    if body.rating:
        submission_row["rating"] = body.rating
    if body.customer_name:
        submission_row["customer_name"] = body.customer_name[:80]
    if body.customer_email:
        submission_row["customer_email"] = body.customer_email[:200]
    if feedback_tag:
        submission_row["feedback_tag"] = feedback_tag

    try:
        db.table("feedback_submissions").insert(submission_row).execute()
        logger.info(
            f"Feedback submitted: business={business_id} mode={mode} "
            f"id={submission_id} rating={body.rating}"
        )
    except Exception as e:
        logger.error(f"Failed to store feedback submission: {e}")
        raise HTTPException(status_code=500, detail="Failed to record feedback. Please try again.")

    points = int(settings.get("points_per_feedback", 10)) if mode == "reward" and settings.get("reward_enabled") else 0

    return {
        "success":         True,
        "message":         copy["success"],
        "engagement_mode": mode,
        "submission_id":   submission_id,
        "points_earned":   points,
        "show_reward":     mode == "reward" and bool(settings.get("reward_enabled")),
    }


@router.get("/{business_id}/pending")
async def get_pending_submissions(business_id: str):
    """
    Workspace-facing endpoint — returns count and list of unprocessed submissions.
    Used by the workspace overview to show the pending submissions counter.
    """
    db = get_db()

    biz = db.table("businesses").select("id,business_name").eq("id", business_id).execute().data
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found.")

    total_result = (
        db.table("feedback_submissions")
        .select("id", count="exact")
        .eq("business_id", business_id)
        .is_("session_id", "null")
        .execute()
    )
    total_pending = total_result.count or 0

    samples = (
        db.table("feedback_submissions")
        .select("id,raw_text,rating,engagement_mode,feedback_tag,submitted_at")
        .eq("business_id", business_id)
        .is_("session_id", "null")
        .order("submitted_at", desc=True)
        .limit(20)
        .execute()
        .data
    )

    all_time = (
        db.table("feedback_submissions")
        .select("id", count="exact")
        .eq("business_id", business_id)
        .execute()
    )

    return {
        "business_id":     business_id,
        "business_name":   biz[0]["business_name"],
        "total_pending":   total_pending,
        "total_all_time":  all_time.count or 0,
        "samples":         samples,
        "ready_to_analyse": total_pending >= 5,
        "message": (
            f"{total_pending} new submissions ready to analyse"
            if total_pending > 0
            else "No new submissions yet."
        ),
    }


@router.post("/{business_id}/process")
async def process_submissions_into_pipeline(business_id: str):
    """
    Workspace-facing endpoint — migrates pending feedback_submissions
    into the reviews table and fires the analysis pipeline.
    """
    from pipeline.orchestrator import run_pipeline
    import asyncio

    db = get_db()

    biz = db.table("businesses").select("id,business_name,industry").eq("id", business_id).execute().data
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found.")

    pending = (
        db.table("feedback_submissions")
        .select("id,raw_text,rating,submitted_at,engagement_mode")
        .eq("business_id", business_id)
        .is_("session_id", "null")
        .order("submitted_at", desc=False)
        .execute()
        .data
    )

    if not pending:
        return {
            "success": False,
            "message": "No pending submissions to process. Collect more feedback first.",
            "session_id": None,
        }

    if len(pending) < 5:
        return {
            "success": False,
            "message": f"Only {len(pending)} submissions. Need at least 5 for a meaningful analysis.",
            "session_id": None,
        }

    session_id = str(uuid.uuid4())

    db.table("sessions").insert({
        "id":            session_id,
        "filename":      f"form_submissions:{business_id}",
        "source":        "qr_form",
        "team_size":     "small_team",
        "status":        "pending",
        "total_reviews": len(pending),
        "business_id":   business_id,
    }).execute()

    review_rows = []
    for sub in pending:
        review_rows.append({
            "id":          str(uuid.uuid4()),
            "session_id":  session_id,
            "raw_text":    sub["raw_text"],
            "source":      "qr_form",
            "rating":      sub.get("rating"),
            "review_date": sub.get("submitted_at", "")[:10] if sub.get("submitted_at") else None,
        })

    for i in range(0, len(review_rows), 500):
        db.table("reviews").insert(review_rows[i:i+500]).execute()

    try:
        existing = (
            db.table("analysis_versions")
            .select("version")
            .eq("business_id", business_id)
            .order("version", desc=True)
            .limit(1)
            .execute()
            .data
        )
        next_version = (existing[0]["version"] + 1) if existing else 1
        db.table("analysis_versions").insert({
            "business_id": business_id,
            "session_id":  session_id,
            "version":     next_version,
            "label":       f"Version {next_version} (Form Submissions)",
            "status":      "pending",
        }).execute()
    except Exception:
        pass

    sub_ids = [s["id"] for s in pending]
    for i in range(0, len(sub_ids), 100):
        db.table("feedback_submissions").update({
            "session_id": session_id
        }).in_("id", sub_ids[i:i+100]).execute()

    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, run_pipeline, session_id)

    logger.info(
        f"Processing {len(pending)} form submissions for business={business_id} "
        f"session={session_id}"
    )

    return {
        "success":         True,
        "session_id":      session_id,
        "total_processed": len(pending),
        "message":        f"Processing {len(pending)} submissions. Analysis will be ready shortly.",
        "status_url":      f"/pipeline/{session_id}/status",
        "workspace_url":   f"/business/{business_id}/analysis",
    }
