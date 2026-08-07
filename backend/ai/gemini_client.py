import time
import random
import asyncio
import google.generativeai as genai
from typing import Any, Optional
from config import GEMINI_API_KEY
from ai.config import AI_MODEL_NAME, AI_MAX_RETRIES, AI_TIMEOUT_SECONDS
from ai.rate_limiter import rate_limiter
from ai.sanitization import sanitize_input_text
from database import get_db
from core.exceptions import GeminiAPIError
from core.logging import get_logger

logger = get_logger("ai.gemini_client")

genai.configure(api_key=GEMINI_API_KEY)


class GeminiFlashClient:
    """
    Low-Level Gemini Flash Client.
    Handles:
      - Asynchronous API requests
      - Rate limiting token bucket
      - Exponential backoff with jitter on retries (429/503/timeout)
      - PII & Injection defense sanitization
      - Audit logging to Supabase llm_logs
    """

    def __init__(self, model_name: str = AI_MODEL_NAME):
        self.model_name = model_name

    def _get_generative_model(self) -> genai.GenerativeModel:
        return genai.GenerativeModel(self.model_name)

    async def generate(
        self,
        prompt: str,
        call_type: str,
        session_id: str,
        temperature: float = 0.1,
    ) -> str:
        """Executes a Gemini Flash text generation call with rate limiting and exponential jitter retries."""
        sanitized_prompt = sanitize_input_text(prompt)
        db = get_db()

        for attempt in range(AI_MAX_RETRIES + 1):
            await rate_limiter.acquire()
            start_time = time.time()
            status = "success"
            error_msg = None
            in_tokens = out_tokens = 0
            raw_text = ""

            try:
                model = self._get_generative_model()
                # Run threadpool call for sync SDK method to keep FastAPI event loop unblocked
                loop = asyncio.get_running_loop()
                response = await asyncio.wait_for(
                    loop.run_in_executor(
                        None,
                        lambda: model.generate_content(
                            sanitized_prompt,
                            generation_config=genai.GenerationConfig(
                                temperature=temperature,
                                max_output_tokens=8192,
                            ),
                        )
                    ),
                    timeout=AI_TIMEOUT_SECONDS
                )

                raw_text = response.text
                in_tokens = getattr(response.usage_metadata, "prompt_token_count", 0) or 0
                out_tokens = getattr(response.usage_metadata, "candidates_token_count", 0) or 0

                return raw_text

            except asyncio.TimeoutError:
                status = "retry" if attempt < AI_MAX_RETRIES else "failed"
                error_msg = f"Timeout after {AI_TIMEOUT_SECONDS}s"
                logger.warning(f"Attempt {attempt + 1}/{AI_MAX_RETRIES + 1} timed out for session {session_id}")

            except Exception as e:
                status = "retry" if attempt < AI_MAX_RETRIES else "failed"
                error_msg = str(e)
                logger.warning(f"Attempt {attempt + 1}/{AI_MAX_RETRIES + 1} failed for session {session_id}: {e}")

            finally:
                rate_limiter.release()
                latency_ms = int((time.time() - start_time) * 1000)
                cost_usd = (in_tokens * 0.075 + out_tokens * 0.30) / 1_000_000

                # Audit log to Supabase
                try:
                    db.table("llm_logs").insert({
                        "session_id": session_id,
                        "call_type": call_type,
                        "input_tokens": in_tokens,
                        "output_tokens": out_tokens,
                        "cost_usd": cost_usd,
                        "latency_ms": latency_ms,
                        "status": status,
                        "error_message": error_msg,
                    }).execute()
                except Exception:
                    pass

            if attempt < AI_MAX_RETRIES:
                # Exponential backoff with random jitter: 2^attempt + random(0.1, 1.0)
                backoff = (2 ** attempt) + random.uniform(0.1, 1.0)
                logger.info(f"Retrying Gemini call in {backoff:.2f}s...")
                await asyncio.sleep(backoff)

        raise GeminiAPIError(f"Gemini Flash failed after {AI_MAX_RETRIES + 1} attempts: {error_msg}")
