"""
Step 7 — Roadmap + Sprint Generator (LLM Call 3)
Single Gemini call returns both the 6-week roadmap and Sprint 1 stories.
"""
import json
import pathlib
from database import get_db
from services.gemini_client import call_gemini

PROMPT_PATH = pathlib.Path(__file__).parent.parent / "prompts" / "roadmap.txt"
PROMPT_TEMPLATE = PROMPT_PATH.read_text(encoding="utf-8")

TEAM_SIZE_MAP = {
    "solo":      "Solo founder — 1 developer. Prioritise Quick Wins.",
    "2_5":       "Small team of 2–5 people. Mix of Quick Wins and Medium tasks.",
    "5_10_plus": "Team of 5–10+. Can handle Large tasks in parallel.",
    "small_team": "Small startup team. Prefer Medium tasks, one Large per sprint.",
}


def run(session_id: str) -> dict:
    db = get_db()

    session = db.table("sessions").select("team_size").eq("id", session_id).single().execute().data
    team_label = TEAM_SIZE_MAP.get(session.get("team_size", "small_team"), TEAM_SIZE_MAP["small_team"])

    # Top 8 priority clusters (enough for 6-week roadmap)
    clusters = (
        db.table("issue_clusters")
        .select("issue_key,category,business_area,description,review_count,avg_severity,priority_rank,revenue_at_risk")
        .eq("session_id", session_id)
        .order("priority_rank")
        .limit(8)
        .execute()
        .data
    )

    prompt = PROMPT_TEMPLATE.format(
        team_size=team_label,
        issues_json=json.dumps(clusters, ensure_ascii=False),
    )

    result = call_gemini(prompt, call_type="roadmap", session_id=session_id)

    # Determine top priority and most requested for dashboard
    top_priority  = clusters[0] if clusters else None
    most_requested = next(
        (c for c in clusters if c["category"] == "Feature Request"),
        clusters[1] if len(clusters) > 1 else None,
    )

    # Upsert into session_outputs
    db.table("session_outputs").upsert({
        "session_id":     session_id,
        "roadmap_json":   result.get("roadmap"),
        "sprint_json":    result.get("sprint"),
        "top_priority":   top_priority,
        "most_requested": most_requested,
    }).execute()

    return result
