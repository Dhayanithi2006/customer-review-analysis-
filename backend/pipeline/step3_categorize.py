"""
Step 3 — Gemini Batch Categorization (LLM Call 1)
Batches actionable reviews and sends to Gemini for structured categorization.

Phase 3 schema per item:
  review_id, category, severity (1-5), issue_key, confidence (0-1), summary

Gemini NEVER calculates business priority.
On Gemini failure: preserve VADER results, mark AI unavailable, apply
rule-based fallback so clustering can continue, allow retry.
"""
from __future__ import annotations

import json
import pathlib
import re
from typing import Any, Optional
from pydantic import BaseModel, Field, field_validator, model_validator
from database import get_db
from services.gemini_client import call_gemini
from services.category_taxonomy import (
    PHASE3_CATEGORIES,
    normalize_category,
    normalize_confidence,
    normalize_issue_key,
    normalize_severity,
    display_category,
)
from config import BATCH_SIZE
from core.logging import get_logger

logger = get_logger("pipeline.step3_categorize")

PROMPT_PATH = pathlib.Path(__file__).parent.parent / "prompts" / "categorize.txt"
PROMPT_TEMPLATE = PROMPT_PATH.read_text(encoding="utf-8")


class CategorizedReview(BaseModel):
    review_id: Optional[str] = None
    review_index: Optional[int] = None
    issue_key: str
    category: str
    severity: int = Field(ge=1, le=5)
    confidence: float = Field(ge=0.0, le=1.0)
    summary: str
    business_area: str = "Other"

    @field_validator("category", mode="before")
    @classmethod
    def _cat(cls, v):
        canon = normalize_category(v)
        if not canon:
            raise ValueError(f"Invalid category: {v}")
        return canon

    @field_validator("issue_key", mode="before")
    @classmethod
    def _key(cls, v):
        return normalize_issue_key(v)

    @field_validator("severity", mode="before")
    @classmethod
    def _sev(cls, v):
        return normalize_severity(v)

    @field_validator("confidence", mode="before")
    @classmethod
    def _conf(cls, v):
        return normalize_confidence(v)

    @model_validator(mode="after")
    def _require_id_or_index(self):
        if self.review_id is None and self.review_index is None:
            raise ValueError("review_id or review_index required")
        return self


def _validate_batch(raw_list: list) -> list[CategorizedReview]:
    valid = []
    for item in raw_list:
        try:
            if not isinstance(item, dict):
                continue
            valid.append(CategorizedReview(**item))
        except Exception:
            pass
    return valid


def _keyword_fallback(review_id: str, index: int, text: str) -> CategorizedReview:
    """Rule-based categorization when Gemini is unavailable. Does NOT score priority."""
    lower = (text or "").lower()
    if any(k in lower for k in ("pay", "payment", "transaction", "upi", "card", "refund", "money deducted")):
        cat, sev, key = "payment", 5, "payment_failure"
    elif any(k in lower for k in ("bug", "error", "fail", "crash", "broken", "exception")):
        cat, sev, key = "bug", 4, "app_crash"
    elif any(k in lower for k in ("slow", "lag", "delay", "freeze", "timeout")):
        cat, sev, key = "performance", 3, "slow_performance"
    elif any(k in lower for k in ("price", "cost", "subscription", "expensive", "billing")):
        cat, sev, key = "pricing", 3, "pricing_concern"
    elif any(k in lower for k in ("wish", "would love", "add", "feature", "want", "please add")):
        cat, sev, key = "feature_request", 2, "feature_request"
    elif any(k in lower for k in ("staff", "support", "service", "rude", "helpful", "waiter", "nurse")):
        cat, sev, key = "service", 3, "service_quality"
    elif any(k in lower for k in ("ui", "ux", "confusing", "hard to", "layout", "design")):
        cat, sev, key = "ux", 2, "ux_friction"
    else:
        words = [w for w in re.findall(r"[a-zA-Z]{4,}", text or "")[:3]]
        key = normalize_issue_key("_".join(words) if words else "general_issue")
        cat, sev = "other", 2

    return CategorizedReview(
        review_id=review_id,
        review_index=index,
        issue_key=key,
        category=cat,
        severity=sev,
        confidence=0.35,
        summary=(text or "")[:80] or "Feedback received",
        business_area="Other",
    )


