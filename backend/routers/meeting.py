"""
Meeting Router — AI Product Review Meeting (LLM Call 4)
POST /meeting/{session_id}/message
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pipeline.step8_meeting import answer

router = APIRouter(prefix="/meeting", tags=["meeting"])

SMART_QUESTIONS = [
    "What should I ship this week?",
    "Which issue is easiest to fix?",
    "What if I only have one developer?",
    "Which issues affect the most users?",
    "Show me only feature requests",
    "What are premium users saying?",
    "Which issue has the highest revenue risk?",
    "What would a PM prioritise first?",
    "Which issues are growing the fastest?",
    "What can I ignore for now?",
]


class MessageRequest(BaseModel):
    message: str


@router.get("/{session_id}/questions")
def get_smart_questions(session_id: str):
    return {"questions": SMART_QUESTIONS}


@router.post("/{session_id}/message")
def send_message(session_id: str, body: MessageRequest):
    if not body.message.strip():
        raise HTTPException(400, "Message cannot be empty")
    if len(body.message) > 500:
        raise HTTPException(400, "Message too long (max 500 characters)")
    try:
        result = answer(session_id, body.message)
        return result
    except Exception as e:
        raise HTTPException(500, f"Meeting error: {str(e)[:200]}")
