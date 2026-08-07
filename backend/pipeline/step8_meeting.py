"""
Step 8 — AI Product Review Meeting (LLM Call 4)
Stateless per-query handler. Called on demand, not during pipeline.
"""
import json
import pathlib
from database import get_db
from services.gemini_client import call_gemini

PROMPT_PATH = pathlib.Path(__file__).parent.parent / "prompts" / "meeting.txt"
PROMPT_TEMPLATE = PROMPT_PATH.read_text(encoding="utf-8")


def answer(session_id: str, user_message: str) -> dict:
    db = get_db()

    # Build context: top 10 clusters + session outputs
    clusters = (
        db.table("issue_clusters")
        .select("issue_key,category,review_count,avg_severity,premium_user_count,revenue_at_risk,priority_rank,description")
        .eq("session_id", session_id)
        .order("priority_rank")
        .limit(10)
        .execute()
        .data
    )

    outputs = (
        db.table("session_outputs")
        .select("executive_summary,ai_recommendation")
        .eq("session_id", session_id)
        .single()
        .execute()
        .data
    )

    session = db.table("sessions").select("total_reviews,team_size").eq("id", session_id).single().execute().data

    context = {
        "total_reviews":    session.get("total_reviews", 0),
        "team_size":        session.get("team_size", "small_team"),
        "top_issues":       clusters,
        "ai_recommendation": outputs.get("ai_recommendation") if outputs else "",
    }

    prompt = PROMPT_TEMPLATE.format(
        user_message=user_message,
        review_count=context["total_reviews"],
        context_json=json.dumps(context, ensure_ascii=False),
    )

    reply = call_gemini(prompt, call_type="meeting", session_id=session_id, expect_json=False)

    return {
        "reply":              reply,
        "referenced_issues":  [c["issue_key"] for c in clusters[:3]],
    }
