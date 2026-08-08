"""
Results Router — all dashboard data endpoints
"""
from fastapi import APIRouter, HTTPException
from database import get_db

router = APIRouter(prefix="/results", tags=["results"])


def _enrich_clusters(db, session_id: str, clusters: list) -> tuple[list, dict]:
    """Ensure pillars/scores present; attach Decision Center metadata."""
    from services.revenue_impact import (
        load_business_assumptions,
        score_clusters,
        decision_center_kpis,
        build_fix_first_why,
    )

    assumptions = load_business_assumptions(db, session_id)
    rows = [dict(c) for c in clusters if isinstance(c, dict)]

    needs_score = any(not r.get("decision_pillars") or r.get("priority_score") is None for r in rows)
    if needs_score and rows:
        for r in rows:
            if r.get("affected_customers") is None:
                r["affected_customers"] = int(r.get("review_count") or 0)
        scored = score_clusters(
            rows,
            monthly_customers=assumptions.get("monthly_customers"),
            avg_revenue_per_user=assumptions.get("avg_revenue_per_user"),
            business_premium_pct=(
                float(assumptions["premium_pct"])
                if assumptions.get("premium_pct") is not None
                else None
            ),
        )
        # Preserve original fields; overlay scores
        by_id = {s.get("id"): s for s in scored if s.get("id")}
        by_key = {s.get("issue_key"): s for s in scored}
        enriched = []
        for r in rows:
            overlay = by_id.get(r.get("id")) or by_key.get(r.get("issue_key")) or {}
            merged = {**r, **{k: overlay[k] for k in (
                "priority_score", "priority_rank", "revenue_at_risk",
                "estimated_revenue_impact", "affected_customers",
                "customer_reach_percentage", "decision_pillars",
            ) if k in overlay}}
            enriched.append(merged)
        rows = enriched
    else:
        # Normalize aliases from stored pillars
        for r in rows:
            pillars = r.get("decision_pillars") or {}
            if r.get("estimated_revenue_impact") is None:
                r["estimated_revenue_impact"] = r.get("revenue_at_risk") or pillars.get(
                    "estimated_revenue_impact", 0
                )
            if r.get("affected_customers") is None:
                r["affected_customers"] = pillars.get("affected_customers") or r.get("review_count") or 0
            if r.get("customer_reach_percentage") is None:
                r["customer_reach_percentage"] = pillars.get("customer_reach_percentage") or 0

    # Sort by priority rank / score (never by feedback count)
    rows.sort(
        key=lambda x: (
            int(x.get("priority_rank") or 999),
            -float(x.get("priority_score") or 0),
        )
    )

    kpis = decision_center_kpis(rows)
    top = rows[0] if rows else None
    fix_first = None
    if top:
        fix_first = {
            "issue_key": top.get("issue_key"),
            "title": str(top.get("issue_key") or "").replace("_", " ").title(),
            "priority_score": top.get("priority_score"),
            "priority_rank": top.get("priority_rank") or 1,
            "estimated_revenue_impact": top.get("estimated_revenue_impact") or top.get("revenue_at_risk"),
            "affected_customers": top.get("affected_customers") or top.get("review_count"),
            "customer_reach_percentage": top.get("customer_reach_percentage"),
            "avg_severity": top.get("avg_severity"),
            "why": build_fix_first_why(top, assumptions.get("currency") or "INR"),
            "recommendation": (
                top.get("description")
                or f"Prioritize a fix for {str(top.get('issue_key') or '').replace('_', ' ')} "
                f"based on estimated business impact."
            ),
        }

    # Priority matrix coordinates: revenue pillar vs reach pillar
    matrix = []
    for r in rows:
        pillars = r.get("decision_pillars") or {}
        matrix.append({
            "issue_key": r.get("issue_key"),
            "revenue": pillars.get("revenue_impact") or 0,
            "reach": pillars.get("customer_reach") or r.get("customer_reach_percentage") or 0,
            "priority_score": r.get("priority_score"),
            "priority_rank": r.get("priority_rank"),
            "estimated_revenue_impact": r.get("estimated_revenue_impact") or r.get("revenue_at_risk") or 0,
        })

    meta = {
        "kpis": kpis,
        "fix_first": fix_first,
        "priority_matrix": matrix,
        "business_assumptions": {
            "monthly_customers": assumptions.get("monthly_customers"),
            "avg_revenue_per_user": assumptions.get("avg_revenue_per_user"),
            "premium_pct": assumptions.get("premium_pct"),
            "currency": assumptions.get("currency") or "INR",
            "configured": assumptions.get("assumptions_configured", False),
            "business_id": assumptions.get("business_id"),
            "edit_path": (
                f"/business/{assumptions['business_id']}/settings"
                if assumptions.get("business_id")
                else None
            ),
            "disclaimer": (
                "Figures are Estimated Revenue Impact / at Risk based on workspace "
                "assumptions — not actual revenue lost."
            ),
        },
    }
    return rows, meta


