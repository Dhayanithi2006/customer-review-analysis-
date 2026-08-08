"""
Step 3 — Gemini Batch Categorization (LLM Call 1)
Batches actionable reviews and sends to Gemini for structured categorization.
Validates output schema. Skips invalid batches rather than halting.
"""
import json
import pathlib
from pydantic import BaseModel, Field
from typing import Literal
from database import get_db
from services.gemini_client import call_gemini
from config import BATCH_SIZE, VALID_CATEGORIES, VALID_BUSINESS_AREAS

PROMPT_PATH = pathlib.Path(__file__).parent.parent / "prompts" / "categorize.txt"
PROMPT_TEMPLATE = PROMPT_PATH.read_text(encoding="utf-8")


# ── Pydantic schema for Gemini output ─────────────────────────────────────────

class CategorizedReview(BaseModel):
    review_index: int
    issue_key:    str = Field(pattern=r"^[A-Z][A-Z0-9_]{1,39}$")
    category:     Literal[
        "Bug", "Performance", "UX", "Pricing", "Feature Request",
        "Onboarding", "Customer Support", "Data & Privacy", "Integration", "Praise"
    ]
    severity:     int = Field(ge=1, le=10)
    confidence:   int = Field(ge=0, le=100)
    summary:      str
    business_area: str


def _validate_batch(raw_list: list) -> list[CategorizedReview]:
    valid = []
    for item in raw_list:
        try:
            valid.append(CategorizedReview(**item))
        except Exception:
            # Skip individual invalid items, don't fail the batch
            pass
    return valid


def run(session_id: str) -> dict:
    db = get_db()

    # Fetch actionable reviews, sorted recency-first
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
        return {"batches": 0, "categorized": 0, "failed_batches": 0}

    # Split into batches
    batches = [rows[i:i + BATCH_SIZE] for i in range(0, len(rows), BATCH_SIZE)]
    stats = {"batches": len(batches), "categorized": 0, "failed_batches": 0}

    for batch_idx, batch in enumerate(batches):
        # Build numbered review list for the prompt
        reviews_for_prompt = [
            {"index": i, "text": str(dict(r).get("cleaned_text") or "")}
            for i, r in enumerate(batch) if isinstance(r, dict)
        ]
        prompt = PROMPT_TEMPLATE.format(
            count=len(batch),
            reviews_json=json.dumps(reviews_for_prompt, ensure_ascii=False),
        )

        try:
            raw_result = call_gemini(prompt, call_type="categorize", session_id=session_id)
            if not isinstance(raw_result, list):
                raise ValueError("Expected JSON array from Gemini")

            validated = _validate_batch(raw_result)

            # Persist each valid categorization
            for cat in validated:
                review = dict(batch[cat.review_index]) if (cat.review_index < len(batch) and isinstance(batch[cat.review_index], dict)) else {}
                db.table("categorizations").insert({
                    "review_id":     review.get("id"),
                    "session_id":    session_id,
                    "issue_key":     cat.issue_key,
                    "category":      cat.category,
                    "severity":      cat.severity,
                    "confidence":    cat.confidence,
                    "summary":       cat.summary,
                    "business_area": cat.business_area,
                    "raw_llm_output": json.dumps(cat.model_dump()),
                }).execute()
                stats["categorized"] += 1

            # Update session progress
            db.table("sessions").update({
                "processed_reviews": (batch_idx + 1) * BATCH_SIZE,
            }).eq("id", session_id).execute()

        except Exception as e:
            stats["failed_batches"] += 1
            # Log and continue — don't halt the pipeline for one bad batch
            print(f"[step3] Batch {batch_idx} failed: {e}")
            continue

    return stats
