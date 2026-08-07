from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import FRONTEND_URL
from routers import upload, pipeline, results, meeting, export

app = FastAPI(
    title="RoadmapAI API",
    description="AI Product Intelligence Platform — From Customer Voice to Product Decisions",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(pipeline.router)
app.include_router(results.router)
app.include_router(meeting.router)
app.include_router(export.router)


@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
