import time
import json
import re
import google.generativeai as genai
from database import get_db
from config import (
    GEMINI_API_KEY, GEMINI_MODEL, GEMINI_MAX_RETRIES,
    GEMINI_TIMEOUT_SECONDS
)
from services.pii_stripper import strip_pii

genai.configure(api_key=GEMINI_API_KEY)

def _get_model():
    return genai.GenerativeModel(GEMINI_MODEL)



def _extract_json(raw: str) -> str:
    """Strip markdown code fences and extract first valid JSON block."""
    # Remove ```json ... ``` wrappers
    cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`").strip()
    # Find first [ or { to start
    for i, ch in enumerate(cleaned):
        if ch in ("{", "["):
            return cleaned[i:]
    return cleaned


def call_gemini(
    prompt: str,
    call_type: str,
    session_id: str,
    expect_json: bool = True,
) -> str | dict | list:
    """
    Make a Gemini API call with:
    - PII stripping
    - Retry logic (up to GEMINI_MAX_RETRIES)
    - JSON extraction + validation if expect_json=True
    - Full audit logging to llm_logs table
    """
    prompt = strip_pii(prompt)
    db = get_db()

    for attempt in range(GEMINI_MAX_RETRIES + 1):
        start = time.time()
        status = "success"
        error_msg = None
        in_tokens = out_tokens = 0
        result = None

        try:
            response = _get_model().generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    temperature=0.2,
                    max_output_tokens=8192,
                ),
            )
            raw = response.text
            in_tokens  = response.usage_metadata.prompt_token_count or 0
            out_tokens = response.usage_metadata.candidates_token_count or 0

            if expect_json:
                json_str = _extract_json(raw)
                result = json.loads(json_str)
            else:
                result = raw

        except json.JSONDecodeError as e:
            status = "retry" if attempt < GEMINI_MAX_RETRIES else "failed"
            error_msg = f"JSON decode error: {e}"
            # On retry, append a correction hint to the prompt
            prompt = prompt + "\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no explanation."
            if attempt == GEMINI_MAX_RETRIES:
                raise ValueError(f"Gemini returned invalid JSON after {attempt+1} attempts: {e}")
            continue

        except Exception as e:
            status = "retry" if attempt < GEMINI_MAX_RETRIES else "failed"
            error_msg = str(e)
            if attempt == GEMINI_MAX_RETRIES:
                raise
            time.sleep(2 ** attempt)  # Exponential backoff
            continue

        finally:
            latency = int((time.time() - start) * 1000)
            # Gemini Flash pricing: $0.075 / 1M input tokens, $0.30 / 1M output tokens
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
                pass  # Never let logging failure break the pipeline

        return result

    raise RuntimeError("Gemini call failed after max retries")