def _sentiment_distribution(db, session_id: str) -> dict:
    """Aggregate VADER labels already stored on reviews — no recompute on open."""
    try:
        reviews = (
            db.table("reviews")
            .select("sentiment_label")
            .eq("session_id", session_id)
            .execute()
            .data
        ) or []
    except Exception:
        return {"positive_pct": 0, "neutral_pct": 0, "negative_pct": 0, "total": 0}

    counts = {"positive": 0, "neutral": 0, "negative": 0}
    total = 0
    for r in reviews:
        if not isinstance(r, dict):
            continue
        label = (r.get("sentiment_label") or "neutral").lower()
        if label not in counts:
            label = "neutral"
        counts[label] += 1
        total += 1
    if total <= 0:
        return {"positive_pct": 0, "neutral_pct": 0, "negative_pct": 0, "total": 0}
    return {
        "positive_pct": round(counts["positive"] / total * 100),
        "neutral_pct": round(counts["neutral"] / total * 100),
        "negative_pct": round(counts["negative"] / total * 100),
        "total": total,
        "counts": counts,
    }


@router.get("/{session_id}/dashboard")
def get_dashboard(session_id: str):
    db = get_db()

    session = db.table("sessions").select("status,total_reviews,actionable_reviews,source,filename,business_id").eq("id", session_id).single().execute().data
    if not session:
        raise HTTPException(404, "Session not found")
    if session["status"] != "complete":
        raise HTTPException(202, f"Pipeline still running: {session['status']}")

    outputs = db.table("session_outputs").select("*").eq("session_id", session_id).single().execute().data

    clusters = (
        db.table("issue_clusters")
        .select("*")
        .eq("session_id", session_id)
        .order("priority_rank")
        .execute()
        .data
    ) or []

    clusters, decision_meta = _enrich_clusters(db, session_id, clusters)

    top_priority = outputs.get("top_priority") if outputs else None
    if not top_priority and clusters:
        top_priority = clusters[0]
    most_requested = outputs.get("most_requested") if outputs else None

    total_revenue_at_risk = decision_meta["kpis"]["total_estimated_revenue_impact"]

    spam_count = 0
    dup_count = 0
    try:
        spam_count = db.table("reviews").select("id", count="exact").eq("session_id", session_id).eq("is_spam", True).execute().count or 0
        dup_count = db.table("reviews").select("id", count="exact").eq("session_id", session_id).eq("is_duplicate", True).execute().count or 0
    except Exception:
        pass

    total_revs = session.get("total_reviews", 0)
    avg_conf = round(sum(c.get("avg_confidence", 85) or 85 for c in clusters) / max(len(clusters), 1)) if clusters else 94

    analysis_health = {
        "quality_score": 96 if total_revs > 0 else 100,
        "total_processed": total_revs,
        "spam_skipped": spam_count,
        "duplicates_removed": dup_count,
        "ai_confidence": avg_conf,
    }

    source = (session.get("source") or "").lower()
    is_demo = source in ("sample", "demo", "play_store")
    sentiment = _sentiment_distribution(db, session_id)

    empty_state = None
    if total_revs == 0 or not clusters:
        empty_state = {
            "code": "no_issues",
            "message": "No ranked issues yet. Collect QR feedback, upload CSV, or load sample data.",
            "actions": ["collect_qr", "upload_csv", "sample_data", "configure_metrics"],
        }
    elif not decision_meta["business_assumptions"].get("configured"):
        empty_state = {
            "code": "missing_metrics",
            "message": "Configure monthly customers and ARPU for Estimated Revenue Impact.",
            "actions": ["configure_metrics"],
        }

    # Ranked issues payload with Decision Center fields
    ranked_issues = []
    for c in clusters:
        pillars = c.get("decision_pillars") or {}
        ranked_issues.append({
            **c,
            "reports": c.get("review_count") or 0,
            "affected_customers": c.get("affected_customers") or pillars.get("affected_customers") or c.get("review_count") or 0,
            "customer_reach_percentage": c.get("customer_reach_percentage") or pillars.get("customer_reach_percentage") or 0,
            "estimated_revenue_impact": c.get("estimated_revenue_impact") or c.get("revenue_at_risk") or 0,
            "confidence": c.get("avg_confidence"),
            "recommendation": c.get("description") or (
                f"Address {str(c.get('issue_key') or '').replace('_', ' ')} — "
                f"estimated business impact prioritizes this over higher-volume low-severity issues."
            ),
        })

    return {
        "session_id":          session_id,
        "source":              session.get("source") or "unknown",
        "filename":            session.get("filename") or "",
        "is_demo_data":        is_demo,
        "total_reviews":       total_revs,
        "actionable_reviews":  session.get("actionable_reviews", 0),
        "revenue_at_risk":     round(total_revenue_at_risk, 2),
        "estimated_revenue_impact_total": round(total_revenue_at_risk, 2),
        "top_priority_issue":  top_priority,
        "most_requested_feature": most_requested,
        "executive_summary":   outputs.get("executive_summary", "") if outputs else "",
        "headline_insights":   outputs.get("headline_insights", []) if outputs else [],
        "ai_recommendation":   outputs.get("ai_recommendation", "") if outputs else "",
        "issues":              ranked_issues,
        "analysis_health":     analysis_health,
        # Decision Center envelope (stored/calc — no Gemini on open)
        "decision_center": {
            **decision_meta,
            "sentiment_distribution": sentiment,
            "empty_state": empty_state,
            "headline": "What should we fix first?",
            "supporting": "Ranks by estimated business impact, not complaint count.",
        },
        "sentiment_distribution": sentiment,
        "business_assumptions": decision_meta["business_assumptions"],
        "kpis": decision_meta["kpis"],
        "fix_first": decision_meta["fix_first"],
    }


