"""
RoadmapAI — Closed-Loop Feedback Resolution Router
Implements the issue state machine:
  IDENTIFIED -> ACTION_PLANNED -> ACTION_TAKEN -> FOLLOW_UP_SENT -> IMPROVED / REOPENED

Endpoints:
- POST /business/{business_id}/issues/{issue_key}/action
- POST /business/{business_id}/issues/{issue_key}/send-followups
- GET  /follow-up/{token} (Public)
- POST /follow-up/{token}/response (Public)
- GET  /business/{business_id}/issues/{issue_key}/resolution
"""
import uuid
import secrets
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from database import get_db
from core.logging import get_logger
from services.email_service import send_follow_up_email

logger = get_logger("routers.followup")
router = APIRouter(tags=["Closed-Loop Resolution"])

# Threshold configuration
IMPROVEMENT_THRESHOLD = 70.0  # 70% threshold for IMPROVED vs REOPENED status

VALID_LIFECYCLE_STATUSES = {
    "IDENTIFIED",
    "ACTION_PLANNED",
    "ACTION_TAKEN",
    "FOLLOW_UP_SENT",
    "IMPROVED",
    "REOPENED",
}

# Allowed transition graph
ALLOWED_TRANSITIONS = {
    "IDENTIFIED": {"ACTION_PLANNED", "ACTION_TAKEN"},
    "ACTION_PLANNED": {"ACTION_TAKEN"},
    "ACTION_TAKEN": {"FOLLOW_UP_SENT"},
    "FOLLOW_UP_SENT": {"IMPROVED", "REOPENED"},
    "IMPROVED": {"ACTION_PLANNED", "ACTION_TAKEN"},
    "REOPENED": {"ACTION_PLANNED", "ACTION_TAKEN", "FOLLOW_UP_SENT"},
    # Standard compatibility aliases
    "Open": {"ACTION_PLANNED", "ACTION_TAKEN", "IDENTIFIED"},
    "In Progress": {"ACTION_TAKEN", "ACTION_PLANNED"},
    "Resolved": {"IMPROVED", "ACTION_TAKEN"},
}


# ── Schemas ───────────────────────────────────────────────────────────────────

class ActionRecordRequest(BaseModel):
    action_taken: str = Field(..., min_length=3, max_length=1000, description="Real-world business action taken")
    status: Optional[str] = Field(default="ACTION_TAKEN", description="ACTION_PLANNED or ACTION_TAKEN")


class FollowUpResponseRequest(BaseModel):
    response: str = Field(..., description="improved | somewhat_improved | not_improved")
    comment: Optional[str] = Field(default=None, max_length=1000)


# ── Helper Utilities ──────────────────────────────────────────────────────────

def calculate_improvement_percentage(improved: int, somewhat: int, not_imp: int) -> tuple[float, float]:
    """
    Calculates effective improvement and percentage according to specification:
    effective_improvements = improved + (0.5 * somewhat)
    improvement_percentage = (effective_improvements / total_responses) * 100
    """
    total = improved + somewhat + not_imp
    if total == 0:
        return 0.0, 0.0
    effective = float(improved) + (0.5 * float(somewhat))
    percentage = round((effective / float(total)) * 100.0, 1)
    return effective, percentage


