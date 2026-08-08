"""
Step 1 — Normalize + Deduplicate + Spam filter
Runs text normalisation, exact/obvious-duplicate detection, and spam detection.
Does NOT aggressively collapse legitimate similar complaints.
"""
from database import get_db
from services.spam_detector import is_spam, text_hash, is_fuzzy_duplicate, normalize


def _similar_length(a: str, b: str, tol: float = 0.25) -> bool:
    """Fuzzy dup only if lengths are close — avoids merging related-but-distinct complaints."""
    la, lb = len(a), len(b)
    if la == 0 or lb == 0:
        return False
    ratio = min(la, lb) / max(la, lb)
    return ratio >= (1.0 - tol)


def run(session_id: str) -> dict:
    db = get_db()

    rows = db.table("reviews").select("id,raw_text").eq("session_id", session_id).execute().data

    seen_hashes: dict[str, str] = {}
    seen_texts: list[str] = []

    stats = {"total": len(rows), "duplicates": 0, "spam": 0, "clean": 0}

    for row in rows:
        raw = row["raw_text"]
        rid = row["id"]
        norm = normalize(raw)

        if is_spam(norm):
            db.table("reviews").update({
                "is_spam": True,
                "cleaned_text": norm,
            }).eq("id", rid).execute()
            stats["spam"] += 1
            continue

        # Exact duplicate (normalized hash)
        h = text_hash(norm)
        if h in seen_hashes:
            db.table("reviews").update({
                "is_duplicate": True,
                "cleaned_text": norm,
            }).eq("id", rid).execute()
            stats["duplicates"] += 1
            continue

        # Obvious near-duplicate only (high similarity + similar length)
        is_dup = False
        for prev_text in seen_texts[-500:]:
            if _similar_length(norm, prev_text) and is_fuzzy_duplicate(norm, prev_text):
                is_dup = True
                break

        if is_dup:
            db.table("reviews").update({
                "is_duplicate": True,
                "cleaned_text": norm,
            }).eq("id", rid).execute()
            stats["duplicates"] += 1
            continue

        seen_hashes[h] = rid
        seen_texts.append(norm)
        db.table("reviews").update({
            "cleaned_text": norm,
            "is_spam": False,
            "is_duplicate": False,
        }).eq("id", rid).execute()
        stats["clean"] += 1

    return stats