@router.get("/{session_id}/evidence/{issue_key}")
def get_evidence(session_id: str, issue_key: str):
    """
    Evidence trail for an issue cluster — every issue is traceable to
    representative feedback with source, sentiment, severity, and priority components.
    """
    db = get_db()

    cluster = (
        db.table("issue_clusters")
        .select("*")
        .eq("session_id", session_id)
        .eq("issue_key", issue_key)
        .single()
        .execute()
        .data
    )

    if not cluster:
        raise HTTPException(404, f"Issue {issue_key} not found in session {session_id}")

    cats = (
        db.table("categorizations")
        .select("review_id,severity,confidence,summary,category")
        .eq("session_id", session_id)
        .eq("issue_key", issue_key)
        .limit(20)
        .execute()
        .data
    ) or []

    review_ids = [c["review_id"] for c in cats if c.get("review_id")]
    reviews = []
    if review_ids:
        reviews = (
            db.table("reviews")
            .select("id,cleaned_text,raw_text,source,sentiment_label,sentiment_score,rating")
            .in_("id", review_ids)
            .execute()
            .data
        ) or []
    review_map = {r["id"]: r for r in reviews if isinstance(r, dict)}

    representative = []
    for c in cats:
        r = review_map.get(c.get("review_id"), {})
        text = r.get("cleaned_text") or r.get("raw_text") or c.get("summary") or ""
        if not text:
            continue
        representative.append({
            "text": text,
            "source": r.get("source") or (cluster.get("platforms") or ["unknown"])[0],
            "sentiment": r.get("sentiment_label") or "unknown",
            "sentiment_score": r.get("sentiment_score"),
            "severity": c.get("severity") or cluster.get("avg_severity"),
            "rating": r.get("rating"),
        })

    if not representative:
        for sample in (cluster.get("sample_reviews") or [])[:5]:
            representative.append({
                "text": sample,
                "source": (cluster.get("platforms") or ["unknown"])[0],
                "sentiment": "unknown",
                "sentiment_score": cluster.get("avg_sentiment"),
                "severity": cluster.get("avg_severity"),
                "rating": None,
            })

    pillars = cluster.get("decision_pillars") or {}
    if not pillars:
        from services.revenue_impact import load_business_assumptions, score_issue
        assumptions = load_business_assumptions(db, session_id)
        siblings = (
            db.table("issue_clusters")
            .select("review_count,premium_user_count,revenue_at_risk,avg_severity")
            .eq("session_id", session_id)
            .execute()
            .data
        ) or []
        total_reviews = sum(int(s.get("review_count") or 0) for s in siblings)
        total_premium = sum(int(s.get("premium_user_count") or 0) for s in siblings)
        max_rev = max((float(s.get("revenue_at_risk") or 0) for s in siblings), default=0)
        parts = score_issue(
            affected_customers=int(cluster.get("review_count") or 0),
            premium_user_count=int(cluster.get("premium_user_count") or 0),
            avg_severity=float(cluster.get("avg_severity") or 3),
            monthly_customers=assumptions.get("monthly_customers"),
            avg_revenue_per_user=assumptions.get("avg_revenue_per_user"),
            business_premium_pct=(
                float(assumptions["premium_pct"])
                if assumptions.get("premium_pct") is not None
                else None
            ),
            max_revenue_impact=max_rev,
            total_reviews=total_reviews,
            total_premium=total_premium,
        )
        pillars = parts["decision_pillars"]

    affected = (
        pillars.get("affected_customers")
        or cluster.get("review_count")
        or 0
    )

    return {
        "issue_key":          cluster["issue_key"],
        "category":           cluster.get("category"),
        "business_area":      cluster.get("business_area"),
        "description":        cluster.get("description"),
        "confidence":         round(cluster.get("avg_confidence", 0) or 0),
        "affected_customers": affected,
        "affected_customers_label": pillars.get("affected_customers_label") or "Observed customers affected",
        "review_count":       cluster.get("review_count", 0),
        "premium_user_count": cluster.get("premium_user_count", 0),
        "revenue_at_risk":    cluster.get("revenue_at_risk", 0),
        "estimated_revenue_impact": pillars.get("estimated_revenue_impact") or cluster.get("revenue_at_risk", 0),
        "customer_reach_percentage": pillars.get("customer_reach_percentage"),
        "avg_severity":       cluster.get("avg_severity", 0),
        "avg_sentiment":      cluster.get("avg_sentiment"),
        "priority_rank":      cluster.get("priority_rank"),
        "priority_score":     cluster.get("priority_score"),
        "priority_components": pillars,
        "sources":            cluster.get("platforms", []),
        "platforms":          cluster.get("platforms", []),
        "sample_reviews":     cluster.get("sample_reviews", []),
        "representative_comments": representative[:10],
        "severity":            cluster.get("avg_severity"),
        "sentiment":          cluster.get("avg_sentiment"),
        "why_this_matters": (
            f"{affected} observed customers affected; "
            f"estimated revenue impact "
            f"{pillars.get('estimated_revenue_impact') or cluster.get('revenue_at_risk') or 0}; "
            f"severity {cluster.get('avg_severity') or 0}/5. "
            f"Not ranked by complaint volume alone."
        ),
    }


