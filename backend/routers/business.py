"""
Business Registration Router — Phase 2 (Improved)
POST /business/register  → Create business workspace with full settings
GET  /business/{business_id}  → Get business profile
PATCH /business/{business_id}/settings → Update workspace settings

Architecture:
  Frontend → FastAPI (service_role key) → Supabase
  Never Frontend → Supabase directly for writes.
"""
import uuid
import base64
import io
from typing import Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request, Header
from pydantic import BaseModel, EmailStr, Field
from database import get_db
from core.logging import get_logger
from core.ownership import (
    assert_business_owner,
    generate_owner_token,
    hash_owner_token,
)

try:
    import qrcode
    QR_AVAILABLE = True
except ImportError:
    QR_AVAILABLE = False

logger = get_logger("routers.business")
router = APIRouter(prefix="/business", tags=["Business"])

# These are localhost dev URLs — in production swap APP_BASE_URL to your domain
APP_BASE_URL = "http://localhost:3000"

VALID_INDUSTRIES = [
    "Mobile App", "SaaS", "E-commerce", "Hospital",
    "School", "University", "Institute", "Hostel",
    "Supermarket", "Restaurant", "Hotel", "Shop", "Bank",
]

VALID_FEEDBACK_METHODS = [
    "none", "app_store", "csv", "qr", "email", "google_reviews"
]

# Industries that use QR-based physical feedback collection
QR_BASED_INDUSTRIES = {
    "Hospital", "School", "University", "Institute", "Hostel",
    "Supermarket", "Restaurant", "Hotel", "Shop", "Bank",
}
# Industries that use digital/app-based ingestion
DIGITAL_INDUSTRIES = {"Mobile App", "SaaS", "E-commerce"}

# Feedback Engagement Layer — Mode Classification
REWARD_INDUSTRIES      = {"Supermarket", "Hotel", "Restaurant", "E-commerce", "Hostel", "Shop"}
IMPROVEMENT_INDUSTRIES = {"Hospital", "School", "University", "Institute", "Bank"}
PRODUCT_INDUSTRIES     = {"Mobile App", "SaaS"}


def _derive_engagement_mode(industry: str) -> str:
    """Pure function — derives engagement mode from industry type."""
    if industry in REWARD_INDUSTRIES:
        return "reward"
    if industry in IMPROVEMENT_INDUSTRIES:
        return "improvement"
    return "product"


# ─────────────────────────────────────────────────────────────────────────────
# Request / Response Schemas
# ─────────────────────────────────────────────────────────────────────────────

class RegisterBusinessRequest(BaseModel):
    # Core identity
    business_name: str = Field(..., min_length=2, max_length=120)
    industry: str
    email: EmailStr

    # Onboarding — tailors post-registration experience
    feedback_method: str = Field(default="none")  # How they currently collect feedback

    # Workspace settings — powers the revenue impact algorithm
    monthly_customers: int = Field(default=500, ge=1)
    avg_revenue_per_user: float = Field(default=500.0, ge=0)
    premium_pct: float = Field(default=20.0, ge=0, le=100)
    currency: str = Field(default="INR", max_length=5)

    model_config = {
        "json_schema_extra": {
            "example": {
                "business_name": "Apollo Hospital Chennai",
                "industry": "Hospital",
                "email": "feedback@apollo.com",
                "feedback_method": "none",
                "monthly_customers": 2000,
                "avg_revenue_per_user": 3000.0,
                "premium_pct": 30.0,
                "currency": "INR",
            }
        }
    }


class WorkspaceSettingsUpdate(BaseModel):
    monthly_customers: Optional[int] = None
    avg_revenue_per_user: Optional[float] = None
    premium_pct: Optional[float] = None
    currency: Optional[str] = None


