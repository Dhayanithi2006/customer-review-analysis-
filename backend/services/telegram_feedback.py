"""
Telegram feedback collection — conversation state machine.

NOT an AI chatbot. Only responsibility:
  Customer → Telegram → collect feedback → insert into feedback_submissions
  with source="telegram", then the existing RoadmapAI pipeline processes it.
"""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Dict, Optional

from telegram import KeyboardButton, ReplyKeyboardMarkup, ReplyKeyboardRemove

from core.logging import get_logger
from domain.enums import ReviewSource

logger = get_logger("services.telegram_feedback")

INVALID_BUSINESS_MSG = "Sorry, this feedback link is invalid or expired."
THANKS_MSG = "Thank you for your feedback."
ASK_IMPROVE_MSG = "Thanks. What could we improve?"
ASK_EMAIL_MSG = (
    "Would you like us to contact you about this feedback?\n"
    "Email is optional.\n\n"
    "Optional — only used to follow up on this specific issue.\n\n"
    "Reply with your email, or tap Skip."
)
RATING_OPTIONS = ("⭐ 1", "⭐ 2", "⭐ 3", "⭐ 4", "⭐ 5")
SKIP_LABEL = "Skip"
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class ConversationState(str, Enum):
    AWAITING_RATING = "awaiting_rating"
    AWAITING_TEXT = "awaiting_text"
    AWAITING_EMAIL = "awaiting_email"


@dataclass
class ConversationSession:
    business_id: str
    business_name: str
    engagement_mode: str
    state: ConversationState
    rating: Optional[int] = None
    text: Optional[str] = None
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class TelegramConfigError(Exception):
    """Raised when TELEGRAM_BOT_TOKEN is missing."""


