"""
RoadmapAI — Closed-Loop Feedback Resolution Router (Phase 6)

Lifecycle:
  IDENTIFIED → ACTION_PLANNED → ACTION_TAKEN → FOLLOW_UP_SENT → IMPROVED / REOPENED

Follow-up is triggered by the business ACTION_TAKEN event (no cron).
Public follow-up URLs use secure single-use tokens only — never internal IDs.
"""
from __future__ import annotations

import uuid
import secrets
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel, Field
from database import get_db
from core.logging import get_logger
from core.ownership import assert_business_owner
from services.email_service import send_follow_up_email

logger = get_logger("routers.followup")
router = APIRouter(tags=["Closed-Loop Resolution"])

IMPROVEMENT_THRESHOLD = 70.0

VALID_LIFECYCLE_STATUSES = {
    "IDENTIFIED",
    "ACTION_PLANNED",
    "ACTION_TAKEN",
    "FOLLOW_UP_SENT",
    "IMPROVED",
    "REOPENED",
}

ALLOWED_TRANSITIONS = {
    "IDENTIFIED": {"ACTION_PLANNED", "ACTION_TAKEN"},
    "ACTION_PLANNED": {"ACTION_TAKEN"},
    "ACTION_TAKEN": {"FOLLOW_UP_SENT", "ACTION_TAKEN"},
    "FOLLOW_UP_SENT": {"IMPROVED", "REOPENED", "ACTION_TAKEN"},
    "IMPROVED": {"ACTION_PLANNED", "ACTION_TAKEN"},
    "REOPENED": {"ACTION_PLANNED", "ACTION_TAKEN", "FOLLOW_UP_SENT"},
    # Legacy aliases from earlier You Said / We Did UI
    "Open": {"ACTION_PLANNED", "ACTION_TAKEN", "IDENTIFIED"},
    "In Progress": {"ACTION_TAKEN", "ACTION_PLANNED"},
    "Resolved": {"IMPROVED", "ACTION_TAKEN"},
}

ACTIVE_ATTENTION_STATUSES = {
    "IDENTIFIED",
    "ACTION_PLANNED",
    "ACTION_TAKEN",
    "FOLLOW_UP_SENT",
    "REOPENED",
    "Open",
    "Investigating",
    "Planned",
    "In Progress",
}


class ActionRecordRequest(BaseModel):
    action_taken: str = Field(..., min_length=3, max_length=1000)
    status: Optional[str] = Field(
        default="ACTION_TAKEN",
        description="ACTION_PLANNED or ACTION_TAKEN",
    )


class FollowUpResponseRequest(BaseModel):
    response: str = Field(..., description="improved | somewhat_improved | not_improved")
    comment: Optional[str] = Field(default=None, max_length=1000)


def calculate_improvement_percentage(
    improved: int, somewhat: int, not_imp: int
) -> tuple[float, float]:
    """
    Effective Improvements = Improved + 0.5 × Somewhat Improved
    Improvement % = Effective Improvements / Total Responses × 100
    """
    total = improved + somewhat + not_imp
    if total == 0:
        return 0.0, 0.0
    effective = float(improved) + (0.5 * float(somewhat))
    percentage = round((effective / float(total)) * 100.0, 1)
    return effective, percentage


def evaluate_resolution_status(improvement_pct: float, response_count: int) -> str:
    """Apply 70% threshold once customers have responded."""
    if response_count <= 0:
        return "FOLLOW_UP_SENT"
    return "IMPROVED" if improvement_pct >= IMPROVEMENT_THRESHOLD else "REOPENED"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _issue_title(issue_key: str) -> str:
    return (issue_key or "issue").replace("_", " ").strip().title()


def _get_or_create_resolution_record(db, business_id: str, issue_key: str) -> dict:
    res = (
        db.table("issue_resolutions")
        .select("*")
        .eq("business_id", business_id)
        .eq("issue_key", issue_key)
        .execute()
        .data
    )
    if res:
        return res[0]

    now_iso = _now()
    init_row = {
        "id": str(uuid.uuid4()),
        "business_id": business_id,
        "issue_key": issue_key,
        "status": "IDENTIFIED",
        "you_said": f"Feedback regarding {_issue_title(issue_key)}",
        "we_did": None,
        "action_taken": None,
        "created_at": now_iso,
        "updated_at": now_iso,
        "contacted_count": 0,
        "response_count": 0,
        "improved_count": 0,
        "somewhat_improved_count": 0,
        "not_improved_count": 0,
        "is_public": True,
    }
    db.table("issue_resolutions").insert(init_row).execute()
    return init_row