class BusinessResponse(BaseModel):
    id: str
    business_name: str
    industry: str
    email: str
    feedback_url: str
    dashboard_url: str
    qr_code: Optional[str]
    feedback_type: str          # "qr" | "digital"
    feedback_method: str        # How they currently collect feedback
    engagement_mode: str        # "reward" | "improvement" | "product"
    monthly_customers: int
    avg_revenue_per_user: float
    premium_pct: float
    currency: str
    created_at: str
    # Returned ONLY on register / token reset — store client-side, never log
    owner_token: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _generate_qr_base64(url: str) -> Optional[str]:
    """
    Generate QR code as a base64-encoded PNG data URI using the `qrcode` package.
    Returns None gracefully if generation fails or library is absent.
    """
    if not QR_AVAILABLE:
        logger.warning("qrcode package not installed — QR generation skipped")
        return None
    try:
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr.add_data(url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="#1e1b4b", back_color="white")
        buf = io.BytesIO()
        img.save(buf)
        buf.seek(0)
        encoded = base64.b64encode(buf.read()).decode()
        return f"data:image/png;base64,{encoded}"
    except Exception as e:
        logger.warning(f"QR generation failed: {e}")
        return None


def _build_response(row: dict, feedback_type: str, owner_token: Optional[str] = None) -> BusinessResponse:
    industry = row.get("industry", "Supermarket")
    biz_id = row.get("id", str(uuid.uuid4()))
    return BusinessResponse(
        id=biz_id,
        business_name=row.get("business_name", "Business"),
        industry=industry,
        email=row.get("email", "info@business.com"),
        feedback_url=row.get("feedback_url") or f"{APP_BASE_URL}/feedback/{biz_id}",
        dashboard_url=row.get("dashboard_url") or f"{APP_BASE_URL}/business/{biz_id}",
        qr_code=row.get("qr_code"),
        feedback_type=feedback_type,
        feedback_method=row.get("feedback_method") or "none",
        engagement_mode=row.get("engagement_mode") or _derive_engagement_mode(industry),
        monthly_customers=row.get("monthly_customers") or 500,
        avg_revenue_per_user=float(row.get("avg_revenue_per_user") or 500.0),
        premium_pct=float(row.get("premium_pct") or 20.0),
        currency=row.get("currency") or "INR",
        created_at=str(row.get("created_at") or ""),
        owner_token=owner_token,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/register", response_model=BusinessResponse, status_code=201)
async def register_business(body: RegisterBusinessRequest):
    """
    Step 1 — Register a new business workspace.

    This endpoint:
    1. Validates industry + feedback_method
    2. Checks email uniqueness
    3. Generates UUID, feedback_url, and dashboard_url
    4. Generates QR code for physical-location businesses
    5. Stores ALL workspace settings in Supabase via service_role key

    All writes go through FastAPI. Frontend never touches Supabase directly.
    """
    if body.industry not in VALID_INDUSTRIES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid industry. Must be one of: {', '.join(VALID_INDUSTRIES)}"
        )

    if body.feedback_method not in VALID_FEEDBACK_METHODS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid feedback_method. Must be one of: {', '.join(VALID_FEEDBACK_METHODS)}"
        )

    db = get_db()

    # ── Check email uniqueness
    existing = (
        db.table("businesses")
        .select("id")
        .eq("email", body.email)
        .execute()
        .data
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail="A business with this email already exists. Use a different email or contact support."
        )

    # ── Generate permanent URLs
    business_id  = str(uuid.uuid4())
    feedback_url = f"{APP_BASE_URL}/feedback/{business_id}"
    dashboard_url = f"{APP_BASE_URL}/business/{business_id}"
    feedback_type = "qr" if body.industry in QR_BASED_INDUSTRIES else "digital"

    # Always generate QR for MVP collection — encodes business-specific URL with source=qr
    qr_target = f"{feedback_url}?source=qr"
    qr_code = _generate_qr_base64(qr_target)

    # Owner auth token — plaintext returned once; only hash persisted
    owner_token = generate_owner_token()
    owner_token_hash = hash_owner_token(owner_token)

    # ── Persist to Supabase (through backend — never from frontend)
    try:
        result = (
            db.table("businesses")
            .insert({
                "id":                  business_id,
                "business_name":       body.business_name,
                "industry":            body.industry,
                "email":               body.email,
                "feedback_url":        feedback_url,
                "dashboard_url":       dashboard_url,
                "qr_code":             qr_code,
                "feedback_method":     body.feedback_method,
                "monthly_customers":   body.monthly_customers,
                "avg_revenue_per_user": body.avg_revenue_per_user,
                "premium_pct":         body.premium_pct,
                "currency":            body.currency,
                "engagement_mode":     _derive_engagement_mode(body.industry),
                "owner_token_hash":    owner_token_hash,
            })
            .execute()
        )
    except Exception as e:
        # #region agent log
        try:
            import json, time
            from pathlib import Path
            _p = Path(__file__).resolve().parents[2] / "debug-74d1c8.log"
            with open(_p, "a", encoding="utf-8") as _f:
                _f.write(json.dumps({"sessionId":"74d1c8","hypothesisId":"B","location":"business.py:register","message":"insert exception","data":{"error":str(e)[:300],"industry":body.industry},"timestamp":int(time.time()*1000)})+"\n")
        except Exception:
            pass
        # #endregion
        raise HTTPException(status_code=500, detail=f"Failed to create business: {str(e)[:200]}")

    if not result.data or not isinstance(result.data, list):
        # #region agent log
        try:
            import json, time
            from pathlib import Path
            _p = Path(__file__).resolve().parents[1] / "debug-74d1c8.log"
            # write at repo root
            _p = Path(__file__).resolve().parents[2] / "debug-74d1c8.log"
            with open(_p, "a", encoding="utf-8") as _f:
                _f.write(json.dumps({"sessionId":"74d1c8","hypothesisId":"B","location":"business.py:register","message":"insert returned empty","data":{"business_id":business_id},"timestamp":int(time.time()*1000)})+"\n")
        except Exception:
            pass
        # #endregion
        raise HTTPException(status_code=500, detail="Failed to create business record.")

    row = dict(result.data[0])
    logger.info(
        f"Business registered: id={business_id} "
        f"name={body.business_name} industry={body.industry} "
        f"feedback_method={body.feedback_method}"
    )
    # #region agent log
    try:
        import json, time
        from pathlib import Path
        _p = Path(__file__).resolve().parents[2] / "debug-74d1c8.log"
        with open(_p, "a", encoding="utf-8") as _f:
            _f.write(json.dumps({"sessionId":"74d1c8","hypothesisId":"B","location":"business.py:register","message":"register ok","data":{"business_id":business_id,"industry":body.industry,"engagement_mode":_derive_engagement_mode(body.industry),"has_qr":bool(qr_code),"feedback_type":feedback_type},"timestamp":int(time.time()*1000)})+"\n")
    except Exception:
        pass
    # #endregion

    return _build_response(row, feedback_type, owner_token=owner_token)


