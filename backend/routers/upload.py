"""
Upload Router — Module 1
POST /upload  →  ingests CSV, auto-detects columns, stores reviews, fires pipeline
"""
import io
import uuid
import pandas as pd
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from database import get_db
from pipeline.orchestrator import run_pipeline
from config import MAX_REVIEWS

router = APIRouter(prefix="/upload", tags=["upload"])

# ── Column auto-detection keywords ───────────────────────────────────────────
TEXT_KEYWORDS   = {"review", "text", "feedback", "comment", "body", "content", "description"}
RATING_KEYWORDS = {"rating", "stars", "score", "note", "star"}
DATE_KEYWORDS   = {"date", "time", "created", "submitted", "timestamp"}
USER_KEYWORDS   = {"user", "author", "customer", "id", "userid", "user_id", "reviewer"}


def _detect_column(headers: list[str], keywords: set[str], exclude: set[str] = None) -> str | None:
    exclude = exclude or set()
    for h in headers:
        if h in exclude:
            continue
        h_words = set(h.lower().replace("_", " ").replace("-", " ").split())
        if any(kw == h.lower() or kw in h_words or (len(kw) > 3 and kw in h.lower()) for kw in keywords):
            return h
    return None


@router.post("")
async def upload_csv(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    source: str = Form(...),
    team_size: str = Form(default="small_team"),
):
    # ── Validate file type ────────────────────────────────────────────────────
    if not file.filename.endswith(".csv"):
        raise HTTPException(400, "Only CSV files are accepted.")

    contents = await file.read()
    if len(contents) > 50 * 1024 * 1024:
        raise HTTPException(400, "File exceeds 50 MB limit.")

    # ── Parse CSV ─────────────────────────────────────────────────────────────
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

    # ── Auto-detect columns ───────────────────────────────────────────────────
    text_col   = _detect_column(headers, TEXT_KEYWORDS)
    rating_col = _detect_column(headers, RATING_KEYWORDS, exclude={text_col} if text_col else set())
    date_col   = _detect_column(headers, DATE_KEYWORDS, exclude={text_col, rating_col} - {None})

    if not text_col:
        # Cannot proceed without a text column
        raise HTTPException(422, detail={
            "error": "Could not detect review text column.",
            "columns": headers,
            "needs_mapping": True,
        })

    # ── Validate row count ────────────────────────────────────────────────────
    df = df.dropna(subset=[text_col])
    df = df[df[text_col].astype(str).str.strip() != ""]

    if len(df) < 10:
        raise HTTPException(400, "Need at least 10 non-empty reviews.")
    if len(df) > MAX_REVIEWS:
        df = df.head(MAX_REVIEWS)  # Silently cap

    # ── Create session ────────────────────────────────────────────────────────
    db = get_db()
    session_id = str(uuid.uuid4())

    db.table("sessions").insert({
        "id":           session_id,
        "filename":     file.filename,
        "source":       source,
        "team_size":    team_size,
        "status":       "pending",
        "total_reviews": len(df),
    }).execute()

    # ── Bulk-insert reviews ───────────────────────────────────────────────────
    rows = []
    for _, row in df.iterrows():
        raw_text = str(row[text_col]).strip()
        rating   = None
        rev_date = None

        if rating_col and rating_col in row:
            try:
                rating = int(float(row[rating_col]))
                if not (1 <= rating <= 5):
                    rating = None
            except Exception:
                pass

        if date_col and date_col in row:
            try:
                rev_date = pd.to_datetime(row[date_col]).date().isoformat()
            except Exception:
                pass

        rows.append({
            "id":          str(uuid.uuid4()),
            "session_id":  session_id,
            "raw_text":    raw_text,
            "source":      source,
            "rating":      rating,
            "review_date": rev_date,
        })

    # Insert in batches of 500 to stay within Supabase limits
    for i in range(0, len(rows), 500):
        db.table("reviews").insert(rows[i:i+500]).execute()

    # ── Fire pipeline in background ───────────────────────────────────────────
    background_tasks.add_task(run_pipeline, session_id)

    return {
        "session_id":   session_id,
        "total_reviews": len(df),
        "detected_columns": {
            "text":   text_col,
            "rating": rating_col,
            "date":   date_col,
        },
        "status_url":    f"/pipeline/{session_id}/status",
        "dashboard_url": f"/results/{session_id}/dashboard",
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
    return {
        "columns":  headers,
        "rows":     df.fillna("").to_dict(orient="records"),
        "detected": {
            "text":   _detect_column(headers, TEXT_KEYWORDS),
            "rating": _detect_column(headers, RATING_KEYWORDS),
            "date":   _detect_column(headers, DATE_KEYWORDS),
        },
    }
