import re
import hashlib
from difflib import SequenceMatcher
from config import FUZZY_DUPLICATE_THRESHOLD


# ── Spam detection ────────────────────────────────────────────────────────────

SPAM_PATTERNS = re.compile(
    r"^(test|aaa+|zzz+|xxx+|123+|good good|ok ok|nice nice)$",
    re.IGNORECASE
)
URL_ONLY = re.compile(r"^(https?://\S+\s*)+$")
REPEATED_WORD = re.compile(r"\b(\w+)\b(?:\s+\1){3,}", re.IGNORECASE)


def is_spam(text: str) -> bool:
    t = text.strip()
    if len(t) < 10:
        return True
    special_chars = sum(1 for c in t if not c.isalnum() and not c.isspace())
    if special_chars / max(len(t), 1) > 0.6:
        return True
    if SPAM_PATTERNS.match(t):
        return True
    if URL_ONLY.match(t):
        return True
    if REPEATED_WORD.search(t):
        return True
    return False


# ── Deduplication ─────────────────────────────────────────────────────────────

def text_hash(text: str) -> str:
    """MD5 hash of normalised text for exact-match deduplication."""
    normalised = text.lower().strip()
    return hashlib.md5(normalised.encode()).hexdigest()


def is_fuzzy_duplicate(a: str, b: str) -> bool:
    ratio = SequenceMatcher(None, a.lower(), b.lower()).ratio()
    return ratio >= FUZZY_DUPLICATE_THRESHOLD


# ── Text normalisation ────────────────────────────────────────────────────────

HTML_TAG = re.compile(r"<[^>]+>")
EXCESS_WS = re.compile(r"\s+")


def normalize(text: str) -> str:
    """Remove HTML, collapse whitespace. Keep punctuation for VADER."""
    t = HTML_TAG.sub(" ", text)
    t = EXCESS_WS.sub(" ", t)
    return t.strip()
