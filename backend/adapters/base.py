from typing import List
from domain.interfaces import IReviewAdapter
from domain.schemas import UnifiedReview

class BaseReviewAdapter(IReviewAdapter):
    """Base class for all collection adapters with common logging & utility methods."""
    
    def __init__(self, source_name: str):
        self.source_name = source_name

    async def fetch_reviews(self, session_id: str, **kwargs) -> List[UnifiedReview]:
        raise NotImplementedError("Subclasses must implement fetch_reviews()")