@router.get("/{session_id}/roadmap")
def get_roadmap(session_id: str):
    db = get_db()
    outputs = db.table("session_outputs").select("roadmap_json").eq("session_id", session_id).single().execute().data
    if not outputs or not outputs.get("roadmap_json"):
        raise HTTPException(404, "Roadmap not yet generated")

    raw = outputs["roadmap_json"]
    if isinstance(raw, list):
        return {
            "roadmap": raw,
            "items": [],
            "effort_disclaimer": (
                "Effort values are estimates — not exact engineering forecasts."
            ),
        }
    if isinstance(raw, dict):
        weeks = raw.get("weeks") or raw.get("roadmap") or []
        items = raw.get("items") or raw.get("roadmap_items") or []
        return {
            "roadmap": weeks,
            "items": items,
            "effort_disclaimer": raw.get("effort_disclaimer")
            or "Effort values are estimates — not exact engineering forecasts.",
        }
    raise HTTPException(500, "Invalid roadmap payload")


@router.get("/{session_id}/sprint")
def get_sprint(session_id: str):
    db = get_db()
    outputs = db.table("session_outputs").select("sprint_json").eq("session_id", session_id).single().execute().data
    if not outputs or not outputs.get("sprint_json"):
        raise HTTPException(404, "Sprint not yet generated")
    sprint = outputs["sprint_json"]
    if isinstance(sprint, dict):
        sprint.setdefault(
            "effort_disclaimer",
            "Effort and story points are estimates — validate with engineering before committing.",
        )
        for story in sprint.get("stories") or []:
            if isinstance(story, dict):
                story.setdefault("effort_is_estimate", True)
    return {"sprint": sprint}


@router.get("/history")
def get_history():
    """Decision log: last 10 sessions."""
    db = get_db()
    sessions = (
        db.table("sessions")
        .select("id,filename,source,status,total_reviews,created_at")
        .order("created_at", desc=True)
        .limit(10)
        .execute()
        .data
    )
    return {"sessions": sessions}


@router.get("/{session_id}/history")
def get_session_history(session_id: str):
    """Decision log scoped to sessions (alias, kept for backwards compat)."""
    return get_history()
