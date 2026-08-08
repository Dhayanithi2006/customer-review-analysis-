"""
Pytest configuration and shared test fixtures for RoadmapAI backend.
"""
import os
# Soften owner auth for legacy mocked tests (businesses without owner_token_hash).
# Dedicated ownership isolation tests set OWNER_AUTH_ENFORCE=true themselves.
os.environ.setdefault("OWNER_AUTH_ENFORCE", "false")

import pytest
import io
import pandas as pd
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

# Register sys path for backend
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from main import app


@pytest.fixture
def api_client():
    """FastAPI TestClient instance."""
    return TestClient(app)


@pytest.fixture
def sample_valid_csv():
    """Valid CSV byte stream with 15 customer reviews."""
    content = """review_text,rating,review_date,user_id
Checkout keeps crashing whenever I enter CVV code,1,2026-02-01,user_101
Login takes over 30 seconds on 5G network,2,2026-02-02,user_102
Love the dark mode UI update! Looks incredible.,5,2026-02-03,user_103
Payment retries keep failing silently on UPI,1,2026-02-04,user_104
Checkout keeps crashing whenever I enter CVV code,1,2026-02-01,user_101
Nice app overall but dark mode has low contrast,3,2026-02-05,user_105
Subscription auto-renewed without sending reminder email,2,2026-02-06,user_106
Wish there was a CSV export feature for reports,4,2026-02-07,user_107
Great customer support response time!,5,2026-02-08,user_108
App crashes on launch after v2.4 update,1,2026-02-09,user_109
Search bar does not filter results correctly,2,2026-02-10,user_110
Payment retries keep failing silently on UPI,1,2026-02-04,user_104
Onboarding tutorial is too long and cannot be skipped,2,2026-02-11,user_111
Push notifications are not arriving on iOS 18,2,2026-02-12,user_112
Love the new design! Super slick and fast.,5,2026-02-13,user_113
"""
    return content.encode("utf-8")


@pytest.fixture
def sample_edge_case_csvs():
    """Collection of edge case CSV payloads."""
    return {
        "empty": b"",
        "headers_only": b"review_text,rating,review_date\n",
        "too_few_rows": b"review_text,rating\nGreat app!,5\nBroken app,1\n",
        "malformed_encoding": "review_text,rating\nCafé order crashed,1\n".encode("latin-1"),
        "no_text_column": b"user_name,score,timestamp\nAlice,5,2026-01-01\nBob,1,2026-01-02\n",
        "large_text_rows": ("review_text,rating\n" + ("A" * 5000 + ",5\n") * 15).encode("utf-8"),
        "pii_heavy": b"review_text,rating\nCall me at john@example.com or 555-0199 SSN 123-45-6789,1\n",
    }


@pytest.fixture
def mock_supabase_db(mocker=None):
    """Mock Supabase DB client preventing real database writes during unit tests."""
    mock_client = MagicMock()
    mock_table = MagicMock()
    mock_client.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.insert.return_value = mock_table
    mock_table.update.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.order.return_value = mock_table
    mock_table.limit.return_value = mock_table
    mock_table.single.return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=[{"id": "test-session-123"}], count=10)
    return mock_client
