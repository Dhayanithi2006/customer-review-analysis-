from typing import Tuple, Optional
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from domain.interfaces import IVaderService
from domain.enums import SentimentLabel
from core.logging import get_logger

logger = get_logger("services.vader")

FEATURE_REQUEST_KEYWORDS = [
    "wish", "would love", "missing", "if only", "need", "want",
    "please add", "should have", "could you add", "hope you add",
    "would be great", "looking forward", "feature request",
]


class VaderService(IVaderService):
    """
    Module 12 — Fast VADER Sentiment Filter.
    Scores polarity without AI overhead.
    Routes actionable reviews (Bugs, Feature Requests, Complaints) to Gemini.
    Filters out pure praise to keep LLM calls fast and cheap.
    """

    def __init__(self):
        self.analyzer = SentimentIntensityAnalyzer()

    def _has_feature_request_signals(self, text: str) -> bool:
        t = text.lower()
        return any(kw in t for kw in FEATURE_REQUEST_KEYWORDS)

    def analyze_sentiment(self, text: str, rating: Optional[int] = None) -> Tuple[float, SentimentLabel, bool]:
        scores = self.analyzer.polarity_scores(text)
        compound = float(scores["compound"])

        if compound > 0.35:
            label = SentimentLabel.POSITIVE
            # Route positive reviews to Gemini ONLY if they contain feature request signals
            routed = self._has_feature_request_signals(text)
        elif compound < -0.05:
            label = SentimentLabel.NEGATIVE
            routed = True
        else:
            label = SentimentLabel.NEUTRAL
            # Neutral reviews with low star rating (<= 3) are actionable
            routed = bool(rating and rating <= 3)

        return compound, label, routed
