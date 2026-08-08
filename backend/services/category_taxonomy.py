"""
Phase 3 — Category / severity / confidence helpers for Gemini categorization.
Canonical categories (snake_case). Legacy Title-Case aliases are accepted.
"""
from __future__ import annotations

import re
from typing import Any, Optional

# Phase 3 canonical categories
PHASE3_CATEGORIES = {
    "bug",
    "feature_request",
    "ux",
    "pricing",
    "service",
    "performance",
    "payment",
    "other",
}

CATEGORY_ALIASES = {
    "bug": "bug",
    "feature_request": "feature_request",
    "feature request": "feature_request",
    "ux": "ux",
    "pricing": "pricing",
    "service": "service",
    "customer support": "service",
    "customer_support": "service",
    "performance": "performance",
    "payment": "payment",
    "other": "other",
    "praise": "other",
    "onboarding": "ux",
    "data & privacy": "other",
    "data_privacy": "other",
    "integration": "other",
}

# Display labels for UI
CATEGORY_DISPLAY = {
    "bug": "Bug",
    "feature_request": "Feature Request",
    "ux": "UX",
    "pricing": "Pricing",
    "service": "Service",
    "performance": "Performance",
    "payment": "Payment",
    "other": "Other",
}

SEVERITY_MAX = 5


def normalize_category(raw: Any) -> Optional[str]:
    if raw is None:
        return None
    key = str(raw).strip().lower().replace("-", "_")
    key = re.sub(r"\s+", " ", key)
    # try exact alias (spaces and underscores)
    if key in CATEGORY_ALIASES:
        return CATEGORY_ALIASES[key]
    underscored = key.replace(" ", "_")
    if underscored in CATEGORY_ALIASES:
        return CATEGORY_ALIASES[underscored]
    if underscored in PHASE3_CATEGORIES:
        return underscored
    return None


def display_category(raw: Any) -> str:
    canon = normalize_category(raw) or "other"
    return CATEGORY_DISPLAY.get(canon, str(raw))


def normalize_issue_key(raw: Any) -> str:
    """Normalize to lowercase_snake_case (Phase 3: payment_failure)."""
    text = str(raw or "general_issue").strip()
    text = text.replace("-", "_").replace(" ", "_")
    text = re.sub(r"[^A-Za-z0-9_]", "", text)
    text = re.sub(r"_+", "_", text).strip("_").lower()
    if not text:
        text = "general_issue"
    if text[0].isdigit():
        text = f"issue_{text}"
    return text[:40]


def normalize_severity(raw: Any) -> int:
    """
    Accept 1-5 (Phase 3) or legacy 1-10 (scale down).
    """
    try:
        sev = float(raw)
    except Exception:
        return 3
    if sev > SEVERITY_MAX:
        # Legacy 1-10 → map into 1-5
        sev = round(sev / 2.0)
    sev = int(round(sev))
    return max(1, min(SEVERITY_MAX, sev))


def normalize_confidence(raw: Any) -> float:
    """
    Accept 0-1 (Phase 3) or legacy 0-100.
    Returns float in [0, 1].
    """
    try:
        conf = float(raw)
    except Exception:
        return 0.5
    if conf > 1.0:
        conf = conf / 100.0
    return max(0.0, min(1.0, conf))
