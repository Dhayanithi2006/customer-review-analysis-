"""
Performance & Security Test Suite
- 50 MB file size limit enforcement
- PII sanitization audit
- SQL Injection protection
- Gemini Token Batching limits
"""
import pytest
from unittest.mock import patch, MagicMock
from services.pii_stripper import strip_pii
from config import BATCH_SIZE, MAX_REVIEWS, SPAM_MIN_CHARS


# ── Security Test 1: File Size Limit (50MB) Enforcement ───────────────────────
def test_file_size_limit_validation(api_client):
    # Simulate a file larger than 50MB
    large_dummy_content = b"review_text,rating\n" + (b"A" * 1024 * 1024 * 51)
    res = api_client.post(
        "/upload",
        files={"file": ("huge.csv", large_dummy_content, "text/csv")},
        data={"source": "play_store", "team_size": "2_5"}
    )
    assert res.status_code == 400
    assert "50 MB limit" in res.json()["detail"]


# ── Security Test 2: PII Redaction Audit ─────────────────────────────────────
def test_pii_sanitization_audit():
    pii_samples = [
        "Email me at user@domain.com for logs",
        "Call customer support at +1 (800) 555-0199",
        "My SSN number is 000-12-3456 please delete account",
        "Credit card 4532-1234-5678-9012 failed"
    ]

    for sample in pii_samples:
        redacted = strip_pii(sample)
        assert "user@domain.com" not in redacted
        assert "555-0199" not in redacted
        assert "000-12-3456" not in redacted
        assert "4532-1234-5678-9012" not in redacted


# ── Security Test 3: SQL Injection Prevention ─────────────────────────────────
@patch("routers.results.get_db")
def test_sql_injection_payload_handling(mock_get_db, api_client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.single.return_value.execute.return_value.data = None

    sql_injection_keys = [
        "' OR '1'='1",
        "issue_key'; DROP TABLE reviews; --",
        "UNION SELECT * FROM sessions"
    ]

    for key in sql_injection_keys:
        res = api_client.get(f"/results/test-session-123/evidence/{key}")
        # Must return proper 404 or 400, never an unhandled 500 database error
        assert res.status_code in (404, 400)


# ── Performance Test 4: Batch Size & Constraints ──────────────────────────────
def test_pipeline_performance_constants():
    assert BATCH_SIZE <= 100  # Ensure batch size is within Gemini token limits
    assert MAX_REVIEWS == 10000  # Cap limits memory footprint
    assert SPAM_MIN_CHARS == 10  # Fast early discard threshold
