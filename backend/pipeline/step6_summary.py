"""
Step 6 — Executive Summary (LLM Call 2)
Feeds aggregated stats to Gemini. Returns structured summary + insights.
Gemini never sees raw review text in this call.
"""
import json
import pathlib
from database import get_db
from services.gemini_client import call_gemini

PROMPT_PATH = pathlib.Path(__file__).parent.parent / "prompts" / "summary.txt"
PROMPT_TEMPLATE = PROMPT_PATH.read_text(encoding="utf-8")


def run(session_id: str) -> dict:
    db = get_db()

    # Fetch session stats
    session = db.table("sessions").select("*").eq("id", session_id).single().execute().data
    total_reviews     = session.get("total_reviews", 0)
    actionable        = session.get("actionable_reviews", 0)

    # Top 10 clusters by priority rank
    clusters = (
        db.table("issue_clusters")
        .select("issue_key,category,review_count,avg_severity,premium_user_count,revenue_at_risk,priority_rank")
        .eq("session_id", session_id)
        .order("priority_rank")
        .limit(10)
        .execute()
        .data
    )

    # Positive themes (Praise category)
    praise = (
        db.table("issue_clusters")
        .select("issue_key,review_count")
        .eq("session_id", session_id)
        .eq("category", "Praise")
        .order("review_count", desc=True)
        .limit(3)
        .execute()
        .data
    )

    data_payload = {
        "total_reviews":     total_reviews,
        "actionable_reviews": actionable,
        "top_issues":        clusters,
        "positive_themes":   [p["issue_key"] for p in praise],
    }

    prompt = PROMPT_TEMPLATE.format(data_json=json.dumps(data_payload, ensure_ascii=False))

    result = call_gemini(prompt, call_type="summary", session_id=session_id)

    # Persist to session_outputs (upsert)
    db.table("session_outputs").upsert({
        "session_id":         session_id,
        "executive_summary":  result.get("executive_summary", ""),
        "headline_insights":  result.get("headline_insights", []),
        "ai_recommendation":  result.get("ai_recommendation", ""),
    }).execute()

    return result