@router.get("/{business_id}", response_model=BusinessResponse)
async def get_business(
    business_id: str,
    request: Request,
    x_owner_token: Optional[str] = Header(None),
):
    """Fetch full business workspace profile by ID (owner-only)."""
    db = get_db()
    assert_business_owner(business_id, request=request, x_owner_token=x_owner_token, db=db)
    result = (
        db.table("businesses")
        .select("*")
        .eq("id", business_id)
        .execute()
        .data
    )
    if not result or not isinstance(result, list):
        raise HTTPException(status_code=404, detail="Business not found.")

    row = dict(result[0])
    industry_str = str(row.get("industry", ""))
    feedback_type = "qr" if industry_str in QR_BASED_INDUSTRIES else "digital"
    return _build_response(row, feedback_type)


@router.post("/{business_id}/qr/regenerate", response_model=BusinessResponse)
async def regenerate_qr(
    business_id: str,
    request: Request,
    x_owner_token: Optional[str] = Header(None),
):
    """Regenerate QR encoding /feedback/{business_id}?source=qr."""
    db = get_db()
    assert_business_owner(business_id, request=request, x_owner_token=x_owner_token, db=db)
    result = (
        db.table("businesses")
        .select("*")
        .eq("id", business_id)
        .execute()
        .data
    )
    if not result:
        raise HTTPException(status_code=404, detail="Business not found.")

    row = dict(result[0])
    feedback_url = row.get("feedback_url") or f"{APP_BASE_URL}/feedback/{business_id}"
    qr_code = _generate_qr_base64(f"{feedback_url}?source=qr")
    if not qr_code:
        raise HTTPException(status_code=500, detail="QR generation failed. Ensure qrcode is installed.")

    updated = (
        db.table("businesses")
        .update({"qr_code": qr_code, "feedback_url": feedback_url})
        .eq("id", business_id)
        .execute()
    )
    row = dict(updated.data[0]) if updated.data else {**row, "qr_code": qr_code}
    industry_str = str(row.get("industry", ""))
    feedback_type = "qr" if industry_str in QR_BASED_INDUSTRIES else "digital"
    return _build_response(row, feedback_type)