def _session_ids_for_business(db, business_id: str) -> list[str]:
    rows = (
        db.table("sessions")
        .select("id")
        .eq("business_id", business_id)
        .execute()
        .data
        or []
    )
    return [str(r["id"]) for r in rows if r.get("id")]


def _collect_eligible_customers(
    db,
    business_id: str,
    *,
    allow_resend: bool = False,
) -> list[dict]:
    """
    Customers who left an email. Scoped to this business.
    allow_resend=True is used when a REOPENED issue gets a new ACTION_TAKEN.
    """
    submissions_q = (
        db.table("feedback_submissions")
        .select("id,customer_email,raw_text,follow_up_sent,follow_up_eligible")
        .eq("business_id", business_id)
        .not_.is_("customer_email", "null")
        .neq("customer_email", "")
    )
    if not allow_resend:
        submissions_q = submissions_q.eq("follow_up_sent", False)
    submissions = submissions_q.execute().data or []

    reviews: list[dict] = []
    session_ids = _session_ids_for_business(db, business_id)
    if session_ids:
        reviews_q = (
            db.table("reviews")
            .select("id,customer_email,raw_text,follow_up_sent,session_id")
            .in_("session_id", session_ids)
            .not_.is_("customer_email", "null")
            .neq("customer_email", "")
        )
        if not allow_resend:
            reviews_q = reviews_q.eq("follow_up_sent", False)
        reviews = reviews_q.execute().data or []

    eligible: list[dict] = []
    seen: set[str] = set()
    for item in list(submissions) + list(reviews):
        email = (item.get("customer_email") or "").strip().lower()
        if not email or email in seen:
            continue
        # Prefer explicitly eligible submissions when the flag exists
        if item.get("follow_up_eligible") is False:
            continue
        seen.add(email)
        eligible.append({**item, "customer_email": email})
    return eligible


def _dispatch_followups(
    db,
    *,
    business_id: str,
    business_name: str,
    issue_key: str,
    action_taken: str,
    res_record: dict,
    allow_resend: bool = False,
) -> dict:
    """Create single-use tokens and send follow-up emails (EMAIL_MODE aware)."""
    eligible_items = _collect_eligible_customers(
        db, business_id, allow_resend=allow_resend
    )
    if not eligible_items:
        return {
            "success": True,
            "eligible_count": 0,
            "sent_count": 0,
            "contacted_count": int(res_record.get("contacted_count") or 0),
            "status": res_record.get("status") or "ACTION_TAKEN",
            "message": "No customers provided an email for follow-up.",
            "followups_triggered": False,
        }

    tokens_created = 0
    now_iso = _now()
    issue_title = _issue_title(issue_key)

    for item in eligible_items:
        email = item["customer_email"]
        token_str = secrets.token_urlsafe(32)
        try:
            db.table("follow_up_tokens").insert({
                "token": token_str,
                "business_id": business_id,
                "issue_key": issue_key,
                "feedback_id": item.get("id"),
                "email": email,
                "is_used": False,
                "created_at": now_iso,
            }).execute()
        except Exception as e:
            logger.warning(f"Error creating follow-up token: {e}")
            continue

        send_follow_up_email(
            to_email=email,
            business_name=business_name,
            issue_title=issue_title,
            action_taken=action_taken,
            token=token_str,
        )
        tokens_created += 1

        item_id = item.get("id")
        if item_id:
            try:
                db.table("feedback_submissions").update(
                    {"follow_up_sent": True}
                ).eq("id", item_id).execute()
            except Exception:
                pass
            try:
                db.table("reviews").update(
                    {"follow_up_sent": True}
                ).eq("id", item_id).execute()
            except Exception:
                pass

    new_contacted = (int(res_record.get("contacted_count") or 0) + tokens_created)
    update_payload = {
        "status": "FOLLOW_UP_SENT",
        "follow_up_sent_at": now_iso,
        "contacted_count": new_contacted,
        "updated_at": now_iso,
        "resolved_at": None,
    }
    # New action cycle after reopen / improved redo: reset response tallies
    if allow_resend:
        update_payload.update({
            "response_count": 0,
            "improved_count": 0,
            "somewhat_improved_count": 0,
            "not_improved_count": 0,
            "improvement_percentage": None,
        })

    db.table("issue_resolutions").update(update_payload).eq(
        "id", res_record["id"]
    ).execute()

    return {
        "success": True,
        "eligible_count": len(eligible_items),
        "sent_count": tokens_created,
        "contacted_count": new_contacted,
        "status": "FOLLOW_UP_SENT",
        "message": f"Successfully sent {tokens_created} follow-up requests.",
        "followups_triggered": tokens_created > 0,
    }


