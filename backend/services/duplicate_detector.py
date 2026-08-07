import hashlib
from difflib import SequenceMatcher
from typing import List, Tuple
from config import FUZZY_DUPLICATE_THRESHOLD
from core.logging import get_logger

logger = get_logger("services.duplicate_detector")


class DuplicateDetector:
    """
    Module 9 — Duplicate Detection.
    Two-stage exact (MD5 hash) and soft (Levenshtein similarity) duplicate detector.
    Zero AI cost.
    """

    def compute_hash(self, text: str) -> str:
        """Returns MD5 hash of lowercased, whitespace-collapsed text."""
        normalised = " ".join(text.lower().split())
        return hashlib.md5(normalised.encode("utf-8")).hexdigest()

    def is_fuzzy_duplicate(self, text_a: str, text_b: str, threshold: float = FUZZY_DUPLICATE_THRESHOLD) -> bool:
        """Calculates Levenshtein similarity ratio between two review texts."""
        ratio = SequenceMatcher(None, text_a.lower(), text_b.lower()).ratio()
        return ratio >= threshold

    def filter_duplicates(self, texts: List[str]) -> Tuple[List[bool], int]:
        """
        Processes a list of review texts and returns a list of booleans (True = duplicate).
        Maintains order, flags subsequent occurrences as duplicates.
        """
        is_dup_flags = [False] * len(texts)
        seen_hashes: dict[str, int] = {}
        seen_texts: List[str] = []
        dup_count = 0

        for i, raw_text in enumerate(texts):
            h = self.compute_hash(raw_text)
            
            # Stage 1: Exact MD5 Hash Match
            if h in seen_hashes:
                is_dup_flags[i] = True
                dup_count += 1
                continue

            # Stage 2: Fuzzy Similarity Match against last 500 reviews
            norm_text = raw_text.lower().strip()
            is_fuzzy_dup = False
            for prev_text in seen_texts[-500:]:
                if self.is_fuzzy_duplicate(norm_text, prev_text):
                    is_fuzzy_dup = True
                    break

            if is_fuzzy_dup:
                is_dup_flags[i] = True
                dup_count += 1
            else:
                seen_hashes[h] = i
                seen_texts.append(norm_text)

        logger.info(f"Duplicate detection completed: found {dup_count} duplicates out of {len(texts)} reviews")
        return is_dup_flags, dup_count