@router.post("/{business_id}/sample-data")
async def load_sample_data(
    business_id: str,
    request: Request,
    x_owner_token: Optional[str] = Header(None),
):
    """
    Load bundled sample_reviews.csv into this business workspace (source=sample).
    MVP alternative to Play Store scraping.
    """
    import asyncio
    from pathlib import Path
    import pandas as pd
    from pipeline.orchestrator import run_pipeline
    from services.business_linkage import create_analysis_version, validate_business_id

    db = get_db()
    assert_business_owner(business_id, request=request, x_owner_token=x_owner_token, db=db)
    validate_business_id(db, business_id)

    # FreshMart-style assumptions so sample ranking is algorithm-driven
    # (Payment Failure > high-volume low-severity asks when metrics warrant it).
    try:
        biz_row = (
            db.table("businesses")
            .select("monthly_customers,avg_revenue_per_user,premium_pct,currency")
            .eq("id", business_id)
            .single()
            .execute()
            .data
        ) or {}
        patch = {}
        if not biz_row.get("monthly_customers") or int(biz_row.get("monthly_customers") or 0) < 1000:
            patch["monthly_customers"] = 5000
        if not biz_row.get("avg_revenue_per_user") or float(biz_row.get("avg_revenue_per_user") or 0) < 1000:
            patch["avg_revenue_per_user"] = 10000.0
        if biz_row.get("premium_pct") is None:
            patch["premium_pct"] = 25.0
        if not biz_row.get("currency"):
            patch["currency"] = "INR"
        if patch:
            db.table("businesses").update(patch).eq("id", business_id).execute()
    except Exception:
        pass

    # Prefer repo-root sample file
    candidates = [
        Path(__file__).resolve().parents[2] / "sample_reviews.csv",
        Path(__file__).resolve().parents[1] / "sample_reviews.csv",
        Path.cwd() / "sample_reviews.csv",
    ]
    csv_path = next((p for p in candidates if p.exists()), None)
    if not csv_path:
        raise HTTPException(status_code=404, detail="sample_reviews.csv not found.")

    try:
        df = pd.read_csv(csv_path, encoding="utf-8", on_bad_lines="skip")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read sample CSV: {e}")

    text_col = "review_text" if "review_text" in df.columns else None
    if not text_col:
        for c in df.columns:
            if "review" in c.lower() or "text" in c.lower() or "feedback" in c.lower():
                text_col = c
                break
    if not text_col:
        raise HTTPException(status_code=400, detail="Sample CSV missing review text column.")

    rating_col = "rating" if "rating" in df.columns else None
    date_col = "review_date" if "review_date" in df.columns else None

    df = df.dropna(subset=[text_col])
    df = df[df[text_col].astype(str).str.strip() != ""]
    if len(df) < 10:
        raise HTTPException(status_code=400, detail="Sample data has too few reviews.")

    session_id = str(uuid.uuid4())
    db.table("sessions").insert({
        "id": session_id,
        "filename": "sample_reviews.csv",
        "source": "sample",
        "team_size": "small_team",
        "status": "pending",
        "total_reviews": len(df),
        "business_id": business_id,
    }).execute()
    create_analysis_version(db, business_id, session_id, label="Sample Data")

    rows = []
    for _, r in df.iterrows():
        rating = None
        if rating_col is not None:
            try:
                rating = int(float(r[rating_col]))
                if not (1 <= rating <= 5):
                    rating = None
            except Exception:
                rating = None
        rev_date = None
        if date_col is not None and pd.notna(r.get(date_col)):
            try:
                rev_date = pd.to_datetime(r[date_col]).date().isoformat()
            except Exception:
                rev_date = None
        rows.append({
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "raw_text": str(r[text_col]).strip(),
            "source": "sample",
            "rating": rating,
            "review_date": rev_date,
        })

    for i in range(0, len(rows), 500):
        db.table("reviews").insert(rows[i:i + 500]).execute()

    try:
        loop = asyncio.get_event_loop()
        loop.run_in_executor(None, run_pipeline, session_id)
    except Exception:
        run_pipeline(session_id)

    return {
        "success": True,
        "business_id": business_id,
        "session_id": session_id,
        "total_reviews": len(rows),
        "source": "sample",
        "status_url": f"/pipeline/{session_id}/status",
        "workspace_url": f"/business/{business_id}/analysis",
    }


