"""
Step 1 — Data Cleaning
Runs deduplication, spam detection, and text normalisation.
Updates each review row in Supabase with cleaned fields.
"""
from database import get_db
from services.spam_detector import is_spam, text_hash, is_fuzzy_duplicate, normalize


def run(session_id: str) -> dict:
    db = get_db()

    # Fetch all reviews for this session
    rows = db.table("reviews").select("id,raw_text").eq("session_id", session_id).execute().data

    seen_hashes: dict[str, str] = {}   # hash → first review id
    seen_texts:  list[str]      = []   # for fuzzy matching

    stats = {"total": len(rows), "duplicates": 0, "spam": 0, "clean": 0}

    for row in rows:
        raw  = row["raw_text"]
        rid  = row["id"]
        norm = normalize(raw)

        # ── Spam check ────────────────────────────────────────────────────
        if is_spam(norm):
            db.table("reviews").update({
                "is_spam": True,
                "cleaned_text": norm,
            }).eq("id", rid).execute()
            stats["spam"] += 1
            continue

        # ── Exact duplicate check ─────────────────────────────────────────
        h = text_hash(norm)
        if h in seen_hashes:
            db.table("reviews").update({
                "is_duplicate": True,
                "cleaned_text": norm,
            }).eq("id", rid).execute()
            stats["duplicates"] += 1
            continue

        # ── Fuzzy duplicate check (only against last 500 to keep it fast) ─
        is_dup = False
        for prev_text in seen_texts[-500:]:
            if is_fuzzy_duplicate(norm, prev_text):
                is_dup = True
                break

        if is_dup:
            db.table("reviews").update({
                "is_duplicate": True,
                "cleaned_text": norm,
            }).eq("id", rid).execute()
            stats["duplicates"] += 1
            continue

        # ── Clean review ──────────────────────────────────────────────────
        seen_hashes[h] = rid
        seen_texts.append(norm)
        db.table("reviews").update({
            "cleaned_text": norm,
            "is_spam": False,
            "is_duplicate": False,
        }).eq("id", rid).execute()
        stats["clean"] += 1

    return stats
