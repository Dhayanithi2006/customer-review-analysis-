"""
Step 7 — Roadmap + Sprint Generator (Phase 5 Decision-to-Action)
Builds deterministic roadmap/sprint from prioritized issues, then optionally
enriches with Gemini. Gemini never reorders priority or invents exact effort.
"""
import json
import pathlib
from database import get_db
from services.gemini_client import call_gemini
from services.decision_outputs import build_decision_outputs, EFFORT_ESTIMATE_NOTE
from core.logging import get_logger

logger = get_logger("pipeline.step7_roadmap")

PROMPT_PATH = pathlib.Path(__file__).parent.parent / "prompts" / "roadmap.txt"
PROMPT_TEMPLATE = PROMPT_PATH.read_text(encoding="utf-8")

TEAM_SIZE_MAP = {
    "solo":      "Solo founder — 1 developer. Prioritise Quick Wins (estimates).",
    "2_5":       "Small team of 2–5 people. Mix of Quick Wins and Medium estimates.",
    "5_10_plus": "Team of 5–10+. Can schedule Large estimates in parallel.",
    "small_team": "Small startup team. Prefer Medium estimates, one Large per sprint.",
}


def _cluster_payload(c: dict) -> dict:
    pillars = c.get("decision_pillars") or {}
    return {
        "issue_key": c.get("issue_key"),
        "category": c.get("category"),
        "business_area": c.get("business_area"),
        "description": c.get("description"),
        "review_count": c.get("review_count"),
        "avg_severity": c.get("avg_severity"),
        "priority_rank": c.get("priority_rank"),
        "priority_score": c.get("priority_score"),
        "revenue_at_risk": c.get("revenue_at_risk"),
        "premium_user_count": c.get("premium_user_count"),
        "customer_reach": pillars.get("customer_reach"),
        "revenue_impact": pillars.get("revenue_impact"),
        "severity_pillar": pillars.get("severity"),
        "customer_tier": pillars.get("customer_tier") or pillars.get("premium_users"),
        "decision_pillars": pillars,
    }


def _merge_gemini(baseline: dict, gemini: dict) -> dict:
    """Prefer Gemini copy when valid; keep baseline structure/priority."""
    out = dict(baseline)
    if not isinstance(gemini, dict):
        return out

    items = gemini.get("roadmap_items")
    if isinstance(items, list) and items:
        # Keep only items that map to known keys; preserve order of baseline
        by_key = {
            str(i.get("issue_key") or "").lower(): i
            for i in items if isinstance(i, dict)
        }
        merged_items = []
        for base in baseline["roadmap"]["items"]:
            key = str(base.get("issue_key") or "").lower()
            g = by_key.get(key)
            if not g:
                merged_items.append(base)
                continue
            merged_items.append({
                **base,
                "recommended_action": g.get("recommended_action") or base["recommended_action"],
                "expected_business_outcome": g.get("expected_business_outcome") or base["expected_business_outcome"],
                "suggested_timeframe": g.get("suggested_timeframe") or base["suggested_timeframe"],
                "priority": g.get("priority") or base["priority"],
                "issue": g.get("issue") or base["issue"],
            })
        out["roadmap"]["items"] = merged_items

    weeks = gemini.get("roadmap")
    if isinstance(weeks, list) and weeks:
        out["roadmap"]["weeks"] = weeks
        for w in out["roadmap"]["weeks"]:
            if isinstance(w, dict):
                w.setdefault("effort_is_estimate", True)

    sprint = gemini.get("sprint")
    if isinstance(sprint, dict) and sprint.get("stories"):
        sprint = dict(sprint)
        sprint["effort_disclaimer"] = sprint.get("effort_disclaimer") or EFFORT_ESTIMATE_NOTE
        for s in sprint.get("stories") or []:
            if isinstance(s, dict):
                s.setdefault("effort_is_estimate", True)
                if not s.get("effort_estimate"):
                    letter = (s.get("effort") or "M").upper()
                    s["effort_estimate"] = {
                        "S": "Small (estimate ~1–2 days)",
                        "M": "Medium (estimate ~3–5 days)",
                        "L": "Large (estimate ~1–2 weeks)",
                    }.get(letter, "Medium (estimate ~3–5 days)")
        out["sprint"] = sprint

    return out


def run(session_id: str) -> dict:
    db = get_db()

    session = db.table("sessions").select("team_size,total_reviews").eq("id", session_id).single().execute().data or {}
    team_label = TEAM_SIZE_MAP.get(session.get("team_size", "small_team"), TEAM_SIZE_MAP["small_team"])
    total_reviews = int(session.get("total_reviews") or 0)

    clusters = (
        db.table("issue_clusters")
        .select(
            "issue_key,category,business_area,description,review_count,avg_severity,"
            "priority_rank,priority_score,revenue_at_risk,premium_user_count,decision_pillars"
        )
        .eq("session_id", session_id)
        .order("priority_rank")
        .limit(8)
        .execute()
        .data
    ) or []
    clusters = [dict(c) for c in clusters if isinstance(c, dict)]

    baseline = build_decision_outputs(clusters, total_reviews=total_reviews)
    result = baseline

    prompt = PROMPT_TEMPLATE.format(
        team_size=team_label,
        issues_json=json.dumps([_cluster_payload(c) for c in clusters], ensure_ascii=False),
    )

    try:
        gemini_result = call_gemini(prompt, call_type="roadmap", session_id=session_id)
        if isinstance(gemini_result, dict):
            result = _merge_gemini(baseline, gemini_result)
    except Exception as e:
        logger.warning(f"[step7] Gemini roadmap failed — using deterministic outputs: {e}")

    top_priority = clusters[0] if clusters else None
    most_requested = next(
        (c for c in clusters if "feature" in str(c.get("category") or "").lower()),
        clusters[1] if len(clusters) > 1 else None,
    )

    # Persist: roadmap_json includes weeks+items; sprint_json is sprint object
    payload = {
        "session_id":     session_id,
        "roadmap_json":   result["roadmap"],
        "sprint_json":    result["sprint"],
        "top_priority":   top_priority,
        "most_requested": most_requested,
    }
    try:
        db.table("session_outputs").upsert({
            **payload,
            "ai_pm_briefing": result.get("ai_pm_briefing"),
        }).execute()
    except Exception:
        db.table("session_outputs").upsert(payload).execute()

    return result
