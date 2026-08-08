"""
Feedback Router — Public Feedback Submission Endpoint
GET  /feedback/{business_id}  → Returns public form config (business name, engagement mode, industry)
POST /feedback/{business_id}  → Accepts a single review from the public form

Architecture:
  Phone/Browser → GET /feedback/{id} (to get form config)
  Phone/Browser → POST /feedback/{id} (to submit review)
  → Stored in feedback_submissions (buffer)
  → Migrated into reviews table when owner runs analysis

Engagement Modes (derived from industry):
  REWARD MODE      — Supermarket, Hotel, Restaurant, E-commerce, Hostel
  IMPROVEMENT MODE — Hospital, School, Bank
  PRODUCT MODE     — Mobile App, SaaS
"""
import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from database import get_db
from core.logging import get_logger
from services.spam_detector import is_spam

logger = get_logger("routers.feedback")

router = APIRouter(prefix="/feedback", tags=["Feedback"])

# ── Engagement Mode Classification ───────────────────────────────────────────

REWARD_INDUSTRIES = {"Supermarket", "Hotel", "Restaurant", "E-commerce", "Hostel"}
IMPROVEMENT_INDUSTRIES = {"Hospital", "School", "Bank"}
PRODUCT_INDUSTRIES = {"Mobile App", "SaaS"}

VALID_FEEDBACK_TAGS = {"Bug", "Feature Request", "Performance", "UX", "Praise", "Other"}

def _get_engagement_mode(industry: str) -> str:
    """Derive engagement mode from industry. Pure function, no DB."""
    if industry in REWARD_INDUSTRIES:
        return "reward"
    if industry in IMPROVEMENT_INDUSTRIES:
        return "improvement"
    return "product"  # Default: Mobile App, SaaS, and anything else


# ── Request / Response Schemas ───────────────────────────────────────────────

class FeedbackSubmitRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=2000,
                      description="Customer feedback text. Minimum 10 characters.")
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


# ── Engagement mode copy (UI text) ───────────────────────────────────────────

MODE_COPY = {
    "reward": {
        "headline": "Share your experience & earn loyalty points",
        "subtext": "Takes less than a minute. Your honest feedback helps us serve you better.",
        "success": "Thank you! Your loyalty points will be credited within 24 hours.",
        "show_reward_promise": True,
        "show_tag_selector": False,
        "requires_rating": True,
    },
    "improvement": {
        "headline": "Help us serve you better",
        "subtext": "Your feedback is used to improve services. It is completely confidential.",
        "success": "Your feedback has been recorded. Thank you for helping us improve.",
        "show_reward_promise": False,
        "show_tag_selector": False,
        "requires_rating": True,
    },
    "product": {
        "headline": "Shape the product roadmap",
        "subtext": "Your feedback directly influences what our team builds next.",
        "success": "Received. Your input influences our next product decisions — thank you.",
        "show_reward_promise": False,
        "show_tag_selector": True,
        "requires_rating": False,
    },
}


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/{business_id}", response_model=FeedbackFormConfig)
async def get_feedback_form_config(business_id: str):
    """
    Public endpoint — no auth required.
    Returns the form configuration for a business's feedback page.
    Called by the QR code landing page to load the correct form variant.
    """
    db = get_db()

    biz = (
        db.table("businesses")
        .select("id,business_name,industry,engagement_mode")
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

    # Prefer explicitly stored mode, fall back to derived
    mode = row.get("engagement_mode") or _get_engagement_mode(industry)
    copy = MODE_COPY.get(mode, MODE_COPY["improvement"])

    return FeedbackFormConfig(
        business_id=row["id"],
        business_name=row["business_name"],
        industry=industry,
        engagement_mode=mode,
        mode_headline=copy["headline"],
        mode_subtext=copy["subtext"],
        mode_success_message=copy["success"],
        show_reward_promise=copy["show_reward_promise"],
        show_tag_selector=copy["show_tag_selector"],
        requires_rating=copy["requires_rating"],
    )


@router.post("/{business_id}")
async def submit_feedback(business_id: str, body: FeedbackSubmitRequest):
    """
    Public endpoint — no auth required.
    Accepts a single feedback submission from the public form.

    Flow:
    1. Validate business exists
    2. Spam-check the text
    3. Validate feedback_tag if provided
    4. Store in feedback_submissions (buffer table)
    5. Return success + engagement response

    The submission is NOT immediately processed through the pipeline.
    It enters the pipeline when the business owner clicks 'Run Analysis'.
    """
    db = get_db()

    # ── Validate business exists ──────────────────────────────────────────────
    biz = (
        db.table("businesses")
        .select("id,business_name,industry,engagement_mode")
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
    mode = row.get("engagement_mode") or _get_engagement_mode(industry)

    # ── Spam detection ────────────────────────────────────────────────────────
    text = body.text.strip()
    if is_spam(text):
        # Return 200 (not 400) to avoid revealing spam detection to bots
        return {
            "success": True,
            "message": MODE_COPY[mode]["success"],
            "engagement_mode": mode,
            "submission_id": None,  # Silent reject
        }

    # ── Validate feedback tag ─────────────────────────────────────────────────
    feedback_tag = None
    if body.feedback_tag:
        tag = body.feedback_tag.strip()
        if tag in VALID_FEEDBACK_TAGS:
            feedback_tag = tag
        # If invalid tag, silently ignore it (don't reject the whole submission)

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

    return {
        "success":         True,
        "message":         MODE_COPY[mode]["success"],
        "engagement_mode": mode,
        "submission_id":   submission_id,
        "show_reward":     mode == "reward",
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

    # Count unprocessed (session_id IS NULL)
    total_result = (
        db.table("feedback_submissions")
        .select("id", count="exact")
        .eq("business_id", business_id)
        .is_("session_id", "null")
        .execute()
    )
    total_pending = total_result.count or 0

    # Recent samples
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

    # Also count all-time
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

    Called when the business owner clicks 'Run Analysis' on their workspace.

    Flow:
    1. Fetch all unprocessed submissions for this business
    2. Create a new session (source='qr_form')
    3. Insert each submission as a review row
    4. Create an analysis_version record
    5. Fire the pipeline
    6. Mark submissions as processed (set session_id)
    """
    from pipeline.orchestrator import run_pipeline
    import asyncio

    db = get_db()

    # ── Validate business ─────────────────────────────────────────────────────
    biz = db.table("businesses").select("id,business_name,industry").eq("id", business_id).execute().data
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found.")

    # ── Fetch pending submissions ─────────────────────────────────────────────
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

    # ── Create analysis session ───────────────────────────────────────────────
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

    # ── Insert reviews ────────────────────────────────────────────────────────
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

    # ── Create analysis version ───────────────────────────────────────────────
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
        pass  # Non-fatal

    # ── Mark submissions as processed ─────────────────────────────────────────
    sub_ids = [s["id"] for s in pending]
    for i in range(0, len(sub_ids), 100):
        db.table("feedback_submissions").update({
            "session_id": session_id
        }).in_("id", sub_ids[i:i+100]).execute()

    # ── Fire pipeline ─────────────────────────────────────────────────────────
    # Run as background task using asyncio
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, run_pipeline, session_id)

    logger.info(
        f"Processing {len(pending)} form submissions for business={business_id} "
        f"session={session_id}"
    )

    return {
        "success":     True,
        "session_id":  session_id,
        "total_processed": len(pending),
        "message": f"Processing {len(pending)} submissions. Analysis will be ready shortly.",
        "status_url":    f"/pipeline/{session_id}/status",
        "workspace_url": f"/business/{business_id}/analysis",
    }
