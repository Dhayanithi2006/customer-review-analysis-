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

# Financial & Scoring Assumptions
AVG_REVENUE_PER_USER: float = float(os.getenv("AVG_REVENUE_PER_USER", "500"))

# Pipeline Constraints & Batching
BATCH_SIZE: int = int(os.getenv("BATCH_SIZE", "50"))
MAX_REVIEWS: int = int(os.getenv("MAX_REVIEWS", "10000"))

# Cleaning & Spam Detection Constants
SPAM_MIN_CHARS: int = 10
SPAM_MAX_SPECIAL_RATIO: float = 0.6
FUZZY_DUPLICATE_THRESHOLD: float = 0.88

# Priority Engine Formula Weights
WEIGHT_REVENUE: float = 0.30
WEIGHT_FREQUENCY: float = 0.25
WEIGHT_SEVERITY: float = 0.20
WEIGHT_TIER: float = 0.15
WEIGHT_RECENCY: float = 0.10

# Gemini Settings
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
GEMINI_MAX_RETRIES: int = 2
GEMINI_TIMEOUT_SECONDS: int = 60

# Fixed Category Taxonomy
VALID_CATEGORIES = [
    "Bug", "Performance", "UX", "Pricing",
    "Feature Request", "Onboarding", "Customer Support",
    "Data & Privacy", "Integration", "Praise"
]

VALID_BUSINESS_AREAS = [
    "Checkout", "Auth", "Core Feature", "UI",
    "Billing", "API", "Other"
]

# Cache TTL Configuration (in seconds)
CACHE_TTL_SECONDS: int = 300
