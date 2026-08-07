import os
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)
load_dotenv()



GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")
FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
AVG_REVENUE_PER_USER: float = float(os.getenv("AVG_REVENUE_PER_USER", "500"))

# Pipeline constants
BATCH_SIZE = 50
MAX_REVIEWS = 10_000
SPAM_MIN_CHARS = 10
SPAM_MAX_SPECIAL_RATIO = 0.6
FUZZY_DUPLICATE_THRESHOLD = 0.88

# Priority formula weights
WEIGHT_REVENUE   = 0.30
WEIGHT_FREQUENCY = 0.25
WEIGHT_SEVERITY  = 0.20
WEIGHT_TIER      = 0.15
WEIGHT_RECENCY   = 0.10

# Gemini
GEMINI_MODEL = "gemini-3.6-flash"
GEMINI_MAX_RETRIES = 2
GEMINI_TIMEOUT_SECONDS = 60

# Fixed category taxonomy
VALID_CATEGORIES = [
    "Bug", "Performance", "UX", "Pricing",
    "Feature Request", "Onboarding", "Customer Support",
    "Data & Privacy", "Integration", "Praise"
]

VALID_BUSINESS_AREAS = [
    "Checkout", "Auth", "Core Feature", "UI",
    "Billing", "API", "Other"
]
