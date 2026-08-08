"""
Feedback Closure System — YOU SAID → WE DID Router (Phase 5)
Endpoints:
- GET   /business/{business_id}/resolutions          → Workspace endpoint to list all issue resolutions
- POST  /business/{business_id}/resolutions          → Create or upsert an issue resolution
- PATCH /business/{business_id}/resolutions/{id}     → Update status, resolution message, or public visibility
- GET   /feedback/{business_id}/updates              → Public customer-facing "You Said → We Did" feed (Zero PII/AI Exposure)

Statuses Supported:
  Open | Investigating | Planned | In Progress | Resolved
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel, Field
from database import get_db
from core.logging import get_logger
from core.ownership import assert_business_owner

logger = get_logger("routers.resolutions")
router = APIRouter(tags=["Feedback Closure"])


# ── Schemas ───────────────────────────────────────────────────────────────────

VALID_STATUSES = {"Open", "Investigating", "Planned", "In Progress", "Resolved"}


class CreateResolutionRequest(BaseModel):
    issue_key: str = Field(..., description="Unique issue key (e.g., PAYMENT_FAILURE, CHECKOUT_DELAY)")
    you_said: str = Field(..., min_length=5, max_length=500, description="Customer issue summary (e.g. Checkout queue is too long)")
    we_did: Optional[str] = Field(default=None, max_length=500, description="Action taken by business")
    status: str = Field(default="Open", description="Open | Investigating | Planned | In Progress | Resolved")
    is_public: bool = Field(default=True)


class UpdateResolutionRequest(BaseModel):
    status: Optional[str] = Field(default=None)
    we_did: Optional[str] = Field(default=None, max_length=500)
    you_said: Optional[str] = Field(default=None, max_length=500)
    is_public: Optional[bool] = None


class PublicResolutionItem(BaseModel):
    id: str
    issue_key: str
    status: str
    you_said: str
    we_did: Optional[str] = None
    updated_at: str
    resolved_at: Optional[str] = None


class PublicUpdatesResponse(BaseModel):
    business_id: str
    business_name: str
    updates: List[PublicResolutionItem]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/business/{business_id}/resolutions")
async def list_workspace_resolutions(
    business_id: str,
    request: Request,
    x_owner_token: Optional[str] = Header(None),
):
    """
    Workspace endpoint — returns all issue resolutions for a business.
    Used by business owner in Decision Center / Roadmap management UI.
    """
    db = get_db()
    assert_business_owner(business_id, request=request, x_owner_token=x_owner_token, db=db)

    res = (
        db.table("issue_resolutions")
        .select("*")
        .eq("business_id", business_id)
        .order("updated_at", desc=True)
        .execute()
    )

    return res.data or []


@router.post("/business/{business_id}/resolutions")
async def create_or_update_resolution(
    business_id: str,
    body: CreateResolutionRequest,
    request: Request,
    x_owner_token: Optional[str] = Header(None),
):
    """
    Workspace endpoint — creates or updates an issue resolution.
    """
    db = get_db()
    assert_business_owner(business_id, request=request, x_owner_token=x_owner_token, db=db)

    if body.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid status. Must be one of: {', '.join(sorted(VALID_STATUSES))}"
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    resolved_at = now_iso if body.status == "Resolved" else None

    # Check if a resolution already exists for this issue_key
    existing = (
        db.table("issue_resolutions")
        .select("id")
        .eq("business_id", business_id)
        .eq("issue_key", body.issue_key)
        .execute()
        .data
    )

    if existing:
        res_id = existing[0]["id"]
        update_data = {
            "status": body.status,
            "you_said": body.you_said,
            "is_public": body.is_public,
            "updated_at": now_iso,
        }
        if body.we_did is not None:
            update_data["we_did"] = body.we_did
        if resolved_at:
            update_data["resolved_at"] = resolved_at

        db.table("issue_resolutions").update(update_data).eq("id", res_id).execute()
        result = {
            "id": res_id,
            "business_id": business_id,
            "issue_key": body.issue_key,
            "status": body.status,
            "you_said": body.you_said,
            "we_did": body.we_did or "",
            "is_public": body.is_public,
            "updated_at": now_iso,
            "resolved_at": resolved_at,
        }
    else:
        res_id = str(uuid.uuid4())
        new_row = {
            "id": res_id,
            "business_id": business_id,
            "issue_key": body.issue_key,
            "status": body.status,
            "you_said": body.you_said,
            "we_did": body.we_did or "",
            "is_public": body.is_public,
            "created_at": now_iso,
            "updated_at": now_iso,
            "resolved_at": resolved_at,
        }
        db.table("issue_resolutions").insert(new_row).execute()
        result = new_row

    logger.info(f"Resolution saved: business={business_id} issue={body.issue_key} status={body.status}")
    return result


@router.patch("/business/{business_id}/resolutions/{resolution_id}")
async def update_resolution(
    business_id: str,
    resolution_id: str,
    body: UpdateResolutionRequest,
    request: Request,
    x_owner_token: Optional[str] = Header(None),
):
    """
    Workspace endpoint — update issue status, resolution message, or visibility.
    """
    db = get_db()
    assert_business_owner(business_id, request=request, x_owner_token=x_owner_token, db=db)

    updates = {}
    if body.status is not None:
        if body.status not in VALID_STATUSES:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid status. Must be one of: {', '.join(sorted(VALID_STATUSES))}"
            )
        updates["status"] = body.status
        if body.status == "Resolved":
            updates["resolved_at"] = datetime.now(timezone.utc).isoformat()

    if body.we_did is not None:
        updates["we_did"] = body.we_did
    if body.you_said is not None:
        updates["you_said"] = body.you_said
    if body.is_public is not None:
        updates["is_public"] = body.is_public

    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update.")

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    res = (
        db.table("issue_resolutions")
        .update(updates)
        .eq("id", resolution_id)
        .eq("business_id", business_id)
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="Resolution not found.")

    return res.data[0]


@router.get("/feedback/{business_id}/updates", response_model=PublicUpdatesResponse)
async def get_public_feedback_updates(business_id: str):
    """
    PUBLIC Customer-Facing Endpoint — returns business-approved 'YOU SAID → WE DID' resolutions.
    Zero internal AI terminology, zero revenue metrics, zero customer PII exposed!
    Only displays business-approved public resolution items.
    """
    db = get_db()

    biz = db.table("businesses").select("id,business_name").eq("id", business_id).execute().data
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found.")

    rows = (
        db.table("issue_resolutions")
        .select("id,issue_key,status,you_said,we_did,updated_at,resolved_at")
        .eq("business_id", business_id)
        .eq("is_public", True)
        .order("updated_at", desc=True)
        .execute()
        .data or []
    )

    updates = []
    for r in rows:
        updates.append(PublicResolutionItem(
            id=str(r["id"]),
            issue_key=r["issue_key"],
            status=r["status"],
            you_said=r["you_said"],
            we_did=r.get("we_did") or None,
            updated_at=str(r.get("updated_at", "")),
            resolved_at=r.get("resolved_at") or None,
        ))

    return PublicUpdatesResponse(
        business_id=business_id,
        business_name=biz[0]["business_name"],
        updates=updates,
    )
