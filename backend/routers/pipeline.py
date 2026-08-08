"""
Pipeline Status Router — SSE endpoint for real-time progress updates
GET  /pipeline/{session_id}/status  (text/event-stream)
GET  /pipeline/{session_id}/poll    (JSON, for clients that don't support SSE)
POST /pipeline/{session_id}/retry-categorize  (re-run Gemini from step 3)
"""
import asyncio
import json
from fastapi import APIRouter, BackgroundTasks, HTTPException
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


def _session_fields(db, session_id: str) -> dict | None:
    try:
        return (
            db.table("sessions")
            .select("status,current_step,processed_reviews,total_reviews,error_message,ai_analysis_status")
            .eq("id", session_id)
            .single()
            .execute()
            .data
        )
    except Exception:
        return (
            db.table("sessions")
            .select("status,current_step,processed_reviews,total_reviews,error_message")
            .eq("id", session_id)
            .single()
            .execute()
            .data
        )


async def _event_generator(session_id: str):
    db = get_db()
    last_step = -1

    for _ in range(300):   # Max 5 minutes (300 × 1s)
        await asyncio.sleep(1)

        session = _session_fields(db, session_id)

        if not session:
            yield f"data: {json.dumps({'error': 'Session not found'})}\n\n"
            break

        status   = session["status"]
        step     = session.get("current_step", 0)
        progress = STEP_PROGRESS.get(step, 5)

        if step != last_step or status in ("complete", "failed"):
            last_step = step
            payload = {
                "status":    status,
                "step":      step,
                "progress":  progress,
                "processed": session.get("processed_reviews", 0),
                "total":     session.get("total_reviews", 0),
                "message":   session.get("error_message", ""),
                "ai_analysis_status": session.get("ai_analysis_status") or "ok",
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
    session = _session_fields(db, session_id)
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
        "ai_analysis_status": session.get("ai_analysis_status") or "ok",
    }


@router.post("/{session_id}/retry-categorize")
def retry_categorize(session_id: str, background_tasks: BackgroundTasks):
    """
    Retry Gemini categorization after AI analysis was unavailable/fallback.
    Preserves VADER results (steps 1–2). Clears categorizations/clusters and
    re-runs from step 3 onward.
    """
    from pipeline.orchestrator import run_pipeline

    db = get_db()
    session = (
        db.table("sessions")
        .select("id,status,current_step")
        .eq("id", session_id)
        .single()
        .execute()
        .data
    )
    if not session:
        raise HTTPException(404, "Session not found")

    try:
        db.table("categorizations").delete().eq("session_id", session_id).execute()
    except Exception:
        pass
    try:
        db.table("issue_clusters").delete().eq("session_id", session_id).execute()
    except Exception:
        pass

    update = {
        "status": "categorizing",
        "current_step": 2,  # orchestrator skips steps <= current_step
        "error_message": None,
    }
    try:
        db.table("sessions").update({**update, "ai_analysis_status": "retrying"}).eq("id", session_id).execute()
    except Exception:
        db.table("sessions").update(update).eq("id", session_id).execute()

    background_tasks.add_task(run_pipeline, session_id)

    return {
        "success": True,
        "session_id": session_id,
        "message": "Categorization retry started. VADER results preserved.",
        "status_url": f"/pipeline/{session_id}/status",
    }
