from typing import List, Optional, Literal
from pydantic import BaseModel, Field

# ── 1. Categorization Schema ──────────────────────────────────────────────────

class CategorizationItem(BaseModel):
    review_index: int
    issue_key: str = Field(pattern=r"^[A-Z][A-Z0-9_]{1,49}$")
    category: Literal[
        "Bug", "Performance", "UX", "Pricing", "Feature Request",
        "Onboarding", "Customer Support", "Data & Privacy", "Integration", "Praise"
    ]
    severity: int = Field(ge=1, le=10)
    confidence: int = Field(ge=0, le=100, description="Extracted confidence score")
    summary: str
    business_area: Literal[
        "Checkout", "Auth", "Core Feature", "UI", "Billing", "API", "Other"
    ]

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
