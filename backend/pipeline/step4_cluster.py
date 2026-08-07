"""
Step 4 — Issue Clustering
Groups categorizations by issue_key, aggregates stats, collects sample reviews.
Pure backend math — no AI.
"""
import json
from collections import defaultdict
from database import get_db


def run(session_id: str) -> dict:
    db = get_db()

    # Join categorizations with reviews for sentiment + rating
    cats = (
        db.table("categorizations")
        .select("issue_key,category,business_area,severity,confidence,summary,review_id")
        .eq("session_id", session_id)
        .execute()
        .data
    )

    if not cats:
        return {"clusters": 0}

    # Fetch review data we need (sentiment, rating, source, text)
    review_ids = list({c["review_id"] for c in cats})
    # Supabase in() filter
    reviews_data = (
        db.table("reviews")
        .select("id,sentiment_score,rating,source,cleaned_text")
        .in_("id", review_ids)
        .execute()
        .data
    )
    review_map = {r["id"]: r for r in reviews_data}

    # Group by issue_key
    clusters: dict[str, dict] = defaultdict(lambda: {
        "severities": [],
        "confidences": [],
        "sentiments": [],
        "ratings": [],
        "platforms": set(),
        "sample_texts": [],
        "category": "",
        "business_area": "",
        "description": "",
        "premium_count": 0,
    })

    for cat in cats:
        key = cat["issue_key"]
        c   = clusters[key]
        c["category"]     = c["category"] or cat["category"]
        c["business_area"] = c["business_area"] or cat["business_area"]
        c["description"]  = c["description"] or cat["summary"]

        c["severities"].append(cat["severity"] or 5)
        c["confidences"].append(cat["confidence"] or 50)

        review = review_map.get(cat["review_id"], {})
        sentiment = review.get("sentiment_score") or 0
        rating    = review.get("rating")
        source    = review.get("source", "unknown")
        text      = review.get("cleaned_text", "")

        c["sentiments"].append(sentiment)
        c["ratings"].append(rating)
        c["platforms"].add(source)

        # Premium user proxy: gave a low rating (1-3) or strong negative sentiment
        if (rating and rating <= 3) or sentiment < -0.5:
            c["premium_count"] += 1

        # Keep top 5 sample texts (most severe first — sort later)
        if len(c["sample_texts"]) < 5 and text:
            c["sample_texts"].append(text)

    # Write clusters to DB
    inserts = []
    for issue_key, c in clusters.items():
        avg_sev  = sum(c["severities"]) / len(c["severities"])
        avg_conf = sum(c["confidences"]) / len(c["confidences"])
        avg_sent = sum(c["sentiments"]) / max(len(c["sentiments"]), 1)

        inserts.append({
            "session_id":        session_id,
            "issue_key":         issue_key,
            "category":          c["category"],
            "business_area":     c["business_area"],
            "description":       c["description"],
            "review_count":      len(c["severities"]),
            "avg_severity":      round(avg_sev, 2),
            "avg_confidence":    round(avg_conf, 2),
            "avg_sentiment":     round(avg_sent, 4),
            "premium_user_count": c["premium_count"],
            "platforms":         list(c["platforms"]),
            "sample_reviews":    c["sample_texts"][:5],
        })

    db.table("issue_clusters").insert(inserts).execute()
    return {"clusters": len(inserts)}
