"""
Results Router — all dashboard data endpoints
"""
from fastapi import APIRouter, HTTPException
from database import get_db

router = APIRouter(prefix="/results", tags=["results"])


@router.get("/{session_id}/dashboard")
def get_dashboard(session_id: str):
    db = get_db()

    session = db.table("sessions").select("status,total_reviews,actionable_reviews").eq("id", session_id).single().execute().data
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
    )

    top_priority  = outputs.get("top_priority")  if outputs else (clusters[0]  if clusters else None)
    most_requested = outputs.get("most_requested") if outputs else None

    # Revenue at risk total (sum of top 10)
    total_revenue_at_risk = sum(c.get("revenue_at_risk", 0) or 0 for c in clusters[:10])

    return {
        "session_id":          session_id,
        "total_reviews":       session.get("total_reviews", 0),
        "actionable_reviews":  session.get("actionable_reviews", 0),
        "revenue_at_risk":     round(total_revenue_at_risk, 2),
        "top_priority_issue":  top_priority,
        "most_requested_feature": most_requested,
        "executive_summary":   outputs.get("executive_summary", "") if outputs else "",
        "headline_insights":   outputs.get("headline_insights", []) if outputs else [],
        "ai_recommendation":   outputs.get("ai_recommendation", "") if outputs else "",
        "issues":              clusters,
    }


@router.get("/{session_id}/evidence/{issue_key}")
def get_evidence(session_id: str, issue_key: str):
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

    return {
        "issue_key":        cluster["issue_key"],
        "category":         cluster["category"],
        "business_area":    cluster["business_area"],
        "description":      cluster["description"],
        "confidence":       round(cluster.get("avg_confidence", 0) or 0),
        "review_count":     cluster["review_count"],
        "premium_user_count": cluster.get("premium_user_count", 0),
        "revenue_at_risk":  cluster.get("revenue_at_risk", 0),
        "avg_severity":     cluster.get("avg_severity", 0),
        "priority_rank":    cluster.get("priority_rank"),
        "platforms":        cluster.get("platforms", []),
        "sample_reviews":   cluster.get("sample_reviews", []),
    }


@router.get("/{session_id}/roadmap")
def get_roadmap(session_id: str):
    db = get_db()
    outputs = db.table("session_outputs").select("roadmap_json").eq("session_id", session_id).single().execute().data
    if not outputs or not outputs.get("roadmap_json"):
        raise HTTPException(404, "Roadmap not yet generated")
    return {"roadmap": outputs["roadmap_json"]}


@router.get("/{session_id}/sprint")
def get_sprint(session_id: str):
    db = get_db()
    outputs = db.table("session_outputs").select("sprint_json").eq("session_id", session_id).single().execute().data
    if not outputs or not outputs.get("sprint_json"):
        raise HTTPException(404, "Sprint not yet generated")
    return {"sprint": outputs["sprint_json"]}


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
