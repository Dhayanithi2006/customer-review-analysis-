"""
PHASE T2 — Telegram feedback collection foundation tests.

Covers:
1. valid /start business_id
2. invalid business_id
3. rating collection
4. feedback text collection
5. optional email
6. skip email
7. business_id persistence
8. source="telegram"
9. invalid rating
10. Supabase insertion failure
11. missing TELEGRAM_BOT_TOKEN
"""
from unittest.mock import MagicMock, patch

import pytest

from services.telegram_feedback import (
    ConversationState,
    TelegramConfigError,
    TelegramFeedbackService,
    build_telegram_send_message,
)
from routers import telegram as telegram_router


BIZ_ID = "11111111-1111-1111-1111-111111111111"
BIZ_NAME = "FreshMart"


def _msg(chat_id: int, text: str) -> dict:
    return {
        "update_id": 1,
        "message": {
            "message_id": 1,
            "chat": {"id": chat_id, "type": "private"},
            "text": text,
        },
    }


@pytest.fixture
def sent_messages():
    return []


@pytest.fixture
def mock_db():
    db = MagicMock()
    submissions = MagicMock()
    submissions.insert.return_value = submissions
    submissions.execute.return_value = MagicMock(data=[{"id": "ok"}])
    db._submissions_table = submissions

    def table(name):
        if name == "businesses":
            chain = MagicMock()
            chain.select.return_value = chain

            def eq_side(col, val):
                chain._last_id = val
                return chain

            def exec_biz():
                if getattr(chain, "_last_id", None) == BIZ_ID:
                    return MagicMock(
                        data=[{
                            "id": BIZ_ID,
                            "business_name": BIZ_NAME,
                            "industry": "Supermarket",
                        }]
                    )
                return MagicMock(data=[])

            chain.eq.side_effect = eq_side
            chain.execute.side_effect = exec_biz
            return chain

        if name == "feedback_submissions":
            return submissions

        return MagicMock()

    db.table.side_effect = table
    return db


@pytest.fixture
def service(mock_db, sent_messages):
    def send_message(chat_id, text, reply_markup=None):
        sent_messages.append({
            "chat_id": chat_id,
            "text": text,
            "reply_markup": reply_markup,
        })
        return {"ok": True}

    svc = TelegramFeedbackService(
        get_db=lambda: mock_db,
        send_message=send_message,
        get_engagement_mode=lambda industry: "improvement",
    )
    yield svc
    svc.clear_sessions()


def test_valid_start_business_id(service, sent_messages):
    result = service.handle_update(_msg(10, f"/start {BIZ_ID}"))
    assert result["ok"] is True
    assert result["business_id"] == BIZ_ID
    session = service.get_session(10)
    assert session is not None
    assert session.business_id == BIZ_ID
    assert session.state == ConversationState.AWAITING_RATING
    assert BIZ_NAME in sent_messages[-1]["text"]
    assert "⭐ 1" in str(sent_messages[-1]["reply_markup"])


def test_invalid_business_id(service, sent_messages):
    result = service.handle_update(_msg(10, "/start NOT-A-REAL-BIZ"))
    assert result["ok"] is False
    assert result["reason"] == "invalid_business_id"
    assert service.get_session(10) is None
    assert "invalid or expired" in sent_messages[-1]["text"].lower()


def test_missing_business_id_on_start(service, sent_messages):
    result = service.handle_update(_msg(10, "/start"))
    assert result["ok"] is False
    assert "invalid or expired" in sent_messages[-1]["text"].lower()


def test_rating_collection(service):
    service.handle_update(_msg(10, f"/start {BIZ_ID}"))
    result = service.handle_update(_msg(10, "⭐ 4"))
    assert result["ok"] is True
    assert result["rating"] == 4
    assert service.get_session(10).state == ConversationState.AWAITING_TEXT


def test_invalid_rating(service, sent_messages):
    service.handle_update(_msg(10, f"/start {BIZ_ID}"))
    result = service.handle_update(_msg(10, "excellent"))
    assert result["ok"] is False
    assert result["reason"] == "invalid_rating"
    assert service.get_session(10).state == ConversationState.AWAITING_RATING
    assert "1 to 5" in sent_messages[-1]["text"]


def test_feedback_text_collection(service, sent_messages):
    service.handle_update(_msg(10, f"/start {BIZ_ID}"))
    service.handle_update(_msg(10, "3"))
    result = service.handle_update(_msg(10, "Checkout line is too slow at peak hours."))
    assert result["ok"] is True
    assert service.get_session(10).state == ConversationState.AWAITING_EMAIL
    assert "optional" in sent_messages[-1]["text"].lower()


def test_optional_email_and_source_telegram(service, mock_db):
    service.handle_update(_msg(10, f"/start {BIZ_ID}"))
    service.handle_update(_msg(10, "⭐ 2"))
    service.handle_update(_msg(10, "Payment counter staff were rude today."))
    result = service.handle_update(_msg(10, "customer@example.com"))

    assert result["ok"] is True
    assert result["reason"] == "submitted"
    assert result["source"] == "telegram"
    assert result["business_id"] == BIZ_ID
    assert result["email"] == "customer@example.com"
    assert service.get_session(10) is None

    insert_call = mock_db._submissions_table.insert.call_args[0][0]
    assert insert_call["business_id"] == BIZ_ID
    assert insert_call["source"] == "telegram"
    assert insert_call["rating"] == 2
    assert "rude" in insert_call["raw_text"]
    assert insert_call["customer_email"] == "customer@example.com"


