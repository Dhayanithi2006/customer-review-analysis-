"""
Step 2 — VADER Sentiment Filter
Scores each clean review: positive | neutral | negative + compound score.
Routes actionable reviews to Gemini for categorization.

IMPORTANT: Negative sentiment does NOT automatically imply highest business
priority — priority is computed later by the deterministic impact engine.
"""
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from database import get_db

_analyzer = SentimentIntensityAnalyzer()

# Keywords that suggest a feature request even in positive reviews
FEATURE_REQUEST_KEYWORDS = [
    "wish", "would love", "missing", "if only", "need", "want",
    "please add", "should have", "could you add", "hope you add",
    "would be great", "looking forward", "feature request",
]


def _is_feature_request(text: str) -> bool:
    t = text.lower()
    return any(kw in t for kw in FEATURE_REQUEST_KEYWORDS)


def classify_sentiment(text: str, rating=None) -> dict:
    """
    Pure function for unit tests / reuse.
    Returns sentiment_label, sentiment_score, routed_to_llm.
    """
    scores = _analyzer.polarity_scores(text or "")
    compound = float(scores["compound"])

    if compound > 0.35:
        label = "positive"
        route = _is_feature_request(text or "")
    elif compound < -0.05:
        label = "negative"
        # Route for categorization — NOT an automatic top-priority flag
        route = True
    else:
        label = "neutral"
        route = bool(rating and rating <= 3)

    return {
        "sentiment_label": label,
        "sentiment_score": compound,
        "routed_to_llm": route,
        "compound": compound,
        "pos": float(scores["pos"]),
        "neu": float(scores["neu"]),
        "neg": float(scores["neg"]),
    }


def run(session_id: str) -> dict:
    db = get_db()

    rows = (
        db.table("reviews")
        .select("id,cleaned_text,rating")
        .eq("session_id", session_id)
        .eq("is_spam", False)
        .eq("is_duplicate", False)
        .execute()
        .data
    )

    stats = {"positive": 0, "negative": 0, "neutral": 0, "routed": 0}

    if isinstance(rows, list):
        for row in rows:
            if not isinstance(row, dict):
                continue
            r_dict = dict(row)
            text = str(r_dict.get("cleaned_text") or "")
            rating = r_dict.get("rating")
            result = classify_sentiment(text, rating)

            label = result["sentiment_label"]
            stats[label] += 1
            if result["routed_to_llm"]:
                stats["routed"] += 1

            db.table("reviews").update({
                "sentiment_score": result["sentiment_score"],
                "sentiment_label": label,
                "routed_to_llm": result["routed_to_llm"],
            }).eq("id", r_dict.get("id")).execute()

    return stats
