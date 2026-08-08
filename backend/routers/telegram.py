"""
Telegram webhook router — feedback collection only.

POST /telegram/webhook  → Telegram Update → feedback_submissions (source=telegram)
GET  /telegram/health   → token configured? (never returns the token)

Bot token stays backend-only (TELEGRAM_BOT_TOKEN). Never exposed to frontend.
"""
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from config import TELEGRAM_BOT_TOKEN
from core.logging import get_logger
from database import get_db
from services.telegram_feedback import (
    TelegramConfigError,
    TelegramFeedbackService,
    build_telegram_send_message,
)

logger = get_logger("routers.telegram")
router = APIRouter(prefix="/telegram", tags=["Telegram Feedback"])

_service: Optional[TelegramFeedbackService] = None


def get_telegram_service() -> TelegramFeedbackService:
    """Lazy singleton so missing token does not break app import / QR feedback."""
    global _service
    if _service is not None:
        return _service

    if not TELEGRAM_BOT_TOKEN:
        raise TelegramConfigError("TELEGRAM_BOT_TOKEN is not configured")

    _service = TelegramFeedbackService(
        get_db=get_db,
        send_message=build_telegram_send_message(TELEGRAM_BOT_TOKEN),
    )
    return _service


def reset_telegram_service_for_tests(service: Optional[TelegramFeedbackService] = None) -> None:
    """Test helper — inject or clear the singleton."""
    global _service
    _service = service


class TelegramHealthResponse(BaseModel):
    status: str
    telegram_configured: bool
    message: str = Field(default="")


@router.get("/health", response_model=TelegramHealthResponse)
async def telegram_health():
    configured = bool(TELEGRAM_BOT_TOKEN)
    if not configured:
        return TelegramHealthResponse(
            status="degraded",
            telegram_configured=False,
            message="TELEGRAM_BOT_TOKEN is not set. Telegram feedback is disabled.",
        )
    return TelegramHealthResponse(
        status="ok",
        telegram_configured=True,
        message="Telegram feedback webhook is ready.",
    )


@router.post("/webhook")
async def telegram_webhook(request: Request) -> Dict[str, Any]:
    """
    Telegram Bot API webhook endpoint.
    Always returns 200 when the update is acknowledged so Telegram does not retry forever
    for user-facing validation errors. Configuration errors return 503.
    """
    if not TELEGRAM_BOT_TOKEN:
        raise HTTPException(
            status_code=503,
            detail="Telegram feedback is not configured.",
        )

    try:
        update = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Malformed Telegram update.")

    if not isinstance(update, dict):
        raise HTTPException(status_code=400, detail="Malformed Telegram update.")

    try:
        service = get_telegram_service()
        result = service.handle_update(update)
    except TelegramConfigError:
        raise HTTPException(
            status_code=503,
            detail="Telegram feedback is not configured.",
        )
    except Exception as e:
        logger.error(f"Telegram webhook handler error: {type(e).__name__}")
        # Do not break Telegram retries with stack traces / secrets
        return {"ok": True, "handled": False, "reason": "internal_error"}

    return {"ok": True, **result}
