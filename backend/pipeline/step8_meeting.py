"""
Step 8 — AI Product Manager (Phase 5)
On-demand Q&A grounded in Decision Center analysis data.
Not a generic chatbot — answers must reference ranked issues + metrics.
"""
import json
import pathlib
import re
from database import get_db
from services.gemini_client import call_gemini
from services.decision_outputs import build_ai_pm_briefing
from core.logging import get_logger

logger = get_logger("pipeline.step8_meeting")

PROMPT_PATH = pathlib.Path(__file__).parent.parent / "prompts" / "meeting.txt"
PROMPT_TEMPLATE = PROMPT_PATH.read_text(encoding="utf-8")


def _score_100(raw) -> float:
    try:
        n = float(raw or 0)
    except Exception:
        return 0.0
    if n <= 1.5:
        n *= 100.0
    return round(max(0.0, min(100.0, n)), 1)


def _issue_context(c: dict) -> dict:
    pillars = c.get("decision_pillars") or {}
    return {
        "issue_key": c.get("issue_key"),
        "issue": str(c.get("issue_key") or "").replace("_", " ").title(),
        "category": c.get("category"),
        "description": c.get("description"),
        "customer_reach": pillars.get("customer_reach", c.get("review_count")),
        "review_count": c.get("review_count"),
        "severity": c.get("avg_severity"),
        "revenue_impact": pillars.get("revenue_impact", c.get("revenue_at_risk")),
        "revenue_at_risk": c.get("revenue_at_risk"),
        "priority_score": _score_100(c.get("priority_score")),
        "priority_rank": c.get("priority_rank"),
        "premium_user_count": c.get("premium_user_count"),
        "decision_pillars": pillars,
    }


def _fallback_reply(user_message: str, briefing: dict, clusters: list[dict]) -> str:
    q = (user_message or "").lower()
    top = clusters[0] if clusters else None
    if not top:
        return "No ranked issues are available yet. Run an analysis from the Decision Center first."

    if any(k in q for k in ("ignore", "if we don't", "what happens if", "risk of not")):
        return briefing.get("if_ignored") or "Deferring the top issue leaves customers and revenue exposed."
    if any(k in q for k in ("why", "priorit", "rank", "score")):
        return (
            f"{briefing.get('why_it_matters', '')} {briefing.get('why_prioritized', '')}"
        ).strip()
    if any(k in q for k in ("next", "should i", "ship", "fix", "action")):
        return briefing.get("recommended_next_action") or "Start Sprint 1 on the top-ranked issue."
    return (
        f"{briefing.get('why_it_matters', '')} "
        f"{briefing.get('why_prioritized', '')} "
        f"Recommended next action: {briefing.get('recommended_next_action', 'Open the Sprint Plan.')}"
    ).strip()


def _extract_referenced(reply: str, clusters: list[dict]) -> list[str]:
    keys = [str(c.get("issue_key")) for c in clusters if c.get("issue_key")]
    found = []
    text = reply or ""
    for key in keys:
        if re.search(re.escape(key), text, re.IGNORECASE) or re.search(
            re.escape(key.replace("_", " ")), text, re.IGNORECASE
        ):
            found.append(key)
    return found[:5] or keys[:3]


def answer(session_id: str, user_message: str) -> dict:
    db = get_db()

    clusters = (
        db.table("issue_clusters")
        .select(
            "issue_key,category,review_count,avg_severity,premium_user_count,"
            "revenue_at_risk,priority_rank,priority_score,description,decision_pillars"
        )
        .eq("session_id", session_id)
        .order("priority_rank")
        .limit(10)
        .execute()
        .data
    ) or []
    clusters = [dict(c) for c in clusters if isinstance(c, dict)]

    outputs = (
        db.table("session_outputs")
        .select("executive_summary,ai_recommendation")
        .eq("session_id", session_id)
        .single()
        .execute()
        .data
    ) or {}

    session = (
        db.table("sessions")
        .select("total_reviews,team_size,source")
        .eq("id", session_id)
        .single()
        .execute()
        .data
    ) or {}

    briefing = None
    try:
        outputs_full = (
            db.table("session_outputs")
            .select("ai_pm_briefing")
            .eq("session_id", session_id)
            .single()
            .execute()
            .data
        ) or {}
        briefing = outputs_full.get("ai_pm_briefing")
    except Exception:
        briefing = None

    total_reviews = int(session.get("total_reviews") or 0)
    briefing = briefing or build_ai_pm_briefing(clusters, total_reviews)

    context = {
        "role": "AI Product Manager — Decision Center",
        "total_reviews": total_reviews,
        "team_size": session.get("team_size", "small_team"),
        "source": session.get("source"),
        "top_issues": [_issue_context(c) for c in clusters],
        "ai_recommendation": outputs.get("ai_recommendation") or "",
        "executive_summary": outputs.get("executive_summary") or "",
        "top_issue_briefing": briefing,
        "formula": "Priority = Revenue×0.35 + Reach×0.30 + Severity×0.20 + Tier×0.15",
    }

    prompt = PROMPT_TEMPLATE.format(
        user_message=user_message,
        context_json=json.dumps(context, ensure_ascii=False),
    )

    try:
        reply = call_gemini(prompt, call_type="meeting", session_id=session_id, expect_json=False)
        if not isinstance(reply, str) or not reply.strip():
            raise ValueError("Empty AI PM reply")
    except Exception as e:
        logger.warning(f"[step8] AI PM Gemini failed — deterministic fallback: {e}")
        reply = _fallback_reply(user_message, briefing, clusters)

    return {
        "reply": reply if isinstance(reply, str) else str(reply),
        "referenced_issues": _extract_referenced(str(reply), clusters),
        "briefing": briefing,
    }
