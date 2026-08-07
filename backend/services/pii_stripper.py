import re

# Regex patterns for PII
EMAIL_RE    = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
PHONE_RE    = re.compile(r"\b(\+?\d[\d\s\-().]{7,}\d)\b")
NAME_RE     = re.compile(r"\b(Mr|Mrs|Ms|Dr|Prof)\.?\s+[A-Z][a-z]+\b")


def strip_pii(text: str) -> str:
    """Replace PII with generic placeholders before sending to Gemini."""
    text = EMAIL_RE.sub("[EMAIL]", text)
    text = PHONE_RE.sub("[PHONE]", text)
    text = NAME_RE.sub("[NAME]", text)
    return text
