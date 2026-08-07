from domain.interfaces import ILanguageDetector
from core.logging import get_logger

logger = get_logger("services.language_detector")

try:
    from langdetect import detect
    LANGDETECT_AVAILABLE = True
except ImportError:
    LANGDETECT_AVAILABLE = False


class LanguageDetector(ILanguageDetector):
    """
    Module 11 — Language Detection.
    Identifies language of customer review (ISO 639-1 code, e.g. 'en', 'es', 'fr').
    Defaults to 'en' if detection fails or text is too short.
    """

    def detect_language(self, text: str) -> str:
        t = text.strip()
        if len(t) < 8 or not LANGDETECT_AVAILABLE:
            return "en"

        try:
            detected = detect(t)
            return str(detected).lower()
        except Exception:
            return "en"