@router.post("/business/{business_id}/issues/{issue_key}/action")
async def record_business_action(
    business_id: str,
    issue_key: str,
    body: ActionRecordRequest,
    request: Request,
    x_owner_token: Optional[str] = Header(None),
):
    """
    Business records what they actually did.
    On ACTION_TAKEN, follow-up emails are triggered immediately when customer emails exist.
    """
    db = get_db()
    assert_business_owner(business_id, request=request, x_owner_token=x_owner_token, db=db)

    biz = (
        db.table("businesses")
        .select("id,business_name")
        .eq("id", business_id)
        .execute()
        .data
    )
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found.")

    target_status = body.status or "ACTION_TAKEN"
    if target_status not in {"ACTION_PLANNED", "ACTION_TAKEN"}:
        raise HTTPException(
            status_code=422,
            detail="status must be ACTION_PLANNED or ACTION_TAKEN when recording an action.",
        )

    res_record = _get_or_create_resolution_record(db, business_id, issue_key)
    current_status = res_record.get("status", "IDENTIFIED")

    allowed = ALLOWED_TRANSITIONS.get(
        current_status, {"ACTION_PLANNED", "ACTION_TAKEN"}
    )
    if target_status not in allowed:
        raise HTTPException(
            status_code=422,
            detail=f"Cannot transition issue from '{current_status}' to '{target_status}'.",
        )

    now_iso = _now()
    action_text = body.action_taken.strip()
    update_data = {
        "action_taken": action_text,
        "we_did": action_text,
        "status": target_status,
        "updated_at": now_iso,
        "you_said": res_record.get("you_said")
        or f"Feedback regarding {_issue_title(issue_key)}",
    }
    if target_status == "ACTION_TAKEN":
        update_data["action_taken_at"] = now_iso

    db.table("issue_resolutions").update(update_data).eq(
        "id", res_record["id"]
    ).execute()
    res_record = {**res_record, **update_data}

    logger.info(
        f"Action recorded: biz={business_id} issue={issue_key} "
        f"status={target_status} action='{action_text[:80]}'"
    )

    followup_result = None
    if target_status == "ACTION_TAKEN":
        allow_resend = current_status in {"REOPENED", "IMPROVED", "FOLLOW_UP_SENT"}
        followup_result = _dispatch_followups(
            db,
            business_id=business_id,
            business_name=biz[0]["business_name"],
            issue_key=issue_key,
            action_taken=action_text,
            res_record=res_record,
            allow_resend=allow_resend,
        )

    final_status = (
        followup_result.get("status") if followup_result else target_status
    )

    return {
        "success": True,
        "business_id": business_id,
        "issue_key": issue_key,
        "status": final_status,
        "action_taken": action_text,
        "action_taken_at": update_data.get("action_taken_at", now_iso),
        "followup": followup_result,
        "requires_attention": final_status in ACTIVE_ATTENTION_STATUSES
        or final_status == "REOPENED",
    }


