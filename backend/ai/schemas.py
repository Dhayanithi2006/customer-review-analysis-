from typing import List, Optional, Literal, Union
from pydantic import BaseModel, Field, field_validator
from services.category_taxonomy import (
    normalize_category,
    normalize_confidence,
    normalize_issue_key,
    normalize_severity,
)

# ── 1. Categorization Schema (Phase 3) ────────────────────────────────────────

class CategorizationItem(BaseModel):
    review_index: Optional[int] = None
    review_id: Optional[str] = None
    issue_key: str
    category: str
    severity: int = Field(ge=1, le=5)
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence 0-1")
    summary: str
    business_area: str = "Other"

    @field_validator("category", mode="before")
    @classmethod
    def _cat(cls, v):
        canon = normalize_category(v)
        if not canon:
            raise ValueError(f"invalid category {v}")
        return canon

    @field_validator("issue_key", mode="before")
    @classmethod
    def _key(cls, v):
        return normalize_issue_key(v)

    @field_validator("severity", mode="before")
    @classmethod
    def _sev(cls, v):
        return normalize_severity(v)

    @field_validator("confidence", mode="before")
    @classmethod
    def _conf(cls, v):
        return normalize_confidence(v)

class CategorizationBatchResult(BaseModel):
    items: List[CategorizationItem]


# ── 2. Executive Summary Schema ───────────────────────────────────────────────

class ExecutiveSummarySchema(BaseModel):
    executive_summary: str = Field(description="3 paragraph narrative")
    headline_insights: List[str] = Field(min_length=1, max_length=5)
    ai_recommendation: str = Field(description="Single recommended action")


# ── 3. Roadmap & Sprint Schema ────────────────────────────────────────────────

class RoadmapWeekItem(BaseModel):
    week: int = Field(ge=1, le=6)
    theme: str
    issues: List[str]
    effort: Literal["Quick Win", "Medium", "Large"]
    rationale: str

class SprintStoryItem(BaseModel):
    id: Optional[str] = None
    title: Optional[str] = None
    user_story: Optional[str] = None
    acceptance_criteria: Optional[List[str]] = None
    effort: Optional[str] = None
    story_points: Optional[int] = None
    priority: Optional[str] = None
    linked_issue: Optional[str] = None

class SprintPlanItem(BaseModel):
    name: str = Field(default="Sprint 1")
    owner: str = Field(default="Engineering Team")
    duration_weeks: int = Field(default=2)
    total_story_points: Optional[int] = Field(default=13)
    stories: List[SprintStoryItem] = Field(default_factory=list)

class RoadmapSchema(BaseModel):
    roadmap: List[RoadmapWeekItem]
    sprint: SprintPlanItem


# ── 4. Weekly Product Review Schema ───────────────────────────────────────────

class WeeklyProductReviewSchema(BaseModel):
    reply: str = Field(description="2-4 sentence grounded answer")
    referenced_issues: List[str] = Field(default_factory=list)
