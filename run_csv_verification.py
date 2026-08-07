import sys
import os
import json
import pandas as pd
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).parent / "backend" / ".env"
load_dotenv(dotenv_path=env_path)
load_dotenv()

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from services.cleaning_engine import CleaningEngine
from services.vader_service import VaderService
from services.issue_clustering import IssueClusteringEngine
from services.priority_engine import DecisionIntelligenceEngine
from ai.engine import AILayerEngine
from adapters.csv_adapter import CSVAdapter

async def main():
    print("=" * 60)
    print("VERIFYING sample_reviews.csv WITH AI LAYER & ENGINE")
    print("=" * 60)

    # Load CSV
    csv_bytes = open("sample_reviews.csv", "rb").read()
    csv_adapter = CSVAdapter()
    reviews, detected = await csv_adapter.parse_bytes(csv_bytes, session_id="test_session")
    print(f"\n[1] Ingestion: Parsed {len(reviews)} reviews. Detected: {detected}")

    # Cleaning
    cleaner = CleaningEngine()
    cleaned = cleaner.clean(reviews)
    print(f"[2] Cleaning: {len(cleaned)} cleaned reviews")

    # VADER
    vader = VaderService()
    for cr in cleaned:
        if not cr.is_spam and not cr.is_duplicate:
            matching_ur = next((r for r in reviews if r.id == cr.review_id), None)
            rating = matching_ur.rating if matching_ur else None
            score, label, routed = vader.analyze_sentiment(cr.cleaned_text, rating=rating)
            cr.sentiment_score = score
            cr.sentiment_label = label
            cr.routed_to_llm = routed

    llm_inputs = [c for c in cleaned if c.routed_to_llm]
    print(f"[3] VADER Filtering: {len(llm_inputs)} actionable reviews routed to Gemini Flash")

    # AI Layer Batch Categorization
    ai_engine = AILayerEngine()
    cats, conf = await ai_engine.batch_categorization("test_session", llm_inputs)
    print(f"[4] Gemini Categorization: Categorized {len(cats)} items (Batch Mean Confidence: {conf}%)")
    for item in cats[:3]:
        print(f"    * {item.issue_key} | {item.category} | Severity: {item.severity} | Conf: {item.confidence}%")

    # Clustering & Priority Formula
    clusterer = IssueClusteringEngine()
    clusters = clusterer.cluster("test_session", cats, cleaned)
    
    p_engine = DecisionIntelligenceEngine()
    p_result = p_engine.calculate_priorities("test_session", clusters, total_reviews=len(reviews))
    print(f"[5] Priority Engine: Ranked {len(p_result.ranked_clusters)} clusters (Total Risk: INR {p_result.total_revenue_at_risk})")
    for c in p_result.ranked_clusters[:3]:
        print(f"    #{c.priority_rank} {c.issue_key} (Score: {c.priority_score}, Risk: INR {c.revenue_at_risk})")

    # AI Executive Summary
    summary_data = {
        "total_reviews": len(reviews),
        "actionable_reviews": len(llm_inputs),
        "top_issues": [c.model_dump() for c in p_result.ranked_clusters[:3]]
    }
    exec_summary = await ai_engine.generate_executive_summary("test_session", summary_data)
    print(f"\n[6] AI Executive Summary Recommendation:\n    \"{exec_summary.ai_recommendation}\"")

    # AI Roadmap & Sprint
    priority_issues = [c.model_dump() for c in p_result.ranked_clusters[:5]]
    roadmap = await ai_engine.generate_roadmap("test_session", "2_5", priority_issues)
    print(f"[7] AI Roadmap & Sprint: {len(roadmap.roadmap)} Roadmap Weeks, {len(roadmap.sprint.stories)} Jira Stories")
    for s in roadmap.sprint.stories[:2]:
        print(f"    [{s.id}] {s.title} ({s.story_points} pts)")

    # AI Meeting Q&A
    meeting = await ai_engine.conduct_weekly_product_review(
        "test_session", "What issue should my team fix first?", len(reviews), summary_data
    )
    print(f"\n[8] AI Product Review Meeting Reply:\n    \"{meeting.reply}\"")
    print(f"    Referenced Issues: {meeting.referenced_issues}")

    print("\n" + "=" * 60)
    print("SUCCESS: sample_reviews.csv PROCESSED PERFECTLY!")
    print("=" * 60)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
