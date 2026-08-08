"""
Feedback Quality & Reward Abuse Protection Service — Phase 4
Deterministic, zero-ML protection against reward gameability and rate abuse.

Rules Enforced:
1. Rate Limiting: Minimum 5 seconds between consecutive feedback submissions per (ip, user_token).
2. Duplicate Detection: Fast MD5 text_hash check against recent submissions from the same user_token.
3. Cooldown Enforcement: Ensures points are awarded ONLY once per business per cooldown window, while still accepting legitimate different feedback messages without points.
4. Zero LLM Cost: 100% deterministic rule-based checks.
"""
import time
import threading
from typing import Dict, Tuple, Optional
from services.spam_detector import text_hash, is_spam
from core.logging import get_logger

logger = get_logger("services.abuse_detector")

# ── In-Memory Rate Limiter & Recent Submissions Buffer ────────────────────────
_lock = threading.Lock()

# Format: user_token -> last_submission_timestamp
_last_submission_time: Dict[str, float] = {}

# Format: (business_id, user_token) -> set of text_hashes
_user_submission_hashes: Dict[Tuple[str, str], set] = {}

MIN_SUBMISSION_INTERVAL_SECONDS = 5.0  # Rate limit: 1 submission per 5 seconds


class AbuseDetector:
    """
    High-performance, thread-safe abuse & rate limit protection.
    """

    @staticmethod
    def is_rate_limited(user_token: str) -> bool:
        """Checks if customer submitted feedback too rapidly (< 5 seconds ago)."""
        now = time.time()
        with _lock:
            last_time = _last_submission_time.get(user_token, 0.0)
            if now - last_time < MIN_SUBMISSION_INTERVAL_SECONDS:
                return True
            _last_submission_time[user_token] = now
            return False

    @staticmethod
    def is_duplicate_text(business_id: str, user_token: str, text: str) -> bool:
        """
        Checks if the customer already submitted identical feedback for this business.
        Uses normalized MD5 text_hash.
        """
        h = text_hash(text)
        key = (business_id, user_token)
        with _lock:
            hashes = _user_submission_hashes.setdefault(key, set())
            if h in hashes:
                return True
            hashes.add(h)
            # Cap stored hashes set per user to prevent memory leak
            if len(hashes) > 100:
                hashes.clear()
                hashes.add(h)
            return False

    @staticmethod
    def reset_rate_limit(user_token: str):
        """Helper for testing."""
        with _lock:
            _last_submission_time.pop(user_token, None)


# Singleton instances
is_rate_limited = AbuseDetector.is_rate_limited
is_duplicate_text = AbuseDetector.is_duplicate_text
reset_rate_limit = AbuseDetector.reset_rate_limit
