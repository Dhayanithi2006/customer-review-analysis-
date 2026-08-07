from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from config import FRONTEND_URL, DEBUG
from core.exceptions import RoadmapAIException
from core.logging import get_logger
from api.v1 import health, ingest, analyze

logger = get_logger("main")

app = FastAPI(
    title="RoadmapAI — Backend Foundation",
    description="AI Product Intelligence Platform — Phase 2 Backend Foundation API",
    version="2.0.0",
    debug=DEBUG,
)

# CORS Middleware Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers import upload, pipeline, results, meeting, export, play_store, business
# Register API Routers
app.include_router(upload.router)
app.include_router(play_store.router)
app.include_router(pipeline.router)
app.include_router(results.router)
app.include_router(meeting.router)
app.include_router(export.router)
app.include_router(business.router)

app.include_router(health.router, prefix="/api/v1")
app.include_router(ingest.router, prefix="/api/v1")
app.include_router(analyze.router, prefix="/api/v1")

@app.get("/health")
def health_root():
    return {"status": "ok", "version": "2.0.0"}


# Global Exception Handlers
@app.exception_handler(RoadmapAIException)
async def roadmapai_exception_handler(request: Request, exc: RoadmapAIException):
    logger.error(f"Domain Error: {exc.code} - {exc.message}")
    return JSONResponse(
        status_code=400,
        content={
            "error": exc.code,
            "message": exc.message,
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_error",
            "message": str(exc)[:200],
        },
    )


@app.get("/")
async def root():
    return {
        "message": "RoadmapAI Phase 2 Backend Foundation API is running",
        "docs_url": "/docs",
        "health_check": "/api/v1/health",
    }
