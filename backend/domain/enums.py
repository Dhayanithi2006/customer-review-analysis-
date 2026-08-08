from enum import Enum

class ReviewSource(str, Enum):
    CSV = "csv"
    SAMPLE = "sample"
    QR = "qr"
    DIRECT = "direct"
    # Legacy aliases kept for older rows
    PLAY_STORE = "play_store"
    APP_STORE = "app_store"
    SUPPORT = "support"
    TWITTER = "twitter"
    REDDIT = "reddit"
    QR_FORM = "qr_form"
    WEB_FORM = "web_form"
    TELEGRAM = "telegram"

# MVP collection channels (Phase 2)
MVP_FEEDBACK_SOURCES = {"qr", "direct", "csv", "sample"}
LEGACY_SOURCE_MAP = {
    "qr_form": "qr",
    "web_form": "direct",
}

class SentimentLabel(str, Enum):
    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"

class CategoryType(str, Enum):
    BUG = "bug"
    FEATURE_REQUEST = "feature_request"
    UX = "ux"
    PRICING = "pricing"
    SERVICE = "service"
    PERFORMANCE = "performance"
    PAYMENT = "payment"
    OTHER = "other"
    # Legacy display aliases (accepted via category_taxonomy)
    BUG_LEGACY = "Bug"
    FEATURE_REQUEST_LEGACY = "Feature Request"
    PERFORMANCE_LEGACY = "Performance"

class BusinessArea(str, Enum):
    CHECKOUT = "Checkout"
    AUTH = "Auth"
    CORE_FEATURE = "Core Feature"
    UI = "UI"
    BILLING = "Billing"
    API = "API"
    OTHER = "Other"
