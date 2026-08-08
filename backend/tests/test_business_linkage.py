"""
Phase 1 — Business-centric architecture unit tests.
"""
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from services.business_linkage import (
    create_analysis_business,
    resolve_business_id,
    validate_business_id,
)


def test_validate_business_id_ok():
    db = MagicMock()
    db.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"id": "biz-1", "business_name": "FreshMart", "industry": "Supermarket"}]
    )
    row = validate_business_id(db, "biz-1")
    assert row["id"] == "biz-1"


def test_validate_business_id_missing():
    db = MagicMock()
    db.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[]
    )
    with pytest.raises(HTTPException) as exc:
        validate_business_id(db, "missing")
    assert exc.value.status_code == 404


def test_resolve_business_id_uses_provided():
    db = MagicMock()
    db.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"id": "biz-9", "business_name": "X", "industry": "SaaS"}]
    )
    assert resolve_business_id(db, "biz-9", label="x", source="csv") == "biz-9"


def test_resolve_business_id_auto_creates_when_missing():
    db = MagicMock()
    insert_chain = MagicMock()
    db.table.return_value.insert.return_value = insert_chain
    insert_chain.execute.return_value = MagicMock(data=[{"id": "ok"}])

    bid = resolve_business_id(db, None, label="demo.csv", source="csv")
    assert bid  # uuid string
    insert_args = db.table.return_value.insert.call_args[0][0]
    assert insert_args["id"] == bid
    assert insert_args["feedback_method"] == "csv"
    assert "dashboard_url" in insert_args
