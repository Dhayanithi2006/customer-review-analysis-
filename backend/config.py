import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env relative to config.py location
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)
load_dotenv()

# System & Environment Settings
ENV: str = os.getenv("ENV", "development")
DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")

# API Keys & DB Credentials
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")
# Unused — direct collection is QR/form only (Telegram kept in codebase but not mounted)
TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")

# Financial & Scoring Assumptions
AVG_REVENUE_PER_USER: float = float(os.getenv("AVG_REVENUE_PER_USER", "500"))

# Pipeline Constraints & Batching
BATCH_SIZE: int = int(os.getenv("BATCH_SIZE", "50"))
MAX_REVIEWS: int = int(os.getenv("MAX_REVIEWS", "10000"))

# Cleaning & Spam Detection Constants
SPAM_MIN_CHARS: int = 10
SPAM_MAX_SPECIAL_RATIO: float = 0.6
# High threshold = only near-exact / obvious duplicates (not similar complaints)
FUZZY_DUPLICATE_THRESHOLD: float = 0.92

# Priority Engine Formula Weights
# Formula: Revenue×0.35 + CustomerReach×0.30 + Severity×0.20 + CustomerTier×0.15
# Components normalized 0–100; Gemini never computes this score.
WEIGHT_REVENUE: float = 0.35
WEIGHT_FREQUENCY: float = 0.30  # Customer Reach
WEIGHT_SEVERITY: float = 0.20
WEIGHT_TIER: float = 0.15
SEVERITY_MAX: int = 5

# Gemini Settings
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_MAX_RETRIES: int = 2
GEMINI_TIMEOUT_SECONDS: int = 60

# Fixed Category Taxonomy (Phase 3)
VALID_CATEGORIES = [
    "bug", "feature_request", "ux", "pricing",
    "service", "performance", "payment", "other",
]

VALID_BUSINESS_AREAS = [
    "Checkout", "Auth", "Core Feature", "UI",
    "Billing", "API", "Other"
]

# Cache TTL Configuration (in seconds)
CACHE_TTL_SECONDS: int = 300

# Owner auth: require X-Owner-Token on protected business routes.
# Tests set OWNER_AUTH_ENFORCE=false so legacy mocks without hashes still pass.
OWNER_AUTH_ENFORCE: bool = os.getenv("OWNER_AUTH_ENFORCE", "true").lower() == "true"
