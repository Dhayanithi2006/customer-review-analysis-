import asyncio
import time
from ai.config import RATE_LIMIT_RPM, RATE_LIMIT_CONCURRENCY
from core.logging import get_logger

logger = get_logger("ai.rate_limiter")


class AsyncRateLimiter:
    """
    Async Rate Limiter & Token Bucket for Gemini Flash API.
    Prevents HTTP 429 Quota Exceeded errors.
    """

    def __init__(self, rpm: int = RATE_LIMIT_RPM, concurrency: int = RATE_LIMIT_CONCURRENCY):
        self.min_interval = 60.0 / float(rpm)
        self.semaphore = asyncio.Semaphore(concurrency)
        self.last_call = 0.0
        self._lock = asyncio.Lock()

    async def acquire(self):
        """Acquires concurrency slot and enforces inter-request delay."""
        await self.semaphore.acquire()
        async with self._lock:
            elapsed = time.time() - self.last_call
            wait_time = self.min_interval - elapsed
            if wait_time > 0:
                await asyncio.sleep(wait_time)
            self.last_call = time.time()

    def release(self):
        """Releases concurrency slot."""
        self.semaphore.release()


# Global rate limiter instance
rate_limiter = AsyncRateLimiter()