@router.patch("/{business_id}/settings", response_model=BusinessResponse)
async def update_workspace_settings(
    business_id: str,
    body: WorkspaceSettingsUpdate,
    request: Request,
    x_owner_token: Optional[str] = Header(None),
):
    """
    Update workspace revenue settings.
    These settings power the Revenue Impact calculation in the Decision Engine.
    Avg Revenue Per User replaces the hardcoded ₹500 default.
    """
    db = get_db()
    assert_business_owner(business_id, request=request, x_owner_token=x_owner_token, db=db)

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update.")

    result = (
        db.table("businesses")
        .update(updates)
        .eq("id", business_id)
        .execute()
    )

    if not result.data or not isinstance(result.data, list):
        raise HTTPException(status_code=404, detail="Business not found.")

    row = dict(result.data[0])
    industry_str = str(row.get("industry", ""))
    feedback_type = "qr" if industry_str in QR_BASED_INDUSTRIES else "digital"
    return _build_response(row, feedback_type)


# ─────────────────────────────────────────────────────────────────────────────
# Analysis Version Endpoints (Phase 2 — single business_id identity)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{business_id}/analyses")
async def list_analyses(
    business_id: str,
    request: Request,
    x_owner_token: Optional[str] = Header(None),
):
    """
    List all analysis versions for a business workspace.
    Returns versions in descending order (newest first).
    """
    db = get_db()
    assert_business_owner(business_id, request=request, x_owner_token=x_owner_token, db=db)

    # Validate business exists
    biz = db.table("businesses").select("id,business_name").eq("id", business_id).execute().data
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found.")

    versions = (
        db.table("analysis_versions")
        .select("*")
        .eq("business_id", business_id)
        .order("version", desc=True)
        .execute()
        .data
    )

    # Enrich each version with session info
    enriched = []
    if isinstance(versions, list):
        for v in versions:
            if not isinstance(v, dict):
                continue
            v_dict = dict(v)
            session = (
                db.table("sessions")
                .select("status,total_reviews,actionable_reviews,source,filename,created_at")
                .eq("id", v_dict.get("session_id", ""))
                .execute()
                .data
            )
            session_data = dict(session[0]) if (session and isinstance(session, list) and isinstance(session[0], dict)) else {}
            # Sync version status from session
            v_dict["status"] = session_data.get("status", v_dict.get("status", "pending"))
            v_dict["total_reviews"] = session_data.get("total_reviews", 0)
            v_dict["actionable_reviews"] = session_data.get("actionable_reviews", 0)
            v_dict["source"] = session_data.get("source", "unknown")
            v_dict["filename"] = session_data.get("filename", "")
            enriched.append(v_dict)

    biz_name = dict(biz[0]).get("business_name", "") if (biz and isinstance(biz, list) and len(biz) > 0) else ""

    return {
        "business_id":   business_id,
        "business_name": biz_name,
        "total_analyses": len(enriched),
        "analyses":      enriched,
    }


