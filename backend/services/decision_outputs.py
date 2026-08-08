"""
Phase 5 — Decision-to-Action builders.

Deterministic Product Roadmap + Sprint Plan from prioritized issue clusters.
Gemini may enrich copy, but never invents priority order or exact engineering effort.
"""
from __future__ import annotations

from typing import Any


EFFORT_ESTIMATE_NOTE = (
    "Effort and story points are estimates based on issue severity and scope — "
    "not exact engineering forecasts. Validate with your team before committing."
)


def _title(issue_key: str) -> str:
    return (issue_key or "issue").replace("_", " ").strip().title()


def _priority_label(rank: int, score: float | None = None) -> str:
    if rank <= 1 or (score is not None and score >= 70):
        return "Critical"
    if rank <= 3 or (score is not None and score >= 50):
        return "High"
    if rank <= 6:
        return "Medium"
    return "Low"


def _score_100(raw: Any) -> float:
    try:
        n = float(raw or 0)
    except Exception:
        return 0.0
    if n <= 1.5:
        n *= 100.0
    return max(0.0, min(100.0, n))


def _timeframe_for_rank(rank: int) -> str:
    if rank <= 1:
        return "Week 1–2 (Sprint 1)"
    if rank <= 3:
        return "Week 1–3"
    if rank <= 5:
        return "Week 3–4"
    return "Week 5–6"


def _effort_band(cluster: dict) -> tuple[str, str, int]:
    """
    Returns (effort_letter S|M|L, effort_label, story_points).
    Estimate only — based on severity + volume heuristics.
    """
    sev = float(cluster.get("avg_severity") or 3)
    count = int(cluster.get("review_count") or 0)
    if sev >= 4 or count >= 80:
        return "L", "Large (estimate ~1–2 weeks)", 8
    if sev >= 3 or count >= 25:
        return "M", "Medium (estimate ~3–5 days)", 5
    return "S", "Small (estimate ~1–2 days)", 2


def _recommended_action(cluster: dict) -> str:
    title = _title(str(cluster.get("issue_key") or ""))
    cat = (cluster.get("category") or "issue").lower()
    desc = (cluster.get("description") or "").strip()
    if desc:
        return f"Address {title}: {desc}"
    if "payment" in cat or "payment" in title.lower():
        return f"Stabilize {title} — restore successful checkout/payment completion."
    if "bug" in cat or "crash" in title.lower():
        return f"Fix {title} — remove the blocking failure path for affected customers."
    if "feature" in cat:
        return f"Ship a focused MVP for {title} tied to the top customer ask."
    return f"Prioritize a fix for {title} grounded in the ranked customer evidence."


def _business_outcome(cluster: dict) -> str:
    risk = float(
        cluster.get("estimated_revenue_impact")
        or cluster.get("revenue_at_risk")
        or 0
    )
    affected = int(
        cluster.get("affected_customers")
        or (cluster.get("decision_pillars") or {}).get("affected_customers")
        or cluster.get("review_count")
        or 0
    )
    pillars = cluster.get("decision_pillars") or {}
    reach_p = pillars.get("customer_reach_percentage") or pillars.get("customer_reach")
    if risk > 0:
        return (
            f"Potentially reduce ~₹{risk:,.0f} estimated revenue impact and improve experience "
            f"for {affected} observed customers affected."
        )
    if isinstance(reach_p, (int, float)) and reach_p > 0:
        return f"Improve outcomes for customers driving reach score {round(reach_p)} on this issue."
    return f"Improve retention/satisfaction for customers reporting this issue ({affected} observed)."


def build_roadmap_items(clusters: list[dict]) -> list[dict]:
    """Phase 5 roadmap rows: issue, priority, action, outcome, timeframe."""
    items = []
    for idx, c in enumerate(clusters[:8]):
        rank = int(c.get("priority_rank") or idx + 1)
        score = _score_100(c.get("priority_score"))
        items.append({
            "issue": _title(str(c.get("issue_key") or f"issue_{idx+1}")),
            "issue_key": c.get("issue_key"),
            "priority": _priority_label(rank, score),
            "priority_rank": rank,
            "priority_score": round(score, 1),
            "recommended_action": _recommended_action(c),
            "expected_business_outcome": _business_outcome(c),
            "suggested_timeframe": _timeframe_for_rank(rank),
            "category": c.get("category"),
            "review_count": c.get("review_count"),
            "avg_severity": c.get("avg_severity"),
            "revenue_at_risk": c.get("revenue_at_risk"),
        })
    return items


def build_roadmap_weeks(clusters: list[dict]) -> list[dict]:
    """6-week schedule preserving priority order (for timeline UI)."""
    top = clusters[:6]
    weeks = []
    for i in range(6):
        week_num = i + 1
        if i < len(top):
            c = top[i]
            key = c.get("issue_key")
            effort_letter, effort_label, _ = _effort_band(c)
            effort_ui = {
                "S": "Quick Win",
                "M": "Medium",
                "L": "Large",
            }.get(effort_letter, "Medium")
            weeks.append({
                "week": week_num,
                "theme": _title(str(key or f"Week {week_num}")),
                "issues": [key] if key else [],
                "effort": effort_ui,
                "effort_estimate": effort_label,
                "effort_is_estimate": True,
                "rationale": _recommended_action(c),
                "expected_outcome": _business_outcome(c),
            })
        else:
            weeks.append({
                "week": week_num,
                "theme": f"Buffer / follow-on improvements",
                "issues": [],
                "effort": "Quick Win",
                "effort_estimate": "Small (estimate ~1–2 days)",
                "effort_is_estimate": True,
                "rationale": "Reserve capacity for regressions and newly emerging feedback.",
                "expected_outcome": "Protect delivery quality while monitoring new signals.",
            })
    return weeks


