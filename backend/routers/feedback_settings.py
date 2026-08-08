"""
Feedback Engagement Settings Router — Phase 1
GET  /business/{business_id}/feedback-settings  → Returns current settings (auto-creates defaults)
PATCH /business/{business_id}/feedback-settings → Updates one or more settings fields

Architecture:
  One feedback_engagement_settings row per business.
  First GET auto-creates defaults based on industry.
  PATCH is partial — only supplied fields are updated.
  Business owner can override the default mode at any time.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator
from database import get_db
from core.logging import get_logger

logger = get_logger("routers.feedback_settings")
router = APIRouter(prefix="/business", tags=["Feedback Settings"])

# ── Industry → default settings mapping ──────────────────────────────────────
# Transactional (high-volume, points incentive)
REWARD_INDUSTRIES = {"Supermarket", "Hotel", "Restaurant", "E-commerce", "Hostel"}
# Institutional (trust-based, no gamification)
IMPROVEMENT_INDUSTRIES = {"Hospital", "School", "University", "Bank", "Clinic", "NGO"}
# Product/digital (roadmap influence)
PRODUCT_INDUSTRIES = {"Mobile App", "SaaS"}


def _build_defaults(industry: str) -> dict:
    """
    Returns a dictionary of default settings for a given industry.
    These are sensible starting points — the business can always override.
    """
    if industry in REWARD_INDUSTRIES:
        return {
            "feedback_mode":           "reward",
            "reward_enabled":          True,
            "points_per_feedback":     10,
            "cooldown_hours":          168,   # 1 week
            "minimum_feedback_length": 10,
            "reward_threshold":        100,
            "reward_description":      "Loyalty points redeemable at your next visit",
            "feedback_message":        f"Share your experience and earn loyalty points!",
        }
    if industry in IMPROVEMENT_INDUSTRIES:
        return {
            "feedback_mode":           "improvement",
            "reward_enabled":          False,
            "points_per_feedback":     0,
            "cooldown_hours":          0,     # No cooldown — institutional context
            "minimum_feedback_length": 20,
            "reward_threshold":        0,
            "reward_description":      "",
            "feedback_message":        "Your feedback is confidential and helps us serve you better.",
        }
    # Default: product mode (SaaS, Mobile App, and fallback)
    return {
        "feedback_mode":           "product",
        "reward_enabled":          False,
        "points_per_feedback":     0,
        "cooldown_hours":          24,
        "minimum_feedback_length": 15,
        "reward_threshold":        0,
        "reward_description":      "",
        "feedback_message":        "Your feedback directly shapes our product roadmap.",
    }


# ── Pydantic Schemas ──────────────────────────────────────────────────────────

class FeedbackEngagementSettings(BaseModel):
    """Full settings response model."""
    id: str
    business_id: str
    feedback_mode: str
    reward_enabled: bool
    points_per_feedback: int
    cooldown_hours: int
    minimum_feedback_length: int
    reward_threshold: int
    reward_description: str
    feedback_message: str
    created_at: str
    updated_at: str

    # Derived display field (not stored)
    mode_label: str = ""
    mode_icon: str = ""

    def model_post_init(self, __context) -> None:
        labels = {
            "reward":      ("Reward Mode",      "🎁"),
            "improvement": ("Improvement Mode", "💬"),
            "product":     ("Product Mode",     "🚀"),
        }
        label, icon = labels.get(self.feedback_mode, ("Custom Mode", "⚙️"))
        object.__setattr__(self, "mode_label", label)
        object.__setattr__(self, "mode_icon", icon)


class FeedbackSettingsUpdate(BaseModel):
    """PATCH request — all fields optional. Only supplied fields are updated."""

    feedback_mode: Optional[str] = Field(
        default=None,
        description="reward | improvement | product"
    )
    reward_enabled: Optional[bool] = None
    points_per_feedback: Optional[int] = Field(
        default=None, ge=1, le=10000,
        description="Points awarded per valid feedback submission"
    )
    cooldown_hours: Optional[int] = Field(
        default=None, ge=0, le=8760,
        description="Hours a customer must wait before submitting again (0 = no limit)"
    )
    minimum_feedback_length: Optional[int] = Field(
        default=None, ge=5, le=500,
        description="Minimum characters required for feedback to be accepted"
    )
    reward_threshold: Optional[int] = Field(
        default=None, ge=0, le=100000,
        description="Total points needed to redeem a reward"
    )
    reward_description: Optional[str] = Field(
        default=None, max_length=300,
        description="What the customer receives when they reach the reward threshold"
    )
    feedback_message: Optional[str] = Field(
        default=None, max_length=400,
        description="Message shown to customer on the feedback form"
    )

    @model_validator(mode="after")
    def validate_mode(self) -> "FeedbackSettingsUpdate":
        valid_modes = {"reward", "improvement", "product"}
        if self.feedback_mode is not None and self.feedback_mode not in valid_modes:
            raise ValueError(
                f"feedback_mode must be one of: {', '.join(sorted(valid_modes))}"
            )
        # Business logic: if mode is not reward, warn but don't block
        # (business may enable reward later)
        return self

    model_config = {
        "json_schema_extra": {
            "example": {
                "feedback_mode": "reward",
                "reward_enabled": True,
                "points_per_feedback": 15,
                "cooldown_hours": 72,
                "minimum_feedback_length": 20,
                "reward_threshold": 150,
                "reward_description": "Free coffee on your next visit",
                "feedback_message": "Share your experience and earn a free coffee!",
            }
        }
    }


# ── Helper: get or create settings row ───────────────────────────────────────

def _get_or_create_settings(db, business_id: str, industry: str) -> dict:
    """
    Fetch existing settings, or auto-create with industry defaults.
    Returns the settings row dict.
    """
    existing = (
        db.table("feedback_engagement_settings")
        .select("*")
        .eq("business_id", business_id)
        .execute()
        .data
    )
    if existing:
        return existing[0]

    # Auto-create with defaults
    defaults = _build_defaults(industry)
    import uuid as _uuid
    new_row = {
        "id":          str(_uuid.uuid4()),
        "business_id": business_id,
        **defaults,
    }
    result = (
        db.table("feedback_engagement_settings")
        .insert(new_row)
        .execute()
    )
    if result.data:
        return result.data[0]
    return new_row


def _row_to_response(row: dict) -> FeedbackEngagementSettings:
    return FeedbackEngagementSettings(
        id=str(row["id"]),
        business_id=str(row["business_id"]),
        feedback_mode=row.get("feedback_mode", "product"),
        reward_enabled=bool(row.get("reward_enabled", False)),
        points_per_feedback=int(row.get("points_per_feedback", 10)),
        cooldown_hours=int(row.get("cooldown_hours", 168)),
        minimum_feedback_length=int(row.get("minimum_feedback_length", 10)),
        reward_threshold=int(row.get("reward_threshold", 100)),
        reward_description=row.get("reward_description", "") or "",
        feedback_message=row.get("feedback_message", "") or "",
        created_at=str(row.get("created_at", "")),
        updated_at=str(row.get("updated_at", "")),
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/{business_id}/feedback-settings", response_model=FeedbackEngagementSettings)
async def get_feedback_settings(business_id: str):
    """
    Returns the feedback engagement settings for a business.
    If no settings exist yet, auto-creates them using industry defaults.
    This means the first visit to Settings page always works.
    """
    db = get_db()

    # Validate business exists and get industry
    biz = (
        db.table("businesses")
        .select("id,industry")
        .eq("id", business_id)
        .execute()
        .data
    )
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found.")

    industry = biz[0]["industry"]
    row = _get_or_create_settings(db, business_id, industry)

    logger.info(f"Fetched feedback settings: business={business_id} mode={row.get('feedback_mode')}")
    return _row_to_response(row)


@router.patch("/{business_id}/feedback-settings", response_model=FeedbackEngagementSettings)
async def update_feedback_settings(business_id: str, body: FeedbackSettingsUpdate):
    """
    Partially update feedback engagement settings.
    Only fields included in the request body are updated.
    Missing fields retain their current values.

    The business owner can change the mode at any time — even away from the industry default.
    Validation ensures reward-specific fields are sane.
    """
    db = get_db()

    # Validate business exists
    biz = (
        db.table("businesses")
        .select("id,industry")
        .eq("id", business_id)
        .execute()
        .data
    )
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found.")

    industry = biz[0]["industry"]

    # Ensure settings row exists (auto-create if first time)
    _get_or_create_settings(db, business_id, industry)

    # Build update dict — only non-None fields
    updates = {k: v for k, v in body.model_dump().items() if v is not None}

    if not updates:
        raise HTTPException(
            status_code=422,
            detail="No fields to update. Provide at least one field."
        )

    # Business logic validation
    mode = updates.get("feedback_mode")
    reward_enabled = updates.get("reward_enabled")

    if mode == "improvement" and reward_enabled is True:
        raise HTTPException(
            status_code=422,
            detail="Improvement mode is designed for institutional settings. "
                   "Enabling rewards in improvement mode is not recommended. "
                   "Switch to reward mode first, or use product mode."
        )

    # Always update the timestamp
    from datetime import datetime, timezone
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = (
        db.table("feedback_engagement_settings")
        .update(updates)
        .eq("business_id", business_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Settings not found for this business.")

    row = result.data[0]
    logger.info(
        f"Updated feedback settings: business={business_id} "
        f"fields={list(updates.keys())} mode={row.get('feedback_mode')}"
    )
    return _row_to_response(row)
