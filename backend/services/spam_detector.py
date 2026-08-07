import re
import hashlib
from difflib import SequenceMatcher
from config import SPAM_MIN_CHARS, SPAM_MAX_SPECIAL_RATIO, FUZZY_DUPLICATE_THRESHOLD
from core.logging import get_logger

logger = get_logger("services.spam_detector")

# Regex patterns for spam detection
SPAM_PATTERNS = re.compile(
    r"^(test|aaa+|zzz+|xxx+|123+|good good|ok ok|nice nice|asdf|qwerty)$",
    re.IGNORECASE
)
URL_ONLY_RE = re.compile(r"^(https?://\S+\s*)+$", re.IGNORECASE)
REPEATED_WORD_RE = re.compile(r"\b(\w+)\b(?:\s+\1){3,}", re.IGNORECASE)
HTML_TAG_RE = re.compile(r"<[^>]+>")
EXCESS_WS_RE = re.compile(r"\s+")


class SpamDetector:
    """
    Module 10 — Spam Detection.
    Rule-based, high-performance detector for low-quality or spam reviews.
    Zero AI cost.
    """

    def is_spam(self, text: str) -> bool:
        t = text.strip()
        
        # Rule 1: Minimum character count
        if len(t) < SPAM_MIN_CHARS:
            return True

        # Rule 2: Special character ratio
        special_chars = sum(1 for c in t if not c.isalnum() and not c.isspace())
        if (special_chars / max(len(t), 1)) > SPAM_MAX_SPECIAL_RATIO:
            return True

        # Rule 3: Known spam single-word patterns
        if SPAM_PATTERNS.match(t):
            return True

        # Rule 4: URL-only content
        if URL_ONLY_RE.match(t):
            return True

        # Rule 5: Same word repeated >= 4 times continuously
        if REPEATED_WORD_RE.search(t):
            return True

        return False


# Standalone functions for pipeline backward compatibility
_default_spam_detector = SpamDetector()

def is_spam(text: str) -> bool:
    return _default_spam_detector.is_spam(text)

def normalize(text: str) -> str:
    t = HTML_TAG_RE.sub(" ", text)
    t = EXCESS_WS_RE.sub(" ", t)
    return t.strip()

def text_hash(text: str) -> str:
    normalised = " ".join(text.lower().split())
    return hashlib.md5(normalised.encode("utf-8")).hexdigest()

def is_fuzzy_duplicate(text_a: str, text_b: str, threshold: float = FUZZY_DUPLICATE_THRESHOLD) -> bool:
    return SequenceMatcher(None, text_a.lower(), text_b.lower()).ratio() >= threshold
