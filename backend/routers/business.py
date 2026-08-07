"""
Business Registration Router — Phase 2
POST /business/register  → Create business, generate feedback URL + QR code
GET  /business/{business_id}  → Get business profile
"""
import uuid
import base64
import io
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field
from database import get_db
from core.logging import get_logger

try:
    import qrcode
    from qrcode.image.pure import PyPNGImage
    QR_AVAILABLE = True
except ImportError:
    QR_AVAILABLE = False

logger = get_logger("routers.business")
router = APIRouter(prefix="/business", tags=["Business"])

APP_BASE_URL = "https://roadmapai.app"

VALID_INDUSTRIES = [
    "Mobile App", "SaaS", "E-commerce", "Hospital",
    "School", "Hostel", "Supermarket", "Restaurant", "Hotel", "Bank"
]

# ── Industries that use QR-based physical feedback
QR_BASED_INDUSTRIES = {"Hospital", "School", "Hostel", "Supermarket", "Restaurant", "Hotel", "Bank"}
# ── Industries that use digital/app-based ingestion
DIGITAL_INDUSTRIES = {"Mobile App", "SaaS", "E-commerce"}


class RegisterBusinessRequest(BaseModel):
    business_name: str = Field(..., min_length=2, max_length=120)
    industry: str
    email: EmailStr

    class Config:
        json_schema_extra = {
            "example": {
                "business_name": "Apollo Hospital Chennai",
                "industry": "Hospital",
                "email": "feedback@apollo.com",
            }
        }


class BusinessResponse(BaseModel):
    id: str
    business_name: str
    industry: str
    email: str
    feedback_url: str
    qr_code: str | None
    feedback_type: str  # "qr" or "digital"
    created_at: str


def _generate_qr_base64(url: str) -> str | None:
    """Generate QR code as base64 PNG string."""
    if not QR_AVAILABLE:
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
        return "data:image/png;base64," + base64.b64encode(buf.read()).decode()
    except Exception as e:
        logger.warning(f"QR generation failed: {e}")
        return None


@router.post("/register", response_model=BusinessResponse, status_code=201)
async def register_business(body: RegisterBusinessRequest):
    """
    Register a new business workspace.
    - Validates industry
    - Generates unique feedback_url
    - Generates QR code (for physical-location businesses)
    - Stores in Supabase
    """
    if body.industry not in VALID_INDUSTRIES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid industry. Choose from: {', '.join(VALID_INDUSTRIES)}"
        )

    db = get_db()

    # Check email uniqueness
    existing = (
        db.table("businesses")
        .select("id")
        .eq("email", body.email)
        .execute()
        .data
    )
    if existing:
        raise HTTPException(status_code=409, detail="A business with this email already exists.")

    business_id = str(uuid.uuid4())
    feedback_url = f"{APP_BASE_URL}/feedback/{business_id}"
    feedback_type = "qr" if body.industry in QR_BASED_INDUSTRIES else "digital"

    # Generate QR only for physical-location businesses
    qr_code = _generate_qr_base64(feedback_url) if feedback_type == "qr" else None

    result = (
        db.table("businesses")
        .insert({
            "id": business_id,
            "business_name": body.business_name,
            "industry": body.industry,
            "email": body.email,
            "feedback_url": feedback_url,
            "qr_code": qr_code,
        })
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create business record.")

    row = result.data[0]
    logger.info(f"Business registered: id={business_id} name={body.business_name} industry={body.industry}")

    return BusinessResponse(
        id=row["id"],
        business_name=row["business_name"],
        industry=row["industry"],
        email=row["email"],
        feedback_url=row["feedback_url"],
        qr_code=row.get("qr_code"),
        feedback_type=feedback_type,
        created_at=str(row["created_at"]),
    )


@router.get("/{business_id}", response_model=BusinessResponse)
async def get_business(business_id: str):
    """Fetch business profile by ID."""
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
    industry = row["industry"]
    feedback_type = "qr" if industry in QR_BASED_INDUSTRIES else "digital"

    return BusinessResponse(
        id=row["id"],
        business_name=row["business_name"],
        industry=row["industry"],
        email=row["email"],
        feedback_url=row["feedback_url"],
        qr_code=row.get("qr_code"),
        feedback_type=feedback_type,
        created_at=str(row["created_at"]),
    )