@router.post("/business/{business_id}/issues/{issue_key}/send-followups")
async def send_followup_requests(
    business_id: str,
    issue_key: str,
    request: Request,
    x_owner_token: Optional[str] = Header(None),
):
    """
    Manual follow-up send (also invoked automatically on ACTION_TAKEN).
    Advances status to FOLLOW_UP_SENT when emails are delivered.
    """
    db = get_db()
    assert_business_owner(business_id, request=request, x_owner_token=x_owner_token, db=db)

    biz = (
        db.table("businesses")
        .select("id,business_name")
        .eq("id", business_id)
        .execute()
        .data
    )
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found.")

    res_record = _get_or_create_resolution_record(db, business_id, issue_key)
    current = res_record.get("status", "IDENTIFIED")
    if current not in {
        "ACTION_TAKEN",
        "FOLLOW_UP_SENT",
        "REOPENED",
        "ACTION_PLANNED",
        "IMPROVED",
    }:
        # Allow from ACTION_PLANNED only if action text already recorded
        if not (res_record.get("action_taken") or res_record.get("we_did")):
            raise HTTPException(
                status_code=422,
                detail="Record ACTION_TAKEN before sending follow-ups.",
            )

    action_taken = (
        res_record.get("action_taken")
        or res_record.get("we_did")
        or "Actions taken to resolve issue"
    )
    allow_resend = current in {"REOPENED", "IMPROVED", "FOLLOW_UP_SENT"}
    return _dispatch_followups(
        db,
        business_id=business_id,
        business_name=biz[0]["business_name"],
        issue_key=issue_key,
        action_taken=action_taken,
        res_record=res_record,
        allow_resend=allow_resend,
    )


@router.get("/follow-up/{token}")
async def get_followup_context(token: str):
    """
    Public endpoint — follow-up page context.
    Never exposes internal business/issue/feedback IDs.
    """
    db = get_db()

    tokens = (
        db.table("follow_up_tokens").select("*").eq("token", token).execute().data
    )
    if not tokens:
        raise HTTPException(status_code=404, detail="Invalid or expired follow-up link.")

    token_data = tokens[0]
    if token_data.get("is_used"):
        return {
            "already_submitted": True,
            "message": "Thank you! You have already submitted your response for this follow-up.",
        }

    biz_id = token_data["business_id"]
    issue_key = token_data["issue_key"]

    biz = (
        db.table("businesses")
        .select("business_name")
        .eq("id", biz_id)
        .execute()
        .data
    )
    biz_name = biz[0]["business_name"] if biz else "Business"
    res_record = _get_or_create_resolution_record(db, biz_id, issue_key)

    return {
        "already_submitted": False,
        "business_name": biz_name,
        "issue_title": _issue_title(issue_key),
        "action_taken": res_record.get("action_taken")
        or res_record.get("we_did")
        or "Actions taken to resolve this issue",
        "token": token,
        "question": "Has your experience improved?",
    }


@router.post("/follow-up/{token}/response")
async def submit_followup_response(token: str, body: FollowUpResponseRequest):
    """
    Public endpoint — store improvement response.
    Single-use token prevents duplicate responses.
    """
    if body.response not in {"improved", "somewhat_improved", "not_improved"}:
        raise HTTPException(
            status_code=400,
            detail="Response must be one of: 'improved', 'somewhat_improved', 'not_improved'.",
        )

    db = get_db()

    tokens = (
        db.table("follow_up_tokens").select("*").eq("token", token).execute().data
    )
    if not tokens:
        raise HTTPException(status_code=404, detail="Invalid or expired follow-up link.")

    token_data = tokens[0]
    if token_data.get("is_used"):
        raise HTTPException(
            status_code=400, detail="This follow-up link has already been used."
        )

    now_iso = _now()
    biz_id = token_data["business_id"]
    issue_key = token_data["issue_key"]

    db.table("follow_up_tokens").update({
        "is_used": True,
        "used_at": now_iso,
    }).eq("token", token).execute()

    db.table("follow_up_responses").insert({
        "id": str(uuid.uuid4()),
        "business_id": biz_id,
        "issue_key": issue_key,
        "feedback_id": token_data.get("feedback_id"),
        "response": body.response,
        "comment": body.comment.strip() if body.comment else None,
        "submitted_at": now_iso,
    }).execute()

    res_record = _get_or_create_resolution_record(db, biz_id, issue_key)
    resp_type = body.response
    imp_c = int(res_record.get("improved_count") or 0) + (
        1 if resp_type == "improved" else 0
    )
    som_c = int(res_record.get("somewhat_improved_count") or 0) + (
        1 if resp_type == "somewhat_improved" else 0
    )
    not_c = int(res_record.get("not_improved_count") or 0) + (
        1 if resp_type == "not_improved" else 0
    )
    tot_c = int(res_record.get("response_count") or 0) + 1

    _, imp_pct = calculate_improvement_percentage(imp_c, som_c, not_c)
    new_status = evaluate_resolution_status(imp_pct, tot_c)

    db.table("issue_resolutions").update({
        "response_count": tot_c,
        "improved_count": imp_c,
        "somewhat_improved_count": som_c,
        "not_improved_count": not_c,
        "improvement_percentage": imp_pct,
        "status": new_status,
        "resolved_at": now_iso if new_status == "IMPROVED" else None,
        "updated_at": now_iso,
    }).eq("id", res_record["id"]).execute()

    logger.info(
        f"Follow-up response: biz={biz_id} issue={issue_key} "
        f"response={resp_type} pct={imp_pct}% status={new_status}"
    )

    return {
        "success": True,
        "message": "Thank you! Your response helps us measure whether the improvement worked.",
        "improvement_percentage": imp_pct,
        "status": new_status,
        "requires_attention": new_status == "REOPENED",
    }


