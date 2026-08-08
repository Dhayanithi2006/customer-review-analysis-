"""
Upload Router — Module 1
POST /upload  →  ingests CSV, normalizes columns, stores reviews, fires pipeline
Phase 3: Maps review/comment/feedback/description/issue/response_text → review_text
         rating/score/stars → rating; date fields → date
         Preserves business_id, source, customer_tier, email
"""
import io
import uuid
import pandas as pd
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from database import get_db
from pipeline.orchestrator import run_pipeline
from config import MAX_REVIEWS
from services.business_linkage import resolve_business_id, create_analysis_version
from services.column_normalizer import (
    map_dataframe_columns,
    normalize_dataframe,
    CANONICAL_TEXT,
    CANONICAL_RATING,
    CANONICAL_DATE,
)

router = APIRouter(prefix="/upload", tags=["upload"])


def _create_analysis_version(db, business_id: str, session_id: str) -> None:
    """Backward-compatible wrapper — prefer create_analysis_version."""
    create_analysis_version(db, business_id, session_id)


@router.post("")
async def upload_csv(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    source: str = Form(...),
    team_size: str = Form(default="small_team"),
    business_id: str = Form(default=None),
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(400, "Only CSV files are accepted.")

    contents = await file.read()
    if len(contents) > 50 * 1024 * 1024:
        raise HTTPException(400, "File exceeds 50 MB limit.")

    try:
        df = pd.read_csv(io.BytesIO(contents), encoding="utf-8", on_bad_lines="skip")
    except Exception:
        try:
            df = pd.read_csv(io.BytesIO(contents), encoding="latin-1", on_bad_lines="skip")
        except Exception as e:
            raise HTTPException(400, f"Could not parse CSV: {e}")

    if df.empty:
        raise HTTPException(400, "CSV file is empty.")

    headers = list(df.columns)
    column_map = map_dataframe_columns(df)
    if not column_map.get(CANONICAL_TEXT):
        raise HTTPException(422, detail={
            "error": "Could not detect review text column.",
            "columns": headers,
            "needs_mapping": True,
        })

    try:
        normalized, column_map = normalize_dataframe(
            df,
            default_source=source or "csv",
            default_business_id=business_id,
        )
    except ValueError as e:
        raise HTTPException(422, detail={"error": str(e), "columns": headers, "needs_mapping": True})

    if len(normalized) < 10:
        raise HTTPException(400, "Need at least 10 non-empty reviews.")
    if len(normalized) > MAX_REVIEWS:
        normalized = normalized.head(MAX_REVIEWS)

    db = get_db()
    session_id = str(uuid.uuid4())
    resolved_business_id = resolve_business_id(
        db,
        business_id,
        label=file.filename or "CSV Analysis",
        source=source if source else "csv",
    )

    session_row = {
        "id":            session_id,
        "filename":      file.filename,
        "source":        source or "csv",
        "team_size":     team_size,
        "status":        "pending",
        "total_reviews": len(normalized),
        "business_id":   resolved_business_id,
    }

    db.table("sessions").insert(session_row).execute()
    create_analysis_version(db, resolved_business_id, session_id)

    rows = []
    for _, nrow in normalized.iterrows():
        # Prefer CSV business_id if present; never steal another workspace's data —
        # only use row business_id when it matches the resolved workspace.
        row_biz = nrow.get("business_id")
        preserved_biz = (
            str(row_biz)
            if row_biz and str(row_biz) == str(resolved_business_id)
            else resolved_business_id
        )
        row_source = str(nrow.get("source") or source or "csv")
        review_row = {
            "id":          str(uuid.uuid4()),
            "session_id":  session_id,
            "raw_text":    str(nrow.get("review_text") or "").strip(),
            "source":      row_source,
            "rating":      nrow.get("rating") if pd.notna(nrow.get("rating")) else None,
            "review_date": nrow.get("date") if pd.notna(nrow.get("date")) else None,
            "business_id": preserved_biz,
        }
        email = nrow.get("email")
        if email and pd.notna(email):
            review_row["customer_email"] = str(email)[:200]
        tier = nrow.get("customer_tier")
        if tier and pd.notna(tier):
            review_row["customer_tier"] = str(tier)[:80]
        rows.append(review_row)

    for i in range(0, len(rows), 500):
        try:
            db.table("reviews").insert(rows[i:i + 500]).execute()
        except Exception:
            # Columns customer_email / customer_tier / business_id may be missing — strip extras
            stripped = []
            for r in rows[i:i + 500]:
                stripped.append({
                    k: v for k, v in r.items()
                    if k in ("id", "session_id", "raw_text", "source", "rating", "review_date")
                })
            db.table("reviews").insert(stripped).execute()

    background_tasks.add_task(run_pipeline, session_id)

    return {
        "session_id":    session_id,
        "business_id":   resolved_business_id,
        "total_reviews": len(normalized),
        "detected_columns": {
            "text":          column_map.get(CANONICAL_TEXT),
            "review_text":   column_map.get(CANONICAL_TEXT),
            "rating":        column_map.get(CANONICAL_RATING),
            "date":          column_map.get(CANONICAL_DATE),
            "email":         column_map.get("email"),
            "customer_tier": column_map.get("customer_tier"),
            "business_id":   column_map.get("business_id"),
            "source":        column_map.get("source"),
        },
        "status_url":    f"/pipeline/{session_id}/status",
        "dashboard_url": f"/results/{session_id}/dashboard",
        "workspace_url": f"/business/{resolved_business_id}/analysis",
    }


@router.get("/preview")
async def preview_csv(file: UploadFile = File(...)):
    """Return first 10 rows with detected columns for the upload preview UI."""
    contents = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(contents), nrows=10, encoding="utf-8")
    except Exception:
        df = pd.read_csv(io.BytesIO(contents), nrows=10, encoding="latin-1")

    headers = list(df.columns)
    detected = map_dataframe_columns(df)
    return {
        "columns":  headers,
        "rows":     df.fillna("").to_dict(orient="records"),
        "detected": {
            "text":   detected.get(CANONICAL_TEXT),
            "rating": detected.get(CANONICAL_RATING),
            "date":   detected.get(CANONICAL_DATE),
            "email":  detected.get("email"),
            "customer_tier": detected.get("customer_tier"),
        },
    }
