from fastapi import APIRouter
from config import ENV, DEBUG

router = APIRouter(prefix="/health", tags=["health"])

@router.get("")
async def health_check():
    """System health check endpoint."""
    return {
        "status": "healthy",
        "service": "RoadmapAI Backend Foundation",
        "environment": ENV,
        "debug": DEBUG,
        "version": "2.0.0"
    }