class TelegramFeedbackService:
    """
    In-memory conversation store keyed by Telegram chat_id.
    Does not store Telegram PII beyond the opaque chat_id needed for the flow.
    """

    def __init__(
        self,
        get_db: Callable,
        send_message: Callable[..., Any],
        get_engagement_mode: Optional[Callable] = None,
    ):
        self._get_db = get_db
        self._send_message = send_message
        self._get_engagement_mode = get_engagement_mode
        self._sessions: Dict[int, ConversationSession] = {}

    # ── Public API ────────────────────────────────────────────────────────────

    def clear_sessions(self) -> None:
        self._sessions.clear()

    def get_session(self, chat_id: int) -> Optional[ConversationSession]:
        return self._sessions.get(chat_id)

    def handle_update(self, update: dict) -> Dict[str, Any]:
        """
        Process one Telegram Update dict. Never raises secrets to callers.
        Returns a small status dict for tests / logging.
        """
        message = update.get("message") or update.get("edited_message")
        if not message:
            return {"handled": False, "reason": "no_message"}

        chat = message.get("chat") or {}
        chat_id = chat.get("id")
        if chat_id is None:
            return {"handled": False, "reason": "no_chat_id"}

        text = (message.get("text") or "").strip()
        if not text:
            return {"handled": False, "reason": "empty_text"}

        if text.startswith("/start"):
            return self._handle_start(chat_id, text)

        session = self._sessions.get(chat_id)
        if not session:
            self._send_message(
                chat_id,
                "Please start with /start followed by your business feedback code.",
            )
            return {"handled": True, "reason": "no_active_session"}

        if session.state == ConversationState.AWAITING_RATING:
            return self._handle_rating(chat_id, session, text)
        if session.state == ConversationState.AWAITING_TEXT:
            return self._handle_text(chat_id, session, text)
        if session.state == ConversationState.AWAITING_EMAIL:
            return self._handle_email(chat_id, session, text)

        return {"handled": False, "reason": "unknown_state"}

    # ── /start ────────────────────────────────────────────────────────────────

    def _handle_start(self, chat_id: int, text: str) -> Dict[str, Any]:
        parts = text.split(maxsplit=1)
        business_id = parts[1].strip() if len(parts) > 1 else ""
        if not business_id:
            self._send_message(chat_id, INVALID_BUSINESS_MSG)
            self._sessions.pop(chat_id, None)
            return {"handled": True, "ok": False, "reason": "missing_business_id"}

        biz = self._load_business(business_id)
        if not biz:
            self._send_message(chat_id, INVALID_BUSINESS_MSG)
            self._sessions.pop(chat_id, None)
            return {"handled": True, "ok": False, "reason": "invalid_business_id"}

        mode = self._resolve_engagement_mode(biz["id"], biz.get("industry") or "")
        # Replace any prior conversation for this chat (duplicate state → reset).
        self._sessions[chat_id] = ConversationSession(
            business_id=biz["id"],
            business_name=biz["business_name"],
            engagement_mode=mode,
            state=ConversationState.AWAITING_RATING,
        )

        self._send_message(
            chat_id,
            f"How was your experience at {biz['business_name']}?",
            reply_markup=self.rating_keyboard(),
        )
        return {
            "handled": True,
            "ok": True,
            "reason": "started",
            "business_id": biz["id"],
        }

    # ── Steps ─────────────────────────────────────────────────────────────────

    def _handle_rating(
        self, chat_id: int, session: ConversationSession, text: str
    ) -> Dict[str, Any]:
        rating = self.parse_rating(text)
        if rating is None:
            self._send_message(
                chat_id,
                "Please choose a rating from 1 to 5.",
                reply_markup=self.rating_keyboard(),
            )
            return {"handled": True, "ok": False, "reason": "invalid_rating"}

        session.rating = rating
        session.state = ConversationState.AWAITING_TEXT
        session.updated_at = datetime.now(timezone.utc).isoformat()
        self._send_message(chat_id, ASK_IMPROVE_MSG, reply_markup=ReplyKeyboardRemove().to_dict())
        return {"handled": True, "ok": True, "reason": "rating_accepted", "rating": rating}

    def _handle_text(
        self, chat_id: int, session: ConversationSession, text: str
    ) -> Dict[str, Any]:
        cleaned = text.strip()
        if len(cleaned) < 5:
            self._send_message(
                chat_id,
                "Please share a bit more detail (at least a few words).",
            )
            return {"handled": True, "ok": False, "reason": "text_too_short"}

        session.text = cleaned
        session.state = ConversationState.AWAITING_EMAIL
        session.updated_at = datetime.now(timezone.utc).isoformat()
        self._send_message(
            chat_id,
            ASK_EMAIL_MSG,
            reply_markup=self.skip_keyboard(),
        )
        return {"handled": True, "ok": True, "reason": "text_accepted"}

    def _handle_email(
        self, chat_id: int, session: ConversationSession, text: str
    ) -> Dict[str, Any]:
        raw = text.strip()
        email: Optional[str] = None

        if raw.lower() == SKIP_LABEL.lower() or raw.lower() in {"/skip", "no", "n"}:
            email = None
        else:
            if not EMAIL_RE.match(raw) or len(raw) > 200:
                self._send_message(
                    chat_id,
                    "That doesn't look like a valid email. Send a valid email, or tap Skip.",
                    reply_markup=self.skip_keyboard(),
                )
                return {"handled": True, "ok": False, "reason": "invalid_email"}
            email = raw[:200]

        try:
            submission_id = self._insert_submission(session, email)
        except Exception as e:
            logger.error(f"Telegram feedback insert failed: {e}")
            self._send_message(
                chat_id,
                "Sorry, we couldn't save your feedback right now. Please try again later.",
                reply_markup=ReplyKeyboardRemove().to_dict(),
            )
            # Keep session so the user can retry email/skip without restarting.
            return {"handled": True, "ok": False, "reason": "supabase_insert_failed"}

        self._sessions.pop(chat_id, None)
        self._send_message(
            chat_id,
            THANKS_MSG,
            reply_markup=ReplyKeyboardRemove().to_dict(),
        )
        return {
            "handled": True,
            "ok": True,
            "reason": "submitted",
            "submission_id": submission_id,
            "business_id": session.business_id,
            "source": ReviewSource.TELEGRAM.value,
            "email": email,
        }

    # ── Persistence ───────────────────────────────────────────────────────────

    def _load_business(self, business_id: str) -> Optional[dict]:
        try:
            db = self._get_db()
            result = (
                db.table("businesses")
                .select("id,business_name,industry")
                .eq("id", business_id)
                .execute()
            )
            rows = result.data or []
            return rows[0] if rows else None
        except Exception as e:
            logger.error(f"Business lookup failed: {e}")
            return None

    def _resolve_engagement_mode(self, business_id: str, industry: str) -> str:
        if self._get_engagement_mode:
            try:
                return self._get_engagement_mode(industry) or "improvement"
            except Exception:
                pass
        try:
            from routers.feedback_settings import _get_engagement_mode, _get_or_create_settings

            db = self._get_db()
            settings = _get_or_create_settings(db, business_id, industry)
            return settings.get("feedback_mode") or _get_engagement_mode(industry) or "improvement"
        except Exception:
            return "improvement"

    def _insert_submission(
        self, session: ConversationSession, email: Optional[str]
    ) -> str:
        """
        Insert into the EXISTING feedback_submissions buffer.
        Maps to unified fields:
          raw_text, rating, submitted_at, source=telegram, business_id, customer_email
        user_tier is not in the current schema — intentionally omitted.
        """
        submission_id = str(uuid.uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()
        row = {
            "id": submission_id,
            "business_id": session.business_id,
            "raw_text": session.text,
            "rating": session.rating,
            "engagement_mode": session.engagement_mode or "improvement",
            "source": ReviewSource.TELEGRAM.value,
            "submitted_at": now_iso,
        }
        if email:
            row["customer_email"] = email
            row["follow_up_eligible"] = True

        db = self._get_db()
        db.table("feedback_submissions").insert(row).execute()
        logger.info(
            f"Telegram feedback stored: business={session.business_id} "
            f"id={submission_id} source=telegram"
        )
        return submission_id

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def parse_rating(text: str) -> Optional[int]:
        cleaned = text.strip()
        if cleaned in RATING_OPTIONS:
            return int(cleaned[-1])
        strict = re.fullmatch(r"⭐?\s*([1-5])\s*", cleaned)
        if strict:
            return int(strict.group(1))
        return None

    @staticmethod
    def rating_keyboard() -> dict:
        markup = ReplyKeyboardMarkup(
            [[KeyboardButton(label) for label in RATING_OPTIONS]],
            resize_keyboard=True,
            one_time_keyboard=True,
        )
        return markup.to_dict()

    @staticmethod
    def skip_keyboard() -> dict:
        markup = ReplyKeyboardMarkup(
            [[KeyboardButton(SKIP_LABEL)]],
            resize_keyboard=True,
            one_time_keyboard=True,
        )
        return markup.to_dict()


def build_telegram_send_message(token: str):
    """
    Sync Telegram Bot API sender via httpx.
    Uses the official Bot API; token is never logged or returned.
    python-telegram-bot is used for keyboard/markup helpers in this module.
    """
    import httpx

    if not token:
        raise TelegramConfigError("TELEGRAM_BOT_TOKEN is not configured")

    api_base = f"https://api.telegram.org/bot{token}"

    def send_message(chat_id: int, text: str, reply_markup: Optional[dict] = None) -> Any:
        payload: Dict[str, Any] = {"chat_id": chat_id, "text": text}
        if reply_markup is not None:
            payload["reply_markup"] = reply_markup
        try:
            with httpx.Client(timeout=15.0) as client:
                resp = client.post(f"{api_base}/sendMessage", json=payload)
                if resp.status_code >= 400:
                    logger.error(f"Telegram API failure status={resp.status_code}")
                    raise RuntimeError("Telegram API failure")
                return resp.json()
        except TelegramConfigError:
            raise
        except Exception as e:
            logger.error(f"Telegram API failure: {type(e).__name__}")
            raise RuntimeError("Telegram API failure") from e

    return send_message