def build_sprint_plan(clusters: list[dict]) -> dict:
    """Sprint 1 stories for top High/Critical issues — effort clearly estimated."""
    stories = []
    total_points = 0
    for idx, c in enumerate(clusters[:4]):
        rank = int(c.get("priority_rank") or idx + 1)
        score = _score_100(c.get("priority_score"))
        letter, effort_label, points = _effort_band(c)
        key = c.get("issue_key") or f"ISSUE_{idx+1}"
        title = _title(str(key))
        pri = _priority_label(rank, score)
        total_points += points
        stories.append({
            "id": f"S1-{str(idx + 1).zfill(3)}",
            "title": f"Resolve {title}",
            "user_story": (
                f"As a customer affected by {title.lower()}, "
                f"I want the issue fixed, so that I can complete my goal without friction."
            ),
            "acceptance_criteria": [
                f"Reproduce and document the primary failure path for {title}",
                "Ship a fix covered by automated or manual verification",
                f"Confirm improvement against the {c.get('review_count', 0)} related feedback mentions",
            ],
            "effort": letter,
            "effort_estimate": effort_label,
            "effort_is_estimate": True,
            "story_points": points,
            "story_points_note": "Estimate only — calibrate with engineering",
            "priority": pri,
            "linked_issue": key,
        })

    return {
        "name": "Sprint 1",
        "owner": "Engineering Team",
        "duration_weeks": 2,
        "total_story_points": total_points,
        "effort_disclaimer": EFFORT_ESTIMATE_NOTE,
        "stories": stories,
    }


def build_ai_pm_briefing(clusters: list[dict], total_reviews: int = 0) -> dict:
    """
    Structured AI PM briefing for the top issue — uses analysis numbers only.
    """
    if not clusters:
        return {
            "issue": None,
            "why_it_matters": "No prioritized issues are available yet.",
            "why_prioritized": "Run an analysis to generate a Decision Center ranking.",
            "if_ignored": "Without ranked issues, the team cannot sequence fixes by business impact.",
            "recommended_next_action": "Upload feedback or load sample data, then open the Decision Center.",
            "metrics": {},
        }

    top = clusters[0]
    rank = int(top.get("priority_rank") or 1)
    score = _score_100(top.get("priority_score"))
    pillars = top.get("decision_pillars") or {}
    reach = pillars.get("customer_reach")
    sev_pillar = pillars.get("severity")
    rev_pillar = pillars.get("revenue_impact")
    title = _title(str(top.get("issue_key") or ""))
    count = int(top.get("review_count") or 0)
    sev = float(top.get("avg_severity") or 0)
    risk = float(top.get("revenue_at_risk") or 0)

    why_matters = (
        f"{title} shows up for {count} observed customers"
        + (f" with ~₹{risk:,.0f} estimated revenue impact / at risk" if risk > 0 else "")
        + f" and severity {sev:.1f}/5."
    )
    why_pri = (
        f"It ranks #{rank} with priority score {score:.0f}/100 using the backend formula "
        f"(Revenue × 35% + Reach × 30% + Severity × 20% + Tier × 15%)."
    )
    if isinstance(rev_pillar, (int, float)):
        why_pri += f" Revenue impact component: {round(rev_pillar)}."
    if isinstance(reach, (int, float)):
        why_pri += f" Customer reach component: {round(reach)}."
    if isinstance(sev_pillar, (int, float)):
        why_pri += f" Severity component: {round(sev_pillar)}."

    if_ignored = (
        f"If ignored, {count} affected customers continue hitting this pain"
        + (f" and ~₹{risk:,.0f} remains exposed" if risk > 0 else "")
        + " while lower-impact work may crowd the roadmap."
    )

    return {
        "issue": title,
        "issue_key": top.get("issue_key"),
        "why_it_matters": why_matters,
        "why_prioritized": why_pri,
        "if_ignored": if_ignored,
        "recommended_next_action": _recommended_action(top),
        "metrics": {
            "priority_rank": rank,
            "priority_score": round(score, 1),
            "customer_reach": reach if reach is not None else count,
            "severity": sev,
            "revenue_impact": rev_pillar if rev_pillar is not None else risk,
            "revenue_at_risk": risk,
            "review_count": count,
            "total_reviews_analysed": total_reviews,
            "decision_pillars": pillars,
        },
    }


def build_decision_outputs(clusters: list[dict], total_reviews: int = 0) -> dict:
    return {
        "roadmap": {
            "items": build_roadmap_items(clusters),
            "weeks": build_roadmap_weeks(clusters),
            "effort_disclaimer": EFFORT_ESTIMATE_NOTE,
        },
        "sprint": build_sprint_plan(clusters),
        "ai_pm_briefing": build_ai_pm_briefing(clusters, total_reviews=total_reviews),
    }
