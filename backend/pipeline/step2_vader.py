"""
Step 2 — VADER Sentiment Filter
Scores each clean review and routes actionable ones to Gemini.
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


def run(session_id: str) -> dict:
    db = get_db()

    # Only process clean reviews (not spam, not duplicate)
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

    for row in rows:
        text   = row["cleaned_text"] or ""
        rating = row.get("rating")
        scores = _analyzer.polarity_scores(text)
        compound = scores["compound"]

        if compound > 0.35:
            label = "positive"
            # Route positive only if it looks like a feature request
            route = _is_feature_request(text)
        elif compound < -0.05:
            label = "negative"
            route = True
        else:
            label = "neutral"
            # Neutral + low rating still actionable
            route = bool(rating and rating <= 3)

        stats[label] += 1
        if route:
            stats["routed"] += 1

        db.table("reviews").update({
            "sentiment_score": compound,
            "sentiment_label": label,
            "routed_to_llm": route,
        }).eq("id", row["id"]).execute()

    return stats