def _set_ai_status(db, session_id: str, status: str, message: str = "") -> None:
    """
    status: ok | unavailable | fallback
    Preserves pipeline continuity; VADER results remain on reviews.
    """
    payload: dict[str, Any] = {"ai_analysis_status": status}
    if message:
        payload["error_message"] = message[:500]
    elif status == "ok":
        payload["error_message"] = None
    try:
        db.table("sessions").update(payload).eq("id", session_id).execute()
    except Exception:
        # Column may not exist until migration — best-effort
        try:
            if message:
                db.table("sessions").update({"error_message": f"[ai:{status}] {message}"[:500]}).eq("id", session_id).execute()
        except Exception:
            pass


def _persist_categorization(db, session_id: str, review: dict, cat: CategorizedReview, source: str) -> None:
    db.table("categorizations").insert({
        "review_id":     cat.review_id or review.get("id"),
        "session_id":    session_id,
        "issue_key":     cat.issue_key,
        "category":      display_category(cat.category),  # UI-friendly label
        "severity":      cat.severity,
        "confidence":    int(round(cat.confidence * 100)),  # store 0-100 for legacy columns
        "summary":       cat.summary,
        "business_area": cat.business_area or "Other",
        "raw_llm_output": json.dumps({
            **cat.model_dump(),
            "category_canonical": cat.category,
            "confidence_01": cat.confidence,
            "analysis_source": source,  # gemini | fallback
        }),
    }).execute()


def run(session_id: str) -> dict:
    db = get_db()

    rows = (
        db.table("reviews")
        .select("id,cleaned_text,review_date")
        .eq("session_id", session_id)
        .eq("routed_to_llm", True)
        .order("review_date", desc=True)
        .execute()
        .data
    )

    if not rows:
        _set_ai_status(db, session_id, "ok")
        return {"batches": 0, "categorized": 0, "failed_batches": 0, "fallback_batches": 0}

    batches = [rows[i:i + BATCH_SIZE] for i in range(0, len(rows), BATCH_SIZE)]
    stats = {
        "batches": len(batches),
        "categorized": 0,
        "failed_batches": 0,
        "fallback_batches": 0,
    }

    for batch_idx, batch in enumerate(batches):
        batch = [dict(r) for r in batch if isinstance(r, dict)]
        id_by_index = {i: str(r.get("id")) for i, r in enumerate(batch)}
        reviews_for_prompt = [
            {"review_id": str(r.get("id")), "index": i, "text": str(r.get("cleaned_text") or "")}
            for i, r in enumerate(batch)
        ]
        prompt = PROMPT_TEMPLATE.format(
            count=len(batch),
            reviews_json=json.dumps(reviews_for_prompt, ensure_ascii=False),
        )

        used_fallback = False
        validated: list[CategorizedReview] = []

        try:
            raw_result = call_gemini(prompt, call_type="categorize", session_id=session_id)
            if not isinstance(raw_result, list):
                raise ValueError("Expected JSON array from Gemini")
            validated = _validate_batch(raw_result)
            if not validated:
                raise ValueError("No valid categorization items in Gemini response")
        except Exception as e:
            logger.warning(f"[step3] Batch {batch_idx} Gemini failed: {e} — using fallback")
            stats["failed_batches"] += 1
            stats["fallback_batches"] += 1
            used_fallback = True
            validated = [
                _keyword_fallback(str(r.get("id")), i, str(r.get("cleaned_text") or ""))
                for i, r in enumerate(batch)
            ]

        source = "fallback" if used_fallback else "gemini"
        for cat in validated:
            # Resolve review
            review = {}
            if cat.review_id:
                review = next((r for r in batch if str(r.get("id")) == str(cat.review_id)), {})
            if not review and cat.review_index is not None and cat.review_index in id_by_index:
                rid = id_by_index[cat.review_index]
                review = next((r for r in batch if str(r.get("id")) == rid), {})
                cat.review_id = rid
            if not review:
                continue
            try:
                _persist_categorization(db, session_id, review, cat, source)
                stats["categorized"] += 1
            except Exception as e:
                logger.error(f"[step3] Persist failed: {e}")

        try:
            db.table("sessions").update({
                "processed_reviews": min((batch_idx + 1) * BATCH_SIZE, len(rows)),
            }).eq("id", session_id).execute()
        except Exception:
            pass

    if stats["failed_batches"] == stats["batches"] and stats["batches"] > 0:
        _set_ai_status(
            db,
            session_id,
            "unavailable",
            "AI analysis unavailable — VADER sentiment preserved; rule-based fallback used. Retry categorization when ready.",
        )
    elif stats["fallback_batches"] > 0:
        _set_ai_status(
            db,
            session_id,
            "fallback",
            f"Partial AI failure ({stats['fallback_batches']} batch(es)) — fallback categories applied. Retry available.",
        )
    else:
        _set_ai_status(db, session_id, "ok")

    return stats