def test_skip_email(service, mock_db, sent_messages):
    service.handle_update(_msg(10, f"/start {BIZ_ID}"))
    service.handle_update(_msg(10, "5"))
    service.handle_update(_msg(10, "Loved the fresh produce section."))
    result = service.handle_update(_msg(10, "Skip"))

    assert result["ok"] is True
    assert result["email"] is None
    insert_call = mock_db._submissions_table.insert.call_args[0][0]
    assert insert_call["source"] == "telegram"
    assert "customer_email" not in insert_call
    assert sent_messages[-1]["text"] == "Thank you for your feedback."


def test_business_id_persists_through_flow(service):
    service.handle_update(_msg(42, f"/start {BIZ_ID}"))
    assert service.get_session(42).business_id == BIZ_ID
    service.handle_update(_msg(42, "1"))
    assert service.get_session(42).business_id == BIZ_ID
    service.handle_update(_msg(42, "Shelves were empty for milk brands."))
    assert service.get_session(42).business_id == BIZ_ID


def test_duplicate_start_resets_conversation(service):
    service.handle_update(_msg(10, f"/start {BIZ_ID}"))
    service.handle_update(_msg(10, "2"))
    assert service.get_session(10).rating == 2
    # New /start replaces prior mid-flow state
    service.handle_update(_msg(10, f"/start {BIZ_ID}"))
    session = service.get_session(10)
    assert session.state == ConversationState.AWAITING_RATING
    assert session.rating is None
    assert session.business_id == BIZ_ID


def test_supabase_insertion_failure(service, mock_db, sent_messages):
    service.handle_update(_msg(10, f"/start {BIZ_ID}"))
    service.handle_update(_msg(10, "4"))
    service.handle_update(_msg(10, "Appetizers took forty minutes."))
    mock_db._submissions_table.execute.side_effect = RuntimeError("db down")

    result = service.handle_update(_msg(10, "Skip"))
    assert result["ok"] is False
    assert result["reason"] == "supabase_insert_failed"
    assert "couldn't save" in sent_messages[-1]["text"].lower()
    # Session retained for retry
    assert service.get_session(10) is not None


def test_malformed_email_rejected(service, sent_messages):
    service.handle_update(_msg(10, f"/start {BIZ_ID}"))
    service.handle_update(_msg(10, "3"))
    service.handle_update(_msg(10, "Need more self-checkout lanes."))
    result = service.handle_update(_msg(10, "not-an-email"))
    assert result["ok"] is False
    assert result["reason"] == "invalid_email"
    assert service.get_session(10).state == ConversationState.AWAITING_EMAIL


def test_missing_telegram_bot_token_build_sender():
    with pytest.raises(TelegramConfigError):
        build_telegram_send_message("")


def test_webhook_missing_token_returns_503(api_client):
    # Telegram router is intentionally unmounted — QR/form is the direct channel.
    res = api_client.post(
        "/telegram/webhook",
        json=_msg(1, f"/start {BIZ_ID}"),
    )
    assert res.status_code == 404


def test_telegram_health_reports_unconfigured(api_client):
    res = api_client.get("/telegram/health")
    assert res.status_code == 404


def test_webhook_happy_path_with_injected_service(api_client, service):
    # Service-layer still unit-tested; HTTP routes are disabled product-wide.
    telegram_router.reset_telegram_service_for_tests(service)
    res = api_client.post(
        "/telegram/webhook",
        json=_msg(99, f"/start {BIZ_ID}"),
    )
    assert res.status_code == 404
    telegram_router.reset_telegram_service_for_tests(None)


def test_business_isolation_different_chats(sent_messages):
    other_id = "22222222-2222-2222-2222-222222222222"
    db = MagicMock()
    submissions = MagicMock()
    submissions.insert.return_value = submissions
    submissions.execute.return_value = MagicMock(data=[{"id": "ok"}])
    db._submissions_table = submissions

    def table(name):
        if name == "businesses":
            chain = MagicMock()
            chain.select.return_value = chain

            def eq_side(col, val):
                chain._last_id = val
                return chain

            def exec_biz():
                bid = getattr(chain, "_last_id", None)
                if bid == BIZ_ID:
                    return MagicMock(data=[{
                        "id": BIZ_ID,
                        "business_name": BIZ_NAME,
                        "industry": "Supermarket",
                    }])
                if bid == other_id:
                    return MagicMock(data=[{
                        "id": other_id,
                        "business_name": "OtherCo",
                        "industry": "Cafe",
                    }])
                return MagicMock(data=[])

            chain.eq.side_effect = eq_side
            chain.execute.side_effect = exec_biz
            return chain
        if name == "feedback_submissions":
            return submissions
        return MagicMock()

    db.table.side_effect = table

    def send_message(chat_id, text, reply_markup=None):
        sent_messages.append({"chat_id": chat_id, "text": text, "reply_markup": reply_markup})
        return {"ok": True}

    service = TelegramFeedbackService(
        get_db=lambda: db,
        send_message=send_message,
        get_engagement_mode=lambda industry: "improvement",
    )

    service.handle_update(_msg(1, f"/start {BIZ_ID}"))
    service.handle_update(_msg(2, f"/start {other_id}"))
    assert service.get_session(1).business_id == BIZ_ID
    assert service.get_session(2).business_id == other_id

    service.handle_update(_msg(1, "2"))
    service.handle_update(_msg(1, "Aisle 3 lighting is broken."))
    result = service.handle_update(_msg(1, "Skip"))
    assert result["business_id"] == BIZ_ID
    insert_call = submissions.insert.call_args[0][0]
    assert insert_call["business_id"] == BIZ_ID
    assert insert_call["business_id"] != other_id
