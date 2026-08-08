"""
Feedback Router — Public Feedback Submission (Phase 2 MVP)
GET  /feedback/{business_id}  → Public form config
POST /feedback/{business_id}  → Submit feedback (QR / direct URL)

Collection sources (MVP): qr | direct | csv | sample
Telegram / Play Store / OAuth are out of scope.
"""
import re
import uuid
from typing import Optional, Literal
from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel, Field, field_validator
from database import get_db
from core.logging import get_logger
from core.ownership import assert_business_owner
from services.spam_detector import is_spam
from services.identity_hash import build_identity_hash
from routers.feedback_settings import _get_or_create_settings, _get_engagement_mode
from domain.enums import LEGACY_SOURCE_MAP, MVP_FEEDBACK_SOURCES

logger = get_logger("routers.feedback")

router = APIRouter(prefix="/feedback", tags=["Feedback"])

VALID_FEEDBACK_TAGS = {"Bug", "Feature Request", "Performance", "UX", "Praise", "Other"}
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PUBLIC_SOURCES = {"qr", "direct"}


def normalize_feedback_source(raw: Optional[str], default: str = "direct") -> str:
    value = (raw or default).strip().lower()
    value = LEGACY_SOURCE_MAP.get(value, value)
    if value not in MVP_FEEDBACK_SOURCES:
        return default
    return value


# ── Request / Response Schemas ───────────────────────────────────────────────

class FeedbackSubmitRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000,
                      description="Customer feedback text (required, non-empty).")
    rating: int = Field(..., ge=1, le=5, description="Star rating 1-5 (required).")
    customer_name: Optional[str] = Field(default=None, max_length=80)
    customer_email: Optional[str] = Field(default=None, max_length=200)
    customer_phone: Optional[str] = Field(default=None, max_length=32)
    feedback_tag: Optional[str] = Field(default=None, description="Bug | Feature Request | Performance | UX | Praise | Other")
    user_token: Optional[str] = Field(default=None, description="Anonymous customer UUID token")
    source: Literal["qr", "direct"] = Field(
        default="direct",
        description="qr = scanned QR code; direct = opened feedback URL",
    )

    @field_validator("text")
    @classmethod
    def text_not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Feedback text must not be empty.")
        return v

    @field_validator("customer_email")
    @classmethod
    def email_optional_but_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        if not cleaned:
            return None
        if not EMAIL_RE.match(cleaned) or len(cleaned) > 200:
            raise ValueError("Email must be a valid address if provided.")
        return cleaned

    model_config = {
        "json_schema_extra": {
            "example": {
                "text": "The checkout kept freezing on the payment step. Very frustrating.",
                "rating": 2,
                "customer_email": "priya@example.com",
                "source": "qr",
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
        "requires_rating": True,
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
        requires_rating=True,
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
    Validates business_id, rating 1-5, non-empty text, optional email.
    Stores into feedback_submissions with the correct business_id + source (qr|direct).
    """
    from routers.reward import calculate_user_balance, check_cooldown_status
    from services.abuse_detector import is_rate_limited, is_duplicate_text

    db = get_db()

    biz = (
        db.table("businesses")
        .select("id,business_name,industry")
        .eq("id", business_id)
        .execute()
        .data
    )

    if not biz:
        # #region agent log
        try:
            import json, time
            from pathlib import Path
            _p = Path(__file__).resolve().parents[2] / "debug-74d1c8.log"
            with open(_p, "a", encoding="utf-8") as _f:
                _f.write(json.dumps({"sessionId":"74d1c8","hypothesisId":"C","location":"feedback.py:submit","message":"business not found","data":{"business_id":business_id},"timestamp":int(time.time()*1000)})+"\n")
        except Exception:
            pass
        # #endregion
        raise HTTPException(
            status_code=404,
            detail="Business not found. This feedback link is invalid or expired."
        )

    row = biz[0]
    # Isolation: path business_id only
    business_id = row["id"]
    industry = row["industry"]
    settings = _get_or_create_settings(db, business_id, industry)
    # #region agent log
    try:
        import json, time
        from pathlib import Path
        _p = Path(__file__).resolve().parents[2] / "debug-74d1c8.log"
        with open(_p, "a", encoding="utf-8") as _f:
            _f.write(json.dumps({"sessionId":"74d1c8","hypothesisId":"D","location":"feedback.py:submit","message":"settings loaded","data":{"business_id":business_id,"industry":industry,"mode":settings.get("feedback_mode"),"reward_enabled":bool(settings.get("reward_enabled", False)),"cooldown_hours":settings.get("cooldown_hours")},"timestamp":int(time.time()*1000)})+"\n")
    except Exception:
        pass
    # #endregion
    copy = _build_mode_dynamic_copy(settings, row["business_name"], industry)

    mode = copy["mode"]
    min_length = max(1, int(settings.get("minimum_feedback_length", 5)))
    reward_enabled = bool(settings.get("reward_enabled", False))
    points_per_feedback = int(settings.get("points_per_feedback", 10))
    cooldown_hours = int(settings.get("cooldown_hours", 168))

    source = normalize_feedback_source(body.source, default="direct")
    if source not in PUBLIC_SOURCES:
        source = "direct"

    user_token = body.user_token.strip() if body.user_token else str(uuid.uuid4())
    identity_hash = build_identity_hash(
        email=body.customer_email,
        phone=body.customer_phone,
        user_token=user_token,
    )

    if is_rate_limited(user_token):
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please wait a few seconds before submitting feedback again."
        )

    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Feedback text must not be empty.")
    if len(text) < min_length:
        raise HTTPException(
            status_code=400,
            detail=f"Feedback is too short. Please enter at least {min_length} characters."
        )

    if body.rating is None or not (1 <= int(body.rating) <= 5):
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5.")

    if is_spam(text):
        return {
            "success": True,
            "message": copy["success"],
            "user_token": user_token,
            "engagement_mode": mode,
            "points_earned": 0,
            "current_balance": calculate_user_balance(db, business_id, identity_hash),
            "reward_eligible": False,
            "submission_id": None,
        }

    is_duplicate_submission = is_duplicate_text(business_id, user_token, text)

    feedback_tag = None
    if body.feedback_tag:
        tag = body.feedback_tag.strip()
        if tag in VALID_FEEDBACK_TAGS:
            feedback_tag = tag

    submission_id = str(uuid.uuid4())
    submission_row = {
        "id":              submission_id,
        "business_id":     business_id,
        "raw_text":        text,
        "rating":          int(body.rating),
        "engagement_mode": mode,
        "source":          source,
    }
    if body.customer_name:
        submission_row["customer_name"] = body.customer_name[:80]
    if body.customer_email:
        submission_row["customer_email"] = body.customer_email[:200]
        submission_row["follow_up_eligible"] = True
    if feedback_tag:
        submission_row["feedback_tag"] = feedback_tag

    try:
        db.table("feedback_submissions").insert(submission_row).execute()
        logger.info(
            f"Feedback submitted: business={business_id} source={source} "
            f"id={submission_id} rating={body.rating}"
        )
    except Exception as e:
        logger.error(f"Failed to store feedback submission: {e}")
        raise HTTPException(status_code=500, detail="Failed to record feedback. Please try again.")

    points_earned = 0
    reward_eligible = False
    reward_status = "ineligible"
    next_reward_at = None

    if mode == "reward" and reward_enabled:
        in_cooldown, next_eligible_at = check_cooldown_status(
            db, business_id, identity_hash, cooldown_hours
        )

        if is_duplicate_submission or (in_cooldown and next_eligible_at):
            reward_status = "cooldown_skipped"
            points_earned = 0
            reward_eligible = False
            if next_eligible_at:
                next_reward_at = next_eligible_at.isoformat()
        else:
            reward_status = "awarded"
            points_earned = points_per_feedback
            reward_eligible = True

    try:
        db.table("feedback_rewards").insert({
            "id":                     str(uuid.uuid4()),
            "business_id":            business_id,
            "feedback_id":            submission_id,
            "user_token":             user_token,
            "identity_hash":          identity_hash,
            "points_awarded":         points_earned,
            "reward_status":          reward_status,
        }).execute()
    except Exception as e:
        logger.warning(f"Failed to write to feedback_rewards ledger: {e}")

    current_balance = calculate_user_balance(db, business_id, identity_hash)

    return {
        "success":         True,
        "user_token":      user_token,
        "message":         copy["success"],
        "engagement_mode": mode,
        "submission_id":   submission_id,
        "points_earned":   points_earned,
        "current_balance": current_balance,
        "reward_eligible": reward_eligible,
        "next_reward_at":  next_reward_at,
        "show_reward":     mode == "reward" and reward_enabled,
        "source":          source,
    }


@router.get("/{business_id}/pending")
async def get_pending_submissions(
    business_id: str,
    request: Request,
    x_owner_token: Optional[str] = Header(None),
):
    """
    Workspace-facing endpoint — returns count and list of unprocessed submissions.
    Used by the workspace overview to show the pending submissions counter.
    """
    db = get_db()
    owner_biz = assert_business_owner(
        business_id, request=request, x_owner_token=x_owner_token, db=db
    )

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
        "business_name":   owner_biz.get("business_name") or "",
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
async def process_submissions_into_pipeline(
    business_id: str,
    request: Request,
    x_owner_token: Optional[str] = Header(None),
):
    """
    Workspace-facing endpoint — migrates pending feedback_submissions
    into the reviews table and fires the analysis pipeline.
    """
    from pipeline.orchestrator import run_pipeline
    import asyncio

    db = get_db()
    assert_business_owner(business_id, request=request, x_owner_token=x_owner_token, db=db)

    biz = db.table("businesses").select("id,business_name,industry").eq("id", business_id).execute().data
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found.")

    pending = (
        db.table("feedback_submissions")
        .select("id,raw_text,rating,submitted_at,engagement_mode,source,customer_email")
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

    # Prefer a concrete channel when the batch is homogeneous; default qr for mixed QR/direct.
    sources = {
        normalize_feedback_source(sub.get("source"), default="qr")
        for sub in pending
    }
    session_source = next(iter(sources)) if len(sources) == 1 else "qr"

    db.table("sessions").insert({
        "id":            session_id,
        "filename":      f"form_submissions:{business_id}",
        "source":        session_source,
        "team_size":     "small_team",
        "status":        "pending",
        "total_reviews": len(pending),
        "business_id":   business_id,
    }).execute()

    review_rows = []
    for sub in pending:
        row = {
            "id":          str(uuid.uuid4()),
            "session_id":  session_id,
            "raw_text":    sub["raw_text"],
            "source":      normalize_feedback_source(sub.get("source"), default="qr"),
            "rating":      sub.get("rating"),
            "review_date": sub.get("submitted_at", "")[:10] if sub.get("submitted_at") else None,
        }
        if sub.get("customer_email"):
            row["customer_email"] = sub["customer_email"]
        review_rows.append(row)

    for i in range(0, len(review_rows), 500):
        db.table("reviews").insert(review_rows[i:i+500]).execute()

    try:
        from services.business_linkage import create_analysis_version
        create_analysis_version(
            db,
            business_id,
            session_id,
            label="Form Submissions",
        )
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
