import time
import json
import re
import google.generativeai as genai
from typing import List, Any
from config import GEMINI_API_KEY, GEMINI_MODEL, GEMINI_MAX_RETRIES, BATCH_SIZE
from domain.interfaces import IGeminiService
from domain.schemas import CleanedReview, CategorizedReview
from services.prompt_manager import PromptManager
from services.pii_stripper import strip_pii
from database import get_db
from core.exceptions import GeminiAPIError, JSONValidationError
from core.logging import get_logger

logger = get_logger("services.gemini")

genai.configure(api_key=GEMINI_API_KEY)


class GeminiService(IGeminiService):
    """
    Module 13 & 15 — Gemini Service & JSON Validation.
    Features:
      - Rules: Gemini ONLY performs categorization/business reasoning. NEVER calculates.
      - PII Stripping before sending text to LLM.
      - Module 15: Strict JSON schema validation via Pydantic. If invalid, retries with correction prompt.
      - Batch execution (50 reviews/batch).
      - Audit log recorded in llm_logs table.
    """

    def __init__(self):
        self.prompt_manager = PromptManager()

    def _get_model(self):
        return genai.GenerativeModel(GEMINI_MODEL)

    def _extract_json(self, raw: str) -> str:
        """Strips markdown fences and extracts raw JSON string."""
        cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`").strip()
        for i, ch in enumerate(cleaned):
            if ch in ("{", "["):
                return cleaned[i:]
        return cleaned

    async def call_llm(self, prompt: str, call_type: str, session_id: str, expect_json: bool = True) -> Any:
        """Executes a Gemini LLM call with PII stripping, retries, and audit logging."""
        prompt = strip_pii(prompt)
        db = get_db()

        for attempt in range(GEMINI_MAX_RETRIES + 1):
            start = time.time()
            status = "success"
            error_msg = None
            in_tokens = out_tokens = 0
            result = None

            try:
                model = self._get_model()
                response = model.generate_content(
                    prompt,
                    generation_config=genai.GenerationConfig(
                        temperature=0.2,
                        max_output_tokens=8192,
                    ),
                )
                raw = response.text
                in_tokens = getattr(response.usage_metadata, "prompt_token_count", 0) or 0
                out_tokens = getattr(response.usage_metadata, "candidates_token_count", 0) or 0

                if expect_json:
                    json_str = self._extract_json(raw)
                    result = json.loads(json_str)
                else:
                    result = raw

            except json.JSONDecodeError as e:
                status = "retry" if attempt < GEMINI_MAX_RETRIES else "failed"
                error_msg = f"JSON decode error: {e}"
                prompt = prompt + "\n\nCRITICAL: Return ONLY raw valid JSON array. No markdown, no prose."
                if attempt == GEMINI_MAX_RETRIES:
                    raise JSONValidationError(f"Gemini returned invalid JSON after retries: {e}", raw_output=raw if 'raw' in locals() else "")
                continue

            except Exception as e:
                status = "retry" if attempt < GEMINI_MAX_RETRIES else "failed"
                error_msg = str(e)
                if attempt == GEMINI_MAX_RETRIES:
                    raise GeminiAPIError(f"Gemini call failed: {e}")
                time.sleep(2 ** attempt)
                continue

            finally:
                latency = int((time.time() - start) * 1000)
                cost = (in_tokens * 0.075 + out_tokens * 0.30) / 1_000_000
                try:
                    db.table("llm_logs").insert({
                        "session_id": session_id,
                        "call_type": call_type,
                        "input_tokens": in_tokens,
                        "output_tokens": out_tokens,
                        "cost_usd": cost,
                        "latency_ms": latency,
                        "status": status,
                        "error_message": error_msg,
                    }).execute()
                except Exception:
                    pass

            return result

        raise GeminiAPIError("Max retries exceeded for Gemini service")

    async def categorize_batch(self, session_id: str, reviews: List[CleanedReview]) -> List[CategorizedReview]:
        if not reviews:
            return []

        batches = [reviews[i:i + BATCH_SIZE] for i in range(0, len(reviews), BATCH_SIZE)]
        all_categorizations: List[CategorizedReview] = []

        for batch_idx, batch in enumerate(batches):
            prompt_input = [
                {"index": i, "text": r.cleaned_text}
                for i, r in enumerate(batch)
            ]
            prompt = self.prompt_manager.render_categorize_prompt(
                reviews_json=json.dumps(prompt_input, ensure_ascii=False),
                count=len(batch)
            )

            try:
                raw_list = await self.call_llm(prompt, call_type="categorize", session_id=session_id, expect_json=True)
                if not isinstance(raw_list, list):
                    raise JSONValidationError("Expected JSON array from Gemini batch categorization", raw_output=str(raw_list))

                # Module 15: Validate each JSON item against Pydantic CategorizedReview schema
                for item in raw_list:
                    try:
                        cat = CategorizedReview(**item)
                        all_categorizations.append(cat)
                    except Exception as ve:
                        logger.warning(f"Skipping malformed categorization item in batch {batch_idx}: {ve}")
                        continue

            except Exception as e:
                logger.error(f"Failed Gemini batch categorization {batch_idx}: {e}")
                continue

        logger.info(f"Categorized {len(all_categorizations)} reviews across {len(batches)} batches")
        return all_categorizations