@router.get("/{business_id}/analyses/latest")
async def get_latest_analysis(
    business_id: str,
    request: Request,
    x_owner_token: Optional[str] = Header(None),
):
    """
    Get the most recent COMPLETED analysis session for a business.
    This is the single source of truth for the Decision Center.
    Returns the session_id to be used for fetching dashboard data.
    """
    db = get_db()
    assert_business_owner(business_id, request=request, x_owner_token=x_owner_token, db=db)

    biz = db.table("businesses").select("id").eq("id", business_id).execute().data
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found.")

    # Get latest completed session linked to this business
    latest_version = (
        db.table("analysis_versions")
        .select("session_id,version,label,created_at")
        .eq("business_id", business_id)
        .order("version", desc=True)
        .limit(10)
        .execute()
        .data
    )

    if not latest_version or not isinstance(latest_version, list):
        return {
            "has_analysis": False,
            "session_id": None,
            "version": None,
            "message": "No analysis has been run yet. Upload feedback to get started.",
        }

    # Find first completed one
    for v in latest_version:
        if not isinstance(v, dict):
            continue
        session = (
            db.table("sessions")
            .select("status,total_reviews,actionable_reviews,created_at")
            .eq("id", v.get("session_id", ""))
            .execute()
            .data
        )
        if session and isinstance(session, list) and isinstance(session[0], dict) and session[0].get("status") == "complete":
            s_row = dict(session[0])
            return {
                "has_analysis": True,
                "session_id":   v.get("session_id"),
                "version":      v.get("version"),
                "label":        v.get("label"),
                "created_at":   str(s_row.get("created_at", "")),
                "total_reviews": s_row.get("total_reviews", 0),
                "actionable_reviews": s_row.get("actionable_reviews", 0),
            }

    # Latest run is still processing
    v_top = dict(latest_version[0]) if isinstance(latest_version[0], dict) else {}
    session = db.table("sessions").select("status,current_step").eq("id", v_top.get("session_id", "")).execute().data
    status = (session[0].get("status", "pending") if (session and isinstance(session, list) and isinstance(session[0], dict)) else "pending")

    return {
        "has_analysis":  False,
        "session_id":    v_top.get("session_id"),
        "version":       v_top.get("version"),
        "label":         v_top.get("label"),
        "status":        status,
        "message":       f"Analysis {v_top.get('label', '')} is currently {status}.",
    }


