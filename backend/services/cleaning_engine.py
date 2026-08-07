import re
from typing import List
from domain.interfaces import ICleaningEngine
from domain.schemas import UnifiedReview, CleanedReview
from services.spam_detector import SpamDetector
from services.duplicate_detector import DuplicateDetector
from services.language_detector import LanguageDetector
from core.logging import get_logger

logger = get_logger("services.cleaning_engine")

HTML_TAG_RE = re.compile(r"<[^>]+>")
EXCESS_WS_RE = re.compile(r"\s+")


class CleaningEngine(ICleaningEngine):
    """
    Module 8 — Cleaning Engine.
    Orchestrates:
      1. Text Normalization (strip HTML, collapse whitespace, preserve punctuation for VADER)
      2. Module 9 Duplicate Detection
      3. Module 10 Spam Detection
      4. Module 11 Language Detection
    """

    def __init__(self):
        self.spam_detector = SpamDetector()
        self.duplicate_detector = DuplicateDetector()
        self.language_detector = LanguageDetector()

    def normalize_text(self, text: str) -> str:
        t = HTML_TAG_RE.sub(" ", text)
        t = EXCESS_WS_RE.sub(" ", t)
        return t.strip()

    def clean(self, reviews: List[UnifiedReview]) -> List[CleanedReview]:
        logger.info(f"Starting cleaning engine pipeline for {len(reviews)} reviews")
        
        raw_texts = [r.raw_text for r in reviews]
        dup_flags, dup_count = self.duplicate_detector.filter_duplicates(raw_texts)

        cleaned_list: List[CleanedReview] = []
        spam_count = 0

        for i, r in enumerate(reviews):
            norm_text = self.normalize_text(r.raw_text)
            is_dup = dup_flags[i]
            is_spam = self.spam_detector.is_spam(norm_text)
            
            if is_spam:
                spam_count += 1

            lang = self.language_detector.detect_language(norm_text)

            cleaned_list.append(
                CleanedReview(
                    review_id=r.id,
                    session_id=r.session_id,
                    cleaned_text=norm_text,
                    is_duplicate=is_dup,
                    is_spam=is_spam,
                    language=lang,
                )
            )

        logger.info(
            f"Cleaning engine complete: {len(cleaned_list)} processed "
            f"({dup_count} duplicates, {spam_count} spam)"
        )
        return cleaned_list