@router.get("/business/{business_id}/issues/{issue_key}/resolution")
async def get_issue_resolution_impact(
    business_id: str,
    issue_key: str,
    request: Request,
    x_owner_token: Optional[str] = Header(None),
):
    """Workspace endpoint — resolution impact + whether issue needs attention."""
    db = get_db()
    assert_business_owner(business_id, request=request, x_owner_token=x_owner_token, db=db)

    biz = db.table("businesses").select("id").eq("id", business_id).execute().data
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found.")

    res_record = _get_or_create_resolution_record(db, business_id, issue_key)

    contacted = int(res_record.get("contacted_count") or 0)
    responses = int(res_record.get("response_count") or 0)
    improved = int(res_record.get("improved_count") or 0)
    somewhat = int(res_record.get("somewhat_improved_count") or 0)
    not_improved = int(res_record.get("not_improved_count") or 0)

    resp_rate = (
        round((float(responses) / float(contacted)) * 100.0, 1) if contacted > 0 else 0.0
    )
    effective, imp_pct = calculate_improvement_percentage(
        improved, somewhat, not_improved
    )
    status = res_record.get("status", "IDENTIFIED")
    is_reopened = status == "REOPENED"

    return {
        "business_id": business_id,
        "issue_key": issue_key,
        "status": status,
        "action_taken": res_record.get("action_taken") or res_record.get("we_did"),
        "action_taken_at": res_record.get("action_taken_at"),
        "follow_up_sent_at": res_record.get("follow_up_sent_at"),
        "contacted_count": contacted,
        "response_count": responses,
        "response_rate": resp_rate,
        "improved_count": improved,
        "somewhat_improved_count": somewhat,
        "not_improved_count": not_improved,
        "effective_improvements": effective,
        "improvement_percentage": imp_pct,
        "is_reopened": is_reopened,
        "requires_attention": is_reopened or status in ACTIVE_ATTENTION_STATUSES,
        "threshold": IMPROVEMENT_THRESHOLD,
    }


@router.get("/business/{business_id}/resolutions/active")
async def list_active_attention_issues(
    business_id: str,
    request: Request,
    x_owner_token: Optional[str] = Header(None),
):
    """
    Issues that still need attention — includes REOPENED (must stay active).
    IMPROVED issues are excluded.
    """
    db = get_db()
    assert_business_owner(business_id, request=request, x_owner_token=x_owner_token, db=db)
    biz = db.table("businesses").select("id").eq("id", business_id).execute().data
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found.")

    rows = (
        db.table("issue_resolutions")
        .select("*")
        .eq("business_id", business_id)
        .neq("status", "IMPROVED")
        .order("updated_at", desc=True)
        .execute()
        .data
        or []
    )

    # Ensure REOPENED sorts first for Decision Center attention
    rows.sort(
        key=lambda r: (
            0 if r.get("status") == "REOPENED" else 1,
            r.get("updated_at") or "",
        )
    )
    return {
        "business_id": business_id,
        "issues": rows,
        "reopened_count": sum(1 for r in rows if r.get("status") == "REOPENED"),
    }
