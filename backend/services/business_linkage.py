"""
Phase 1 — Business-centric linkage helpers.

Every analysis session must belong to a business_id.
Frontend never talks to Supabase; only the FastAPI backend uses the service role.
"""
from __future__ import annotations

import uuid
from typing import Any, Optional

from fastapi import HTTPException

from core.logging import get_logger

logger = get_logger("services.business_linkage")

APP_BASE_URL = "http://localhost:3000"


def validate_business_id(db, business_id: str) -> dict:
    rows = (
        db.table("businesses")
        .select("id,business_name,industry")
        .eq("id", business_id)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Business not found.")
    return rows[0]


def create_analysis_business(db, *, label: str, source: str) -> str:
    """
    Provision a lightweight workspace for unscoped CSV / Play Store analyses
    so every session still has a business_id (landing-page demo path).
    """
    business_id = str(uuid.uuid4())
    short = business_id[:8]
    name = (label or "Quick Analysis").strip()[:80] or "Quick Analysis"
    industry = "Mobile App" if source in {"play_store", "app_store"} else "SaaS"
    email = f"analysis-{short}@roadmapai.local"
    feedback_url = f"{APP_BASE_URL}/feedback/{business_id}"
    dashboard_url = f"{APP_BASE_URL}/business/{business_id}"

    db.table("businesses").insert({
        "id": business_id,
        "business_name": name,
        "industry": industry,
        "email": email,
        "feedback_url": feedback_url,
        "dashboard_url": dashboard_url,
        "feedback_method": "csv" if source == "csv" else source,
        "monthly_customers": 1000,
        "avg_revenue_per_user": 500,
        "premium_pct": 20,
        "currency": "INR",
    }).execute()

    logger.info(f"Auto-created analysis business id={business_id} source={source}")
    return business_id


def resolve_business_id(
    db,
    business_id: Optional[str],
    *,
    label: str,
    source: str,
) -> str:
    """Validate provided business_id or create a workspace for unscoped ingest."""
    if business_id and str(business_id).strip():
        validate_business_id(db, str(business_id).strip())
        return str(business_id).strip()
    return create_analysis_business(db, label=label, source=source)


def create_analysis_version(
    db,
    business_id: str,
    session_id: str,
    *,
    label: Optional[str] = None,
    status: str = "pending",
) -> None:
    """Link a session to a business in analysis_versions (idempotent-ish)."""
    try:
        existing = (
            db.table("analysis_versions")
            .select("version")
            .eq("business_id", business_id)
            .order("version", desc=True)
            .limit(1)
            .execute()
            .data
        )
        next_version = (existing[0]["version"] + 1) if existing else 1
        db.table("analysis_versions").insert({
            "business_id": business_id,
            "session_id": session_id,
            "version": next_version,
            "label": label or f"Version {next_version}",
            "status": status,
        }).execute()
    except Exception as e:
        logger.warning(f"analysis_versions insert failed (non-fatal): {type(e).__name__}")


def get_session_business_id(db, session_id: str) -> Optional[str]:
    row = (
        db.table("sessions")
        .select("business_id")
        .eq("id", session_id)
        .limit(1)
        .execute()
        .data
    )
    if not row:
        return None
    return row[0].get("business_id")