def _get_or_create_resolution_record(db, business_id: str, issue_key: str) -> dict:
    """Helper to fetch or initialize an issue resolution record."""
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

    # Initialize new record if none exists
    new_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    init_row = {
        "id": new_id,
        "business_id": business_id,
        "issue_key": issue_key,
        "status": "IDENTIFIED",
        "you_said": f"Feedback regarding issue {issue_key}",
        "we_did": None,
        "action_taken": None,
        "created_at": now_iso,
        "updated_at": now_iso,
        "contacted_count": 0,
        "response_count": 0,
        "improved_count": 0,
        "somewhat_improved_count": 0,
        "not_improved_count": 0,
    }
    db.table("issue_resolutions").insert(init_row).execute()
    return init_row


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/business/{business_id}/issues/{issue_key}/action")
async def record_business_action(business_id: str, issue_key: str, body: ActionRecordRequest):
    """
    Records a real-world business action against an issue and updates status to ACTION_TAKEN (or ACTION_PLANNED).
    Validates business ownership and state transitions.
    """
    db = get_db()

    # Validate business ownership
    biz = db.table("businesses").select("id,business_name").eq("id", business_id).execute().data
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found.")

    if body.status and body.status not in VALID_LIFECYCLE_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid status '{body.status}'. Must be one of: {', '.join(sorted(VALID_LIFECYCLE_STATUSES))}"
        )

    res_record = _get_or_create_resolution_record(db, business_id, issue_key)
    current_status = res_record.get("status", "IDENTIFIED")
    target_status = body.status or "ACTION_TAKEN"

    # State machine transition validation
    allowed = ALLOWED_TRANSITIONS.get(current_status, {"ACTION_PLANNED", "ACTION_TAKEN"})
    if target_status not in allowed and current_status not in {"IDENTIFIED", "Open", "REOPENED"}:
        raise HTTPException(
            status_code=422,
            detail=f"Cannot transition issue from '{current_status}' to '{target_status}'."
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    update_data = {
        "action_taken": body.action_taken.strip(),
        "we_did": body.action_taken.strip(),
        "status": target_status,
        "updated_at": now_iso,
    }
    if target_status == "ACTION_TAKEN":
        update_data["action_taken_at"] = now_iso

    db.table("issue_resolutions").update(update_data).eq("id", res_record["id"]).execute()

    logger.info(f"Action recorded: biz={business_id} issue={issue_key} action='{body.action_taken}'")

    return {
        "success": True,
        "business_id": business_id,
        "issue_key": issue_key,
        "status": target_status,
        "action_taken": body.action_taken,
        "action_taken_at": update_data.get("action_taken_at", now_iso),
    }


@router.post("/business/{business_id}/issues/{issue_key}/send-followups")
async def send_followup_requests(business_id: str, issue_key: str):
    """
    Finds customers who voluntarily provided an email for follow-up on this issue.
    Generates secure single-use tokens and sends follow-up requests.
    Advances status to FOLLOW_UP_SENT.
    """
    db = get_db()

    biz = db.table("businesses").select("id,business_name").eq("id", business_id).execute().data
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found.")
    business_name = biz[0]["business_name"]

    res_record = _get_or_create_resolution_record(db, business_id, issue_key)
    action_taken = res_record.get("action_taken") or res_record.get("we_did") or "Actions taken to resolve issue"

    # Query eligible feedback from submissions buffer & reviews table
    # Condition: business_id matches AND customer_email IS NOT NULL AND follow_up_sent == False
    submissions = (
        db.table("feedback_submissions")
        .select("id,customer_email,raw_text")
        .eq("business_id", business_id)
        .not_.is_("customer_email", "null")
        .neq("customer_email", "")
        .eq("follow_up_sent", False)
        .execute()
        .data or []
    )

    reviews = (
        db.table("reviews")
        .select("id,customer_email,raw_text")
        .not_.is_("customer_email", "null")
        .neq("customer_email", "")
        .eq("follow_up_sent", False)
        .execute()
        .data or []
    )

    # Combine unique eligible emails
    eligible_items = []
    seen_emails = set()

    for item in submissions + reviews:
        email = item.get("customer_email")
        if email and email.strip() and email not in seen_emails:
            seen_emails.add(email)
            eligible_items.append(item)

    if not eligible_items:
        return {
            "success": True,
            "eligible_count": 0,
            "message": "No customers provided an email for follow-up.",
            "contacted_count": res_record.get("contacted_count", 0),
            "status": res_record.get("status", "ACTION_TAKEN"),
        }

    # Generate single-use tokens & send emails
    tokens_created = 0
    now_iso = datetime.now(timezone.utc).isoformat()

    for item in eligible_items:
        email = item["customer_email"]
        token_str = secrets.token_urlsafe(32)

        # Store token
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
            logger.warning(f"Error creating token row: {e}")
            continue

        # Send email (console mode prints follow-up link)
        send_follow_up_email(
            to_email=email,
            business_name=business_name,
            issue_title=issue_key.replace("_", " ").title(),
            action_taken=action_taken,
            token=token_str,
        )
        tokens_created += 1

        # Mark follow_up_sent = True on submission/review
        if "id" in item:
            try:
                db.table("feedback_submissions").update({"follow_up_sent": True}).eq("id", item["id"]).execute()
            except Exception:
                pass
            try:
                db.table("reviews").update({"follow_up_sent": True}).eq("id", item["id"]).execute()
            except Exception:
                pass

    new_contacted = (res_record.get("contacted_count") or 0) + tokens_created

    # Update issue status to FOLLOW_UP_SENT
    db.table("issue_resolutions").update({
        "status": "FOLLOW_UP_SENT",
        "follow_up_sent_at": now_iso,
        "contacted_count": new_contacted,
        "updated_at": now_iso,
    }).eq("id", res_record["id"]).execute()

    return {
        "success": True,
        "eligible_count": len(eligible_items),
        "sent_count": tokens_created,
        "contacted_count": new_contacted,
        "status": "FOLLOW_UP_SENT",
        "message": f"Successfully sent {tokens_created} follow-up requests.",
    }


@router.get("/follow-up/{token}")
async def get_followup_context(token: str):
    """
    Public Endpoint — returns context for the follow-up page.
    Prevents reuse if already submitted. Does NOT expose PII or database IDs.
    """
    db = get_db()

    tokens = db.table("follow_up_tokens").select("*").eq("token", token).execute().data
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

    biz = db.table("businesses").select("business_name").eq("id", biz_id).execute().data
    biz_name = biz[0]["business_name"] if biz else "Business"

    res_record = _get_or_create_resolution_record(db, biz_id, issue_key)

    return {
        "already_submitted": False,
        "business_name": biz_name,
        "issue_title": issue_key.replace("_", " ").title(),
        "action_taken": res_record.get("action_taken") or res_record.get("we_did") or "Actions taken to resolve this issue",
        "token": token,
    }


@router.post("/follow-up/{token}/response")
async def submit_followup_response(token: str, body: FollowUpResponseRequest):
    """
    Public Endpoint — Stores customer improvement response.
    Marks token as used to prevent duplicates.
    Recalculates improvement % and evaluates state transition (IMPROVED vs REOPENED).
    """
    if body.response not in {"improved", "somewhat_improved", "not_improved"}:
        raise HTTPException(
            status_code=400,
            detail="Response must be one of: 'improved', 'somewhat_improved', 'not_improved'."
        )

    db = get_db()

    tokens = db.table("follow_up_tokens").select("*").eq("token", token).execute().data
    if not tokens:
        raise HTTPException(status_code=404, detail="Invalid or expired follow-up link.")

    token_data = tokens[0]
    if token_data.get("is_used"):
        raise HTTPException(status_code=400, detail="This follow-up link has already been used.")

    now_iso = datetime.now(timezone.utc).isoformat()
    biz_id = token_data["business_id"]
    issue_key = token_data["issue_key"]

    # Mark token used
    db.table("follow_up_tokens").update({
        "is_used": True,
        "used_at": now_iso
    }).eq("token", token).execute()

    # Store response
    db.table("follow_up_responses").insert({
        "id": str(uuid.uuid4()),
        "business_id": biz_id,
        "issue_key": issue_key,
        "feedback_id": token_data.get("feedback_id"),
        "response": body.response,
        "comment": body.comment.strip() if body.comment else None,
        "submitted_at": now_iso,
    }).execute()

    # Fetch resolution record and update counters
    res_record = _get_or_create_resolution_record(db, biz_id, issue_key)

    resp_type = body.response
    imp_c = res_record.get("improved_count", 0) + (1 if resp_type == "improved" else 0)
    som_c = res_record.get("somewhat_improved_count", 0) + (1 if resp_type == "somewhat_improved" else 0)
    not_c = res_record.get("not_improved_count", 0) + (1 if resp_type == "not_improved" else 0)
    tot_c = res_record.get("response_count", 0) + 1

    _, imp_pct = calculate_improvement_percentage(imp_c, som_c, not_c)

    # State Machine Evaluation: IMPROVED if imp_pct >= IMPROVEMENT_THRESHOLD (70%), else REOPENED
    new_status = "IMPROVED" if imp_pct >= IMPROVEMENT_THRESHOLD else "REOPENED"

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
        f"Follow-up response recorded: biz={biz_id} issue={issue_key} "
        f"response={resp_type} new_imp={imp_pct}% status={new_status}"
    )

    return {
        "success": True,
        "message": "Thank you! Your response helps us measure whether the improvement worked.",
        "improvement_percentage": imp_pct,
        "status": new_status,
    }


@router.get("/business/{business_id}/issues/{issue_key}/resolution")
async def get_issue_resolution_impact(business_id: str, issue_key: str):
    """
    Workspace Endpoint — Returns resolution impact statistics for an issue.
    Includes contacted count, response count, response rate, breakdown, and status.
    """
    db = get_db()

    biz = db.table("businesses").select("id").eq("id", business_id).execute().data
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found.")

    res_record = _get_or_create_resolution_record(db, business_id, issue_key)

    contacted = res_record.get("contacted_count", 0)
    responses = res_record.get("response_count", 0)
    improved = res_record.get("improved_count", 0)
    somewhat = res_record.get("somewhat_improved_count", 0)
    not_improved = res_record.get("not_improved_count", 0)

    resp_rate = round((float(responses) / float(contacted)) * 100.0, 1) if contacted > 0 else 0.0
    _, imp_pct = calculate_improvement_percentage(improved, somewhat, not_improved)

    status = res_record.get("status", "IDENTIFIED")

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
        "improvement_percentage": imp_pct,
        "is_reopened": status == "REOPENED",
        "threshold": IMPROVEMENT_THRESHOLD,
    }
