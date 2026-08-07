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
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field
from database import get_db
from core.logging import get_logger

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
    "School", "Hostel", "Supermarket", "Restaurant", "Hotel", "Bank"
]

VALID_FEEDBACK_METHODS = [
    "none", "app_store", "csv", "qr", "email", "google_reviews"
]

# Industries that use QR-based physical feedback collection
QR_BASED_INDUSTRIES = {"Hospital", "School", "Hostel", "Supermarket", "Restaurant", "Hotel", "Bank"}
# Industries that use digital/app-based ingestion
DIGITAL_INDUSTRIES = {"Mobile App", "SaaS", "E-commerce"}


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
    monthly_customers: int
    avg_revenue_per_user: float
    premium_pct: float
    currency: str
    created_at: str


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
        img.save(buf, format="PNG")
        buf.seek(0)
        encoded = base64.b64encode(buf.read()).decode()
        return f"data:image/png;base64,{encoded}"
    except Exception as e:
        logger.warning(f"QR generation failed: {e}")
        return None


def _build_response(row: dict, feedback_type: str) -> BusinessResponse:
    return BusinessResponse(
        id=row["id"],
        business_name=row["business_name"],
        industry=row["industry"],
        email=row["email"],
        feedback_url=row["feedback_url"],
        dashboard_url=row.get("dashboard_url") or f"{APP_BASE_URL}/business/{row['id']}",
        qr_code=row.get("qr_code"),
        feedback_type=feedback_type,
        feedback_method=row.get("feedback_method") or "none",
        monthly_customers=row.get("monthly_customers") or 500,
        avg_revenue_per_user=float(row.get("avg_revenue_per_user") or 500.0),
        premium_pct=float(row.get("premium_pct") or 20.0),
        currency=row.get("currency") or "INR",
        created_at=str(row["created_at"]),
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

    # ── Generate QR code (only for physical businesses, pointing to feedback URL)
    qr_code = _generate_qr_base64(feedback_url) if feedback_type == "qr" else None

    # ── Persist to Supabase (through backend — never from frontend)
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
        })
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create business record.")

    row = result.data[0]
    logger.info(
        f"Business registered: id={business_id} "
        f"name={body.business_name} industry={body.industry} "
        f"feedback_method={body.feedback_method}"
    )

    return _build_response(row, feedback_type)


@router.get("/{business_id}", response_model=BusinessResponse)
async def get_business(business_id: str):
    """Fetch full business workspace profile by ID."""
    db = get_db()
    result = (
        db.table("businesses")
        .select("*")
        .eq("id", business_id)
        .execute()
        .data
    )
    if not result:
        raise HTTPException(status_code=404, detail="Business not found.")

    row = result[0]
    feedback_type = "qr" if row["industry"] in QR_BASED_INDUSTRIES else "digital"
    return _build_response(row, feedback_type)


@router.patch("/{business_id}/settings", response_model=BusinessResponse)
async def update_workspace_settings(business_id: str, body: WorkspaceSettingsUpdate):
    """
    Update workspace revenue settings.
    These settings power the Revenue Impact calculation in the Decision Engine.
    Avg Revenue Per User replaces the hardcoded ₹500 default.
    """
    db = get_db()

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update.")

    result = (
        db.table("businesses")
        .update(updates)
        .eq("id", business_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Business not found.")

    row = result.data[0]
    feedback_type = "qr" if row["industry"] in QR_BASED_INDUSTRIES else "digital"
    return _build_response(row, feedback_type)
