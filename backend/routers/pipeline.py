"""
Pipeline Status Router — SSE endpoint for real-time progress updates
GET /pipeline/{session_id}/status  (text/event-stream)
GET /pipeline/{session_id}/poll    (JSON, for clients that don't support SSE)
"""
import asyncio
import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from database import get_db

router = APIRouter(prefix="/pipeline", tags=["pipeline"])

STEP_PROGRESS = {
    0: 5,
    1: 15,
    2: 30,
    3: 65,   # Categorization takes the longest
    4: 75,
    5: 82,
    6: 90,
    7: 100,
}


async def _event_generator(session_id: str):
    db = get_db()
    last_step = -1

    for _ in range(300):   # Max 5 minutes (300 × 1s)
        await asyncio.sleep(1)

        session = (
            db.table("sessions")
            .select("status,current_step,processed_reviews,total_reviews,error_message")
            .eq("id", session_id)
            .single()
            .execute()
            .data
        )

        if not session:
            yield f"data: {json.dumps({'error': 'Session not found'})}\n\n"
            break

        status   = session["status"]
        step     = session.get("current_step", 0)
        progress = STEP_PROGRESS.get(step, 5)

        # Only emit when something changed
        if step != last_step or status in ("complete", "failed"):
            last_step = step
            payload = {
                "status":    status,
                "step":      step,
                "progress":  progress,
                "processed": session.get("processed_reviews", 0),
                "total":     session.get("total_reviews", 0),
                "message":   session.get("error_message", ""),
            }
            yield f"data: {json.dumps(payload)}\n\n"

        if status in ("complete", "failed"):
            break


@router.get("/{session_id}/status")
async def pipeline_status_sse(session_id: str):
    return StreamingResponse(
        _event_generator(session_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{session_id}/poll")
def pipeline_status_poll(session_id: str):
    """Polling fallback for environments without SSE support."""
    db = get_db()
    session = (
        db.table("sessions")
        .select("status,current_step,processed_reviews,total_reviews,error_message")
        .eq("id", session_id)
        .single()
        .execute()
        .data
    )
    if not session:
        return {"error": "Session not found"}
    step = session.get("current_step", 0)
    return {
        "status":    session["status"],
        "step":      step,
        "progress":  STEP_PROGRESS.get(step, 5),
        "processed": session.get("processed_reviews", 0),
        "total":     session.get("total_reviews", 0),
        "message":   session.get("error_message", ""),
    }
