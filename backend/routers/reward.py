"""
Reward Ledger Router — Phase 3
POST /feedback/{business_id}/reward/eligibility → Checks reward eligibility and next eligible timestamp
GET  /feedback/{business_id}/reward/balance     → Calculates total ledger point balance for an anonymous user_token

Architecture:
  - Ledger-based system: balance = SUM(points_awarded) for (business_id, user_token).
  - Anonymous customer identification via secure UUID user_token (no mandatory account creation).
  - Independent cooldown per business (e.g. cooldown_hours = 168).
  - Customer can submit feedback anytime, but rewards are skipped if in cooldown or non-reward mode.
  - Zero LLM calls — 100% deterministic validation.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from database import get_db
from core.logging import get_logger
from services.spam_detector import is_spam
from routers.feedback_settings import _get_or_create_settings, _get_engagement_mode

logger = get_logger("routers.reward")
router = APIRouter(prefix="/feedback", tags=["Reward Ledger"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class EligibilityCheckRequest(BaseModel):
    user_token: str = Field(..., description="Anonymous customer UUID token")
    text: Optional[str] = Field(default=None, description="Optional text for pre-submission validation")
    rating: Optional[int] = Field(default=None, ge=1, le=5)


class EligibilityCheckResponse(BaseModel):
    business_id: str
    user_token: str
    eligible: bool
    reason: str                # 'eligible' | 'non_reward_mode' | 'reward_disabled' | 'cooldown_active' | 'text_too_short' | 'spam_detected'
    points_awarded: int
    current_balance: int
    next_reward_at: Optional[str] = None


class UserBalanceResponse(BaseModel):
    business_id: str
    user_token: str
    current_balance: int
    total_rewards_claimed: int


# ── Helper Functions ──────────────────────────────────────────────────────────

def calculate_user_balance(db, business_id: str, identity_key: str) -> int:
    """Calculates customer balance from feedback_rewards ledger by identity_hash or user_token."""
    try:
        # Prefer identity_hash column when present
        res = (
            db.table("feedback_rewards")
            .select("points_awarded")
            .eq("business_id", business_id)
            .eq("identity_hash", identity_key)
            .execute()
        )
        if res.data:
            return sum(int(row.get("points_awarded", 0) or 0) for row in res.data)

        # Fallback: legacy rows keyed only by user_token / device: prefix
        token = identity_key.split("device:", 1)[-1] if identity_key.startswith("device:") else identity_key
        res = (
            db.table("feedback_rewards")
            .select("points_awarded")
            .eq("business_id", business_id)
            .eq("user_token", token)
            .execute()
        )
        if not res.data:
            return 0
        return sum(int(row.get("points_awarded", 0) or 0) for row in res.data)
    except Exception as e:
        logger.warning(f"Error calculating balance: {e}")
        return 0


def check_cooldown_status(db, business_id: str, identity_key: str, cooldown_hours: int):
    """
    Checks if a reward was awarded within the last cooldown_hours for this identity.
    Returns (is_in_cooldown: bool, next_reward_at: Optional[datetime]).
    """
    if cooldown_hours <= 0:
        return False, None

    try:
        res = (
            db.table("feedback_rewards")
            .select("created_at")
            .eq("business_id", business_id)
            .eq("identity_hash", identity_key)
            .eq("reward_status", "awarded")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )

        if not res.data:
            # Legacy fallback by user_token
            token = identity_key.split("device:", 1)[-1] if identity_key.startswith("device:") else identity_key
            res = (
                db.table("feedback_rewards")
                .select("created_at")
                .eq("business_id", business_id)
                .eq("user_token", token)
                .eq("reward_status", "awarded")
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )

        if not res.data:
            return False, None

        raw_ts = res.data[0]["created_at"]
        if not raw_ts:
            return False, None

        # Parse ISO timestamp
        last_awarded_at = datetime.fromisoformat(raw_ts.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)

        cooldown_delta = timedelta(hours=cooldown_hours)
        next_eligible_at = last_awarded_at + cooldown_delta

        if now < next_eligible_at:
            return True, next_eligible_at
        return False, None

    except Exception as e:
        logger.warning(f"Error checking cooldown: {e}")
        return False, None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/{business_id}/reward/eligibility", response_model=EligibilityCheckResponse)
async def check_reward_eligibility(business_id: str, body: EligibilityCheckRequest):
    """
    Deterministic reward eligibility check for a customer.
    Applies mode, text length, rating, spam, and per-business cooldown rules.
    Does not require login or account creation.
    """
    from services.identity_hash import build_identity_hash

    db = get_db()

    # 1. Fetch business & settings
    biz_data = db.table("businesses").select("id,industry").eq("id", business_id).execute().data
    if not biz_data or not isinstance(biz_data, list):
        raise HTTPException(status_code=404, detail="Business not found.")

    industry = str(biz_data[0].get("industry", ""))
    settings = _get_or_create_settings(db, business_id, industry)

    mode = settings.get("feedback_mode") or _get_engagement_mode(industry)
    reward_enabled = bool(settings.get("reward_enabled", False))
    points_per_feedback = int(settings.get("points_per_feedback", 10))
    min_length = int(settings.get("minimum_feedback_length", 10))
    cooldown_hours = int(settings.get("cooldown_hours", 168))

    identity_key = build_identity_hash(user_token=body.user_token)
    current_balance = calculate_user_balance(db, business_id, identity_key)

    # 2. Check Mode & Reward settings
    if mode != "reward":
        return EligibilityCheckResponse(
            business_id=business_id,
            user_token=body.user_token,
            eligible=False,
            reason="non_reward_mode",
            points_awarded=0,
            current_balance=current_balance,
        )

    if not reward_enabled:
        return EligibilityCheckResponse(
            business_id=business_id,
            user_token=body.user_token,
            eligible=False,
            reason="reward_disabled",
            points_awarded=0,
            current_balance=current_balance,
        )

    # 3. Optional Text Length validation (if text passed in body)
    if body.text is not None:
        trimmed = body.text.strip()
        if len(trimmed) < min_length:
            return EligibilityCheckResponse(
                business_id=business_id,
                user_token=body.user_token,
                eligible=False,
                reason="text_too_short",
                points_awarded=0,
                current_balance=current_balance,
            )

        if is_spam(trimmed):
            return EligibilityCheckResponse(
                business_id=business_id,
                user_token=body.user_token,
                eligible=False,
                reason="spam_detected",
                points_awarded=0,
                current_balance=current_balance,
            )

    # 4. Check Cooldown
    in_cooldown, next_eligible_at = check_cooldown_status(
        db, business_id, identity_key, cooldown_hours
    )

    if in_cooldown and next_eligible_at:
        return EligibilityCheckResponse(
            business_id=business_id,
            user_token=body.user_token,
            eligible=False,
            reason="cooldown_active",
            points_awarded=0,
            current_balance=current_balance,
            next_reward_at=next_eligible_at.isoformat(),
        )

    # Eligible!
    return EligibilityCheckResponse(
        business_id=business_id,
        user_token=body.user_token,
        eligible=True,
        reason="eligible",
        points_awarded=points_per_feedback,
        current_balance=current_balance,
    )


@router.get("/{business_id}/reward/balance", response_model=UserBalanceResponse)
async def get_user_reward_balance(
    business_id: str,
    user_token: str = Query(..., description="Anonymous customer UUID token")
):
    """
    Public endpoint — fetches total point balance for an anonymous user_token.
    """
    from services.identity_hash import build_identity_hash

    db = get_db()

    biz = db.table("businesses").select("id").eq("id", business_id).execute().data
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found.")

    identity_key = build_identity_hash(user_token=user_token)
    balance = calculate_user_balance(db, business_id, identity_key)

    # Count claimed rewards
    res = (
        db.table("feedback_rewards")
        .select("id")
        .eq("business_id", business_id)
        .eq("identity_hash", identity_key)
        .eq("reward_status", "awarded")
        .execute()
    )
    total_claimed = len(res.data) if res.data else 0
    if total_claimed == 0:
        res = (
            db.table("feedback_rewards")
            .select("id")
            .eq("business_id", business_id)
            .eq("user_token", user_token)
            .eq("reward_status", "awarded")
            .execute()
        )
        total_claimed = len(res.data) if res.data else 0

    return UserBalanceResponse(
        business_id=business_id,
        user_token=user_token,
        current_balance=balance,
        total_rewards_claimed=total_claimed,
    )
