"""
Meeting Router — AI Product Manager (Phase 5)
GET  /meeting/{session_id}/questions
GET  /meeting/{session_id}/briefing
POST /meeting/{session_id}/message
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_db
from pipeline.step8_meeting import answer
from services.decision_outputs import build_ai_pm_briefing

router = APIRouter(prefix="/meeting", tags=["meeting"])

# Product-decision focused prompts (not generic ChatGPT chatter)
SMART_QUESTIONS = [
    "Why does the top issue matter?",
    "Why was this issue prioritized over others?",
    "What happens if we ignore the top issue?",
    "What should we ship this sprint?",
    "Which issue has the highest revenue impact?",
    "Which issue affects the most customers?",
    "What can we safely defer?",
    "Explain the priority score for #1",
]


class MessageRequest(BaseModel):
    message: str


@router.get("/{session_id}/questions")
def get_smart_questions(session_id: str):
    return {
        "questions": SMART_QUESTIONS,
        "focus": "product_decisions",
        "note": "Questions are grounded in this session's Decision Center analysis.",
    }


@router.get("/{session_id}/briefing")
def get_ai_pm_briefing(session_id: str):
    """
    Structured AI PM briefing for the top issue:
    why it matters, why prioritized, if ignored, recommended next action.
    """
    db = get_db()
    session = (
        db.table("sessions")
        .select("id,total_reviews,status")
        .eq("id", session_id)
        .single()
        .execute()
        .data
    )
    if not session:
        raise HTTPException(404, "Session not found")

    outputs = {}
    try:
        outputs = (
            db.table("session_outputs")
            .select("ai_pm_briefing,ai_recommendation")
            .eq("session_id", session_id)
            .single()
            .execute()
            .data
        ) or {}
    except Exception:
        try:
            outputs = (
                db.table("session_outputs")
                .select("ai_recommendation")
                .eq("session_id", session_id)
                .single()
                .execute()
                .data
            ) or {}
        except Exception:
            outputs = {}

    if outputs.get("ai_pm_briefing"):
        briefing = outputs["ai_pm_briefing"]
    else:
        clusters = (
            db.table("issue_clusters")
            .select(
                "issue_key,category,review_count,avg_severity,premium_user_count,"
                "revenue_at_risk,priority_rank,priority_score,description,decision_pillars"
            )
            .eq("session_id", session_id)
            .order("priority_rank")
            .limit(8)
            .execute()
            .data
        ) or []
        briefing = build_ai_pm_briefing(
            [dict(c) for c in clusters if isinstance(c, dict)],
            total_reviews=int(session.get("total_reviews") or 0),
        )

    return {
        "session_id": session_id,
        "briefing": briefing,
        "ai_recommendation": outputs.get("ai_recommendation") or "",
    }


@router.post("/{session_id}/message")
def send_message(session_id: str, body: MessageRequest):
    if not body.message.strip():
        raise HTTPException(400, "Message cannot be empty")
    if len(body.message) > 500:
        raise HTTPException(400, "Message too long (max 500 characters)")
    try:
        return answer(session_id, body.message)
    except Exception as e:
        raise HTTPException(500, f"AI Product Manager error: {str(e)[:200]}")