@router.get("/{business_id}/reviews")
async def get_business_reviews(
    business_id: str,
    request: Request,
    x_owner_token: Optional[str] = Header(None),
    limit: int = 50,
    offset: int = 0,
):
    """
    Review Repository — all reviews imported for this business workspace.
    Returns paginated list across all analysis versions.
    """
    db = get_db()
    assert_business_owner(business_id, request=request, x_owner_token=x_owner_token, db=db)

    biz = db.table("businesses").select("id,business_name").eq("id", business_id).execute().data
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found.")

    # Get all session_ids for this business
    versions = (
        db.table("analysis_versions")
        .select("session_id")
        .eq("business_id", business_id)
        .execute()
        .data
    )

    if not versions:
        return {
            "business_id": business_id,
            "total": 0,
            "reviews": [],
            "message": "No reviews yet. Upload feedback to populate the Review Repository.",
        }

    session_ids = [v["session_id"] for v in versions]

    # Fetch reviews across all sessions (paginated)
    total_query = (
        db.table("reviews")
        .select("id", count="exact")
        .in_("session_id", session_ids)
        .execute()
    )
    total = total_query.count or 0

    reviews = (
        db.table("reviews")
        .select("id,session_id,raw_text,rating,source,review_date,is_spam,is_duplicate,sentiment_label,sentiment_score")
        .in_("session_id", session_ids)
        .order("review_date", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
        .data
    )

    return {
        "business_id": business_id,
        "total":       total,
        "limit":       limit,
        "offset":      offset,
        "reviews":     reviews,
    }


@router.get("/{business_id}/feedback-health")
async def get_feedback_health(
    business_id: str,
    request: Request,
    x_owner_token: Optional[str] = Header(None),
):
    """Owner-only feedback health aggregates for workspace overview."""
    from datetime import datetime, timezone, timedelta

    db = get_db()
    assert_business_owner(business_id, request=request, x_owner_token=x_owner_token, db=db)

    biz = db.table("businesses").select("id,business_name,industry").eq("id", business_id).execute().data
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found.")

    industry = biz[0]["industry"]

    # 1. Fetch engagement settings mode
    settings_res = db.table("feedback_engagement_settings").select("feedback_mode").eq("business_id", business_id).execute().data
    mode = settings_res[0]["feedback_mode"] if settings_res else _derive_engagement_mode(industry)

    # 2. Count feedback submissions & weekly count
    now = datetime.now(timezone.utc)
    one_week_ago = (now - timedelta(days=7)).isoformat()

    subs = db.table("feedback_submissions").select("id,created_at").eq("business_id", business_id).execute().data or []
    total_form_subs = len(subs)
    weekly_subs = sum(1 for s in subs if str(s.get("created_at", "")) >= one_week_ago)

    # 3. Sum reward points issued
    rewards = db.table("feedback_rewards").select("points_awarded").eq("business_id", business_id).eq("reward_status", "awarded").execute().data or []
    total_points_issued = sum(r.get("points_awarded", 0) for r in rewards)

    # 4. Review repository metrics (sessions)
    versions = db.table("analysis_versions").select("session_id").eq("business_id", business_id).execute().data or []
    session_ids = [v["session_id"] for v in versions]

    total_reviews = 0
    top_source = "QR Code Form" if industry in QR_BASED_INDUSTRIES else "App Direct Ingestion"
    sentiment_counts = {"negative": 0, "neutral": 0, "positive": 0}
    most_repeated_issue = "—"

    if session_ids:
        rev_data = db.table("reviews").select("sentiment_label,source").in_("session_id", session_ids).execute().data or []
        total_reviews = len(rev_data)

        for r in rev_data:
            lbl = (r.get("sentiment_label") or "").lower()
            if "neg" in lbl:
                sentiment_counts["negative"] += 1
            elif "pos" in lbl:
                sentiment_counts["positive"] += 1
            else:
                sentiment_counts["neutral"] += 1

        # Fetch top priority issue from latest dashboard if available
        dash_res = db.table("analysis_versions").select("session_id").eq("business_id", business_id).eq("status", "complete").order("version", desc=True).limit(1).execute().data
        if dash_res:
            latest_sid = dash_res[0]["session_id"]
            d_res = db.table("dashboard_cache").select("dashboard_json").eq("session_id", latest_sid).execute().data
            if d_res and "top_priority_issue" in d_res[0].get("dashboard_json", {}):
                issue = d_res[0]["dashboard_json"]["top_priority_issue"]
                if isinstance(issue, dict):
                    most_repeated_issue = issue.get("issue_key", "—").replace("_", " ")
                elif isinstance(issue, str):
                    most_repeated_issue = issue

    total_feedback = total_form_subs + total_reviews
    total_sent = sum(sentiment_counts.values()) or 1
    neg_pct = round((sentiment_counts["negative"] / total_sent) * 100)
    pos_pct = round((sentiment_counts["positive"] / total_sent) * 100)

    return {
        "business_id": business_id,
        "total_feedback": total_feedback,
        "feedback_this_week": weekly_subs,
        "engagement_mode": mode,
        "points_issued": total_points_issued,
        "top_source": top_source,
        "most_repeated_issue": most_repeated_issue,
        "sentiment_distribution": {
            "negative_pct": neg_pct,
            "positive_pct": pos_pct,
            "neutral_pct": 100 - (neg_pct + pos_pct),
        }
    }


@router.get("/{business_id}/rewards/summary")
async def get_rewards_summary(
    business_id: str,
    request: Request,
    x_owner_token: Optional[str] = Header(None),
):
    """
    Owner-only aggregates for the Rewards workspace page.
    Never returns customer PII — only counts and points totals.
    """
    db = get_db()
    assert_business_owner(business_id, request=request, x_owner_token=x_owner_token, db=db)

    biz = db.table("businesses").select("id,business_name,industry").eq("id", business_id).execute().data
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found.")

    rewards = (
        db.table("feedback_rewards")
        .select("points_awarded,reward_status,created_at")
        .eq("business_id", business_id)
        .execute()
        .data
    ) or []

    awarded = [r for r in rewards if r.get("reward_status") == "awarded"]
    skipped = [r for r in rewards if r.get("reward_status") == "cooldown_skipped"]
    ineligible = [r for r in rewards if r.get("reward_status") == "ineligible"]
    total_points = sum(int(r.get("points_awarded") or 0) for r in awarded)

    return {
        "business_id": business_id,
        "business_name": biz[0].get("business_name"),
        "industry": biz[0].get("industry"),
        "total_reward_events": len(rewards),
        "awarded_count": len(awarded),
        "cooldown_skipped_count": len(skipped),
        "ineligible_count": len(ineligible),
        "total_points_issued": total_points,
        "note": "Aggregates only — customer wallets and contact details are not exposed.",
    }

