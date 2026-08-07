from abc import ABC, abstractmethod
from typing import List, Dict, Any, Tuple
from domain.schemas import UnifiedReview, CleanedReview, CategorizedReview, IssueCluster, PriorityResult

class IReviewAdapter(ABC):
    """Abstract interface for all review collection adapters (SOLID Open/Closed)."""
    
    @abstractmethod
    async def fetch_reviews(self, session_id: str, **kwargs) -> List[UnifiedReview]:
        """Fetch and map raw review source data into UnifiedReview schemas."""
        pass


class ICleaningEngine(ABC):
    """Abstract interface for text cleaning, deduplication, and spam detection."""
    
    @abstractmethod
    def clean(self, reviews: List[UnifiedReview]) -> List[CleanedReview]:
        """Execute cleaning pipeline: deduplication, spam filter, normalization."""
        pass


class ILanguageDetector(ABC):
    """Abstract interface for language detection."""
    
    @abstractmethod
    def detect_language(self, text: str) -> str:
        """Detect ISO language code for text."""
        pass


class IVaderService(ABC):
    """Abstract interface for VADER sentiment analysis & LLM routing."""
    
    @abstractmethod
    def analyze_sentiment(self, text: str, rating: int = None) -> Tuple[float, str, bool]:
        """Returns (compound_score, sentiment_label, routed_to_llm)."""
        pass


class IGeminiService(ABC):
    """Abstract interface for Gemini LLM batch analysis & JSON validation."""
    
    @abstractmethod
    async def categorize_batch(self, session_id: str, reviews: List[CleanedReview]) -> List[CategorizedReview]:
        """Batch categorizes reviews with Gemini LLM and returns validated Pydantic models."""
        pass


class IIssueClusteringEngine(ABC):
    """Abstract interface for grouping categorizations into issue clusters."""
    
    @abstractmethod
    def cluster(self, session_id: str, categorizations: List[CategorizedReview], cleaned_reviews: List[CleanedReview]) -> List[IssueCluster]:
        """Cluster categorized reviews into aggregated issue clusters."""
        pass


class IPriorityEngine(ABC):
    """Abstract interface for Decision Intelligence & Priority Formula calculations."""
    
    @abstractmethod
    def calculate_priorities(self, session_id: str, clusters: List[IssueCluster], total_reviews: int) -> PriorityResult:
        """Score and rank issue clusters using the transparent priority formula."""
        pass
