"""
Step 4 — Issue Clustering
Groups categorizations by issue_key, aggregates stats, collects sample reviews.
Pure backend math — no AI. Semantically equivalent complaints share issue_key
(e.g. payment_failure).
"""
import json
from collections import defaultdict
from database import get_db
from services.category_taxonomy import normalize_issue_key, normalize_confidence, display_category


def run(session_id: str) -> dict:
    db = get_db()

    cats = (
        db.table("categorizations")
        .select("issue_key,category,business_area,severity,confidence,summary,review_id,raw_llm_output")
        .eq("session_id", session_id)
        .execute()
        .data
    )

    if not cats:
        return {"clusters": 0}

    if isinstance(cats, list):
        review_ids = list({
            str(dict(c).get("review_id"))
            for c in cats
            if isinstance(c, dict) and dict(c).get("review_id")
        })
    else:
        review_ids = []

    reviews_data = (
        db.table("reviews")
        .select("id,sentiment_score,sentiment_label,rating,source,cleaned_text")
        .in_("id", review_ids)
        .execute()
        .data
    ) if review_ids else []
    review_map = {str(dict(r).get("id")): dict(r) for r in (reviews_data or []) if isinstance(r, dict)}

    clusters: dict[str, dict] = defaultdict(lambda: {
        "severities": [],
        "confidences": [],
        "sentiments": [],
        "sentiment_labels": [],
        "ratings": [],
        "platforms": set(),
        "sample_texts": [],
        "evidence": [],
        "category": "",
        "business_area": "",
        "description": "",
        "premium_count": 0,
    })

    if isinstance(cats, list):
        for cat in cats:
            if not isinstance(cat, dict):
                continue
            c_dict = dict(cat)
            key = normalize_issue_key(c_dict.get("issue_key", ""))
            c = clusters[key]
            c["category"] = c["category"] or display_category(c_dict.get("category", ""))
            c["business_area"] = c["business_area"] or c_dict.get("business_area", "")
            c["description"] = c["description"] or c_dict.get("summary", "")

            c["severities"].append(c_dict.get("severity") or 3)
            c["confidences"].append(normalize_confidence(c_dict.get("confidence")))

            review = dict(review_map.get(str(c_dict.get("review_id")), {}))
            sentiment = review.get("sentiment_score") or 0
            sentiment_label = review.get("sentiment_label") or "neutral"
            rating = review.get("rating")
            source = review.get("source", "unknown")
            text = review.get("cleaned_text", "")

            c["sentiments"].append(sentiment)
            c["sentiment_labels"].append(sentiment_label)
            c["ratings"].append(rating)
            c["platforms"].add(source)

            # Premium / tier proxy (customer_tier column optional — use rating/sentiment)
            if (rating and rating <= 3) or sentiment < -0.5:
                c["premium_count"] += 1

            if text and len(c["sample_texts"]) < 5:
                c["sample_texts"].append(text)
                c["evidence"].append({
                    "text": text,
                    "source": source,
                    "sentiment": sentiment_label,
                    "sentiment_score": sentiment,
                    "severity": c_dict.get("severity") or 3,
                    "rating": rating,
                })

    business_id = None
    try:
        from services.business_linkage import get_session_business_id
        business_id = get_session_business_id(db, session_id)
    except Exception:
        business_id = None

    inserts = []
    for issue_key, c in clusters.items():
        avg_sev = sum(c["severities"]) / len(c["severities"])
        avg_conf = sum(c["confidences"]) / len(c["confidences"])
        avg_sent = sum(c["sentiments"]) / max(len(c["sentiments"]), 1)

        row = {
            "session_id":         session_id,
            "issue_key":          issue_key,
            "category":           c["category"],
            "business_area":      c["business_area"],
            "description":        c["description"],
            "review_count":       len(c["severities"]),
            "avg_severity":       round(avg_sev, 2),
            "avg_confidence":     round(avg_conf * 100, 2),  # store as 0-100 for UI
            "avg_sentiment":      round(avg_sent, 4),
            "premium_user_count": c["premium_count"],
            "platforms":          list(c["platforms"]),
            "sample_reviews":     c["sample_texts"][:5],
        }
        if business_id:
            row["business_id"] = business_id
        inserts.append(row)

    if inserts:
        db.table("issue_clusters").insert(inserts).execute()
    return {"clusters": len(inserts)}
