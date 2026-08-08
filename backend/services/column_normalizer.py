"""
Phase 3 — Column / field normalization for feedback ingest.

Maps heterogeneous CSV headers onto the canonical review schema:
  review_text, rating, date
and preserves: business_id, source, customer_tier, email
"""
from __future__ import annotations

from typing import Any, Optional
import pandas as pd

# Canonical output field names
CANONICAL_TEXT = "review_text"
CANONICAL_RATING = "rating"
CANONICAL_DATE = "date"

TEXT_ALIASES = {
    "review", "comment", "feedback", "description", "issue",
    "response_text", "text", "body", "content", "review_text",
    "message", "complaint",
}
RATING_ALIASES = {
    "rating", "score", "stars", "star", "note", "star_rating",
}
DATE_ALIASES = {
    "date", "time", "created", "submitted", "timestamp",
    "review_date", "created_at", "submitted_at", "feedback_date",
}
EMAIL_ALIASES = {"email", "customer_email", "user_email", "mail"}
TIER_ALIASES = {
    "customer_tier", "tier", "plan", "segment", "customer_segment",
    "user_tier", "account_type",
}
BUSINESS_ID_ALIASES = {"business_id", "biz_id", "workspace_id"}
SOURCE_ALIASES = {"source", "channel", "feedback_source"}


def _norm_header(h: str) -> str:
    return str(h).strip().lower().replace("-", "_").replace(" ", "_")


def _header_matches(header: str, aliases: set[str]) -> bool:
    h = _norm_header(header)
    if h in aliases:
        return True
    words = set(h.replace("__", "_").split("_"))
    return any(a in words or (len(a) > 3 and a in h) for a in aliases)


def detect_column(headers: list[str], aliases: set[str], exclude: set[str] | None = None) -> Optional[str]:
    exclude = exclude or set()
    for h in headers:
        if h in exclude:
            continue
        if _header_matches(h, aliases):
            return h
    return None


def map_dataframe_columns(df: pd.DataFrame) -> dict[str, Optional[str]]:
    """
    Detect source columns and return mapping:
      { review_text, rating, date, email, customer_tier, business_id, source }
    Values are original dataframe column names (or None).
    """
    headers = [str(c) for c in df.columns]
    text_col = detect_column(headers, TEXT_ALIASES)
    rating_col = detect_column(headers, RATING_ALIASES, exclude={text_col} if text_col else set())
    used = {c for c in (text_col, rating_col) if c}
    date_col = detect_column(headers, DATE_ALIASES, exclude=used)
    used = used | ({date_col} if date_col else set())
    email_col = detect_column(headers, EMAIL_ALIASES, exclude=used)
    used = used | ({email_col} if email_col else set())
    tier_col = detect_column(headers, TIER_ALIASES, exclude=used)
    used = used | ({tier_col} if tier_col else set())
    biz_col = detect_column(headers, BUSINESS_ID_ALIASES, exclude=used)
    used = used | ({biz_col} if biz_col else set())
    source_col = detect_column(headers, SOURCE_ALIASES, exclude=used)

    return {
        CANONICAL_TEXT: text_col,
        CANONICAL_RATING: rating_col,
        CANONICAL_DATE: date_col,
        "email": email_col,
        "customer_tier": tier_col,
        "business_id": biz_col,
        "source": source_col,
    }


def _parse_rating(value: Any) -> Optional[int]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    try:
        rating = int(float(value))
        if 1 <= rating <= 5:
            return rating
    except Exception:
        pass
    return None


def _parse_date(value: Any) -> Optional[str]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    try:
        return pd.to_datetime(value).date().isoformat()
    except Exception:
        return None


def _clean_str(value: Any) -> Optional[str]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    s = str(value).strip()
    return s or None


def normalize_row(
    row: pd.Series | dict,
    column_map: dict[str, Optional[str]],
    *,
    default_source: str = "csv",
    default_business_id: Optional[str] = None,
) -> dict:
    """
    Produce a normalized review dict from one CSV/DataFrame row.
    Always includes review_text when mappable; preserves metadata fields.
    """
    def get(col: Optional[str]) -> Any:
        if not col:
            return None
        if isinstance(row, dict):
            return row.get(col)
        return row[col] if col in row.index else None

    text_col = column_map.get(CANONICAL_TEXT)
    raw_text = _clean_str(get(text_col)) or ""

    out: dict[str, Any] = {
        "review_text": raw_text,
        "rating": _parse_rating(get(column_map.get(CANONICAL_RATING))),
        "date": _parse_date(get(column_map.get(CANONICAL_DATE))),
        "email": _clean_str(get(column_map.get("email"))),
        "customer_tier": _clean_str(get(column_map.get("customer_tier"))),
        "business_id": _clean_str(get(column_map.get("business_id"))) or default_business_id,
        "source": _clean_str(get(column_map.get("source"))) or default_source,
    }
    return out


def normalize_dataframe(
    df: pd.DataFrame,
    *,
    default_source: str = "csv",
    default_business_id: Optional[str] = None,
) -> tuple[pd.DataFrame, dict[str, Optional[str]]]:
    """
    Return (normalized_df, detected_column_map).
    normalized_df columns: review_text, rating, date, email, customer_tier, business_id, source
    """
    column_map = map_dataframe_columns(df)
    if not column_map.get(CANONICAL_TEXT):
        raise ValueError("Could not detect review text column.")

    records = [
        normalize_row(
            row,
            column_map,
            default_source=default_source,
            default_business_id=default_business_id,
        )
        for _, row in df.iterrows()
    ]
    out = pd.DataFrame.from_records(records)
    out = out[out["review_text"].astype(str).str.strip() != ""]
    return out, column_map
