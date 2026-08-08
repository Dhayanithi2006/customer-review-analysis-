"""
Pipeline Orchestrator
Runs all 7 pipeline steps in sequence with:
- Status checkpointing after each step
- Resume capability (skip completed steps)
- Graceful error handling and status updates
"""
from database import get_db
from pipeline import (
    step1_clean,
    step2_vader,
    step3_categorize,
    step4_cluster,
    step5_priority,
    step6_summary,
    step7_roadmap,
)

STEPS = [
    (1, "cleaning",      "Removing duplicates and spam…",              step1_clean),
    (2, "categorizing",  "Analysing sentiment…",                       step2_vader),
    (3, "categorizing",  "Categorising reviews with AI (this may take a minute)…", step3_categorize),
    (4, "clustering",    "Grouping related issues…",                   step4_cluster),
    (5, "prioritizing",  "Calculating priority scores…",               step5_priority),
    (6, "summarizing",   "Generating executive summary…",              step6_summary),
    (7, "roadmapping",   "Building roadmap and sprint plan…",          step7_roadmap),
]


def _set_status(db, session_id: str, status: str, step: int, message: str = ""):
    db.table("sessions").update({
        "status":       status,
        "current_step": step,
    }).eq("id", session_id).execute()


def _set_actionable_count(db, session_id: str):
    """After VADER, update the actionable_reviews count."""
    count = (
        db.table("reviews")
        .select("id", count="exact")
        .eq("session_id", session_id)
        .eq("routed_to_llm", True)
        .execute()
        .count
    )
    db.table("sessions").update({"actionable_reviews": count}).eq("id", session_id).execute()


def run_pipeline(session_id: str):
    db = get_db()

    session = db.table("sessions").select("current_step,status").eq("id", session_id).single().execute().data
    session_data = dict(session) if (session and isinstance(session, dict)) else {}
    start_from = session_data.get("current_step", 0)

    if session_data.get("status") == "complete":
        return  # Already done

    try:
        for step_num, status_label, message, module in STEPS:
            if step_num <= start_from:
                continue  # Resume: skip already-completed steps

            _set_status(db, session_id, status_label, step_num, message)
            module.run(session_id)

            # Special: after VADER (step 2), record actionable count
            if step_num == 2:
                _set_actionable_count(db, session_id)

        _set_status(db, session_id, "complete", len(STEPS))

    except Exception as e:
        db.table("sessions").update({
            "status":        "failed",
            "error_message": str(e)[:500],
        }).eq("id", session_id).execute()
        raise
