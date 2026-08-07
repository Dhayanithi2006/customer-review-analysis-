import os

# Gemini Flash Model Configuration
AI_MODEL_NAME: str = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
AI_MAX_RETRIES: int = 3
AI_TIMEOUT_SECONDS: float = 45.0

# Temperature Recommendations per Call Type
TEMP_CATEGORIZATION: float = 0.1  # Deterministic for categorization & labeling
TEMP_SUMMARY: float = 0.2         # Low temperature for factual summarization
TEMP_ROADMAP: float = 0.3         # Subtle creativity for strategic effort sequencing
TEMP_WEEKLY_REVIEW: float = 0.2   # Grounded Q&A response generation

# Token & Batch Limits
MAX_BATCH_SIZE: int = 50
MAX_BATCH_TOKENS: int = 4000
MAX_TEXT_TOKENS_PER_REVIEW: int = 250

# Rate Limiter Settings (Requests Per Minute for Gemini Free/Paid Tier)
RATE_LIMIT_RPM: int = 60
RATE_LIMIT_CONCURRENCY: int = 5
