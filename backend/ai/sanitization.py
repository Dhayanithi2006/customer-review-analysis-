import re
from ai.config import MAX_TEXT_TOKENS_PER_REVIEW

# Prompt Injection Defense Regex Patterns
INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior)\s+instructions", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+a", re.IGNORECASE),
    re.compile(r"system\s*:\s*", re.IGNORECASE),
    re.compile(r"developer\s+mode", re.IGNORECASE),
    re.compile(r"forget\s+(everything|all)", re.IGNORECASE),
    re.compile(r"\]\s*\n\s*\[", re.IGNORECASE),
]

# PII Regex Patterns
EMAIL_RE = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
PHONE_RE = re.compile(r"\b(\+?\d[\d\s\-().]{7,}\d)\b")
NAME_RE  = re.compile(r"\b(Mr|Mrs|Ms|Dr|Prof)\.?\s+[A-Z][a-z]+\b")


def sanitize_input_text(text: str) -> str:
    """
    Prevents Prompt Injection & Strips PII.
    - Strips injection commands
    - Redacts PII
    - Normalizes excess whitespace
    - Truncates long review texts for token optimization
    """
    if not text:
        return ""

    t = text.strip()

    # 1. Defend against Prompt Injection
    for pattern in INJECTION_PATTERNS:
        t = pattern.sub("[REDACTED_INSTRUCTION]", t)

    # 2. Strip PII
    t = EMAIL_RE.sub("[EMAIL]", t)
    t = PHONE_RE.sub("[PHONE]", t)
    t = NAME_RE.sub("[NAME]", t)

    # 3. Collapse whitespace
    t = re.sub(r"\s+", " ", t)

    # 4. Token Optimization: Truncate text to approx max tokens (4 chars ~ 1 token)
    max_chars = MAX_TEXT_TOKENS_PER_REVIEW * 4
    if len(t) > max_chars:
        t = t[:max_chars] + "..."

    return t
