"""
API Tests — FastAPI Endpoint Contract & Error Validation
- POST /upload (CSV upload)
- POST /upload/play-store (Play Store scraper)
- GET /pipeline/{id}/poll
- GET /results/{id}/dashboard
- GET /results/{id}/evidence/{issue_key}
- GET /meeting/{id}/questions
- POST /meeting/{id}/message
- GET /export/{id}/sprint & roadmap
- GET /results/history
"""
import pytest
from unittest.mock import patch, MagicMock


# ── Test 1: Health Root ────────────────────────────────────────────────────────
def test_health_check_endpoint(api_client):
    res = api_client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


# ── Test 2: Upload CSV Endpoints & Validation ──────────────────────────────────
def test_upload_csv_rejects_non_csv_files(api_client):
    res = api_client.post(
        "/upload",
        files={"file": ("test.txt", b"some text file content", "text/plain")},
        data={"source": "play_store", "team_size": "2_5"}
    )
    assert res.status_code == 400
    assert "Only CSV files are accepted" in res.json()["detail"]


def test_upload_csv_rejects_empty_files(api_client):
    res = api_client.post(
        "/upload",
        files={"file": ("empty.csv", b"", "text/csv")},
        data={"source": "play_store", "team_size": "2_5"}
    )
    assert res.status_code in (400, 422)


def test_upload_csv_handles_unmapped_columns(api_client):
    res = api_client.post(
        "/upload",
        files={"file": ("invalid_headers.csv", b"user_id,rating,date\n101,5,2026-01-01\n", "text/csv")},
        data={"source": "play_store", "team_size": "2_5"}
    )
    assert res.status_code in (400, 422)


@patch("routers.upload.get_db")
@patch("routers.upload.run_pipeline")
def test_upload_csv_success(mock_run_pipeline, mock_get_db, api_client, sample_valid_csv):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    mock_db.table.return_value.insert.return_value.execute.return_value = None

    res = api_client.post(
        "/upload",
        files={"file": ("sample_reviews.csv", sample_valid_csv, "text/csv")},
        data={"source": "play_store", "team_size": "2_5"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "session_id" in data
    assert data["total_reviews"] > 0
    assert data["detected_columns"]["text"] == "review_text"


# ── Test 3: Play Store Upload Endpoint ────────────────────────────────────────
def test_play_store_upload_validates_app_id(api_client):
    res = api_client.post(
        "/upload/play-store",
        json={"app_id": "   ", "count": 100, "team_size": "2_5"}
    )
    assert res.status_code in (400, 422)


@patch("google_play_scraper.reviews")
@patch("routers.play_store.get_db")
@patch("routers.play_store.run_pipeline")
def test_play_store_upload_success(mock_run_pipeline, mock_get_db, mock_play_reviews, api_client):
    mock_play_reviews.return_value = (
        [
          {"content": "Great app overall", "score": 5, "at": None, "userName": "user1"},
          {"content": "App crashes on launch", "score": 1, "at": None, "userName": "user2"},
        ] * 6,
        None
    )
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    mock_db.table.return_value.insert.return_value.execute.return_value = None

    res = api_client.post(
        "/upload/play-store",
        json={"app_id": "com.example.testapp", "count": 50, "team_size": "2_5"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["app_id"] == "com.example.testapp"
    assert data["total_reviews"] == 12


# ── Test 4: Pipeline Status Endpoint ──────────────────────────────────────────
@patch("routers.pipeline.get_db")
def test_pipeline_status_poll(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    mock_db.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
        "status": "categorizing",
        "current_step": 3,
        "processed_reviews": 50,
        "total_reviews": 100,
        "error_message": ""
    }

    res = api_client.get("/pipeline/test-session-123/poll")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "categorizing"
    assert data["step"] == 3
    assert data["progress"] == 65


# ── Test 5: Meeting Message Validation ────────────────────────────────────────
def test_meeting_message_rejects_empty(api_client):
    res = api_client.post(
        "/meeting/test-session-123/message",
        json={"message": "   "}
    )
    assert res.status_code == 400
    assert "empty" in res.json()["detail"].lower()


def test_meeting_message_rejects_overly_long_text(api_client):
    res = api_client.post(
        "/meeting/test-session-123/message",
        json={"message": "A" * 600}
    )
    assert res.status_code == 400
    assert "too long" in res.json()["detail"].lower()


# ── Test 6: Decision Log / History Endpoint ────────────────────────────────────
@patch("routers.results.get_db")
def test_session_history_endpoint(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    mock_db.table.return_value.select.return_value.order.return_value.limit.return_value.execute.return_value.data = [
        {
            "id": "session-1",
            "filename": "reviews.csv",
            "source": "play_store",
            "status": "complete",
            "total_reviews": 150,
            "created_at": "2026-02-01T10:00:00Z"
        }
    ]

    res = api_client.get("/results/history")
    assert res.status_code == 200
    data = res.json()
    assert "sessions" in data
    assert len(data["sessions"]) == 1
    assert data["sessions"][0]["id"] == "session-1"
