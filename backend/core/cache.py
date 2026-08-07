import time
from typing import Any, Optional
from config import CACHE_TTL_SECONDS
from core.logging import get_logger

logger = get_logger("core.cache")

class TTLCache:
    """
    In-Memory Async-safe TTL Cache Service for performance optimization.
    Stores pre-processed analysis results, rate-limiting tokens, or scrape results.
    """
    def __init__(self, default_ttl: int = CACHE_TTL_SECONDS):
        self._cache: dict[str, tuple[Any, float]] = {}
        self._default_ttl = default_ttl

    def get(self, key: str) -> Optional[Any]:
        if key not in self._cache:
            return None
        value, expiry = self._cache[key]
        if time.time() > expiry:
            logger.debug(f"Cache miss (expired): key={key}")
            del self._cache[key]
            return None
        logger.debug(f"Cache hit: key={key}")
        return value

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        ttl = ttl if ttl is not None else self._default_ttl
        expiry = time.time() + ttl
        self._cache[key] = (value, expiry)
        logger.debug(f"Cache set: key={key}, ttl={ttl}s")

    def delete(self, key: str) -> bool:
        if key in self._cache:
            del self._cache[key]
            return True
        return False

    def clear(self) -> None:
        self._cache.clear()
        logger.info("Cache cleared successfully")

# Global singleton cache instance
cache_service = TTLCache()
