import pathlib
from typing import Dict, Any
from ai.sanitization import sanitize_input_text
from core.exceptions import RoadmapAIException
from core.logging import get_logger

logger = get_logger("ai.prompt_manager")

PROMPTS_DIR = pathlib.Path(__file__).parent / "prompts"


class PromptManager:
    """
    Prompt Manager.
    Centralized loader, sanitizer, and renderer for LLM prompt templates.
    Enforces prompt injection defense and input sanitization before LLM invocation.
    """

    def __init__(self, prompts_dir: pathlib.Path = PROMPTS_DIR):
        self._dir = prompts_dir

    def get_template(self, name: str) -> str:
        path = self._dir / f"{name}.txt"
        if not path.exists():
            raise RoadmapAIException(f"Prompt template '{name}' not found at {path}")
        return path.read_text(encoding="utf-8")

    def render_categorization(self, reviews_json: str, count: int) -> str:
        template = self.get_template("categorization")
        return template.format(count=count, reviews_json=reviews_json)

    def render_executive_summary(self, data_json: str) -> str:
        template = self.get_template("executive_summary")
        return template.format(data_json=data_json)

    def render_roadmap(self, team_size: str, issues_json: str) -> str:
        template = self.get_template("roadmap")
        return template.format(team_size=team_size, issues_json=issues_json)

    def render_weekly_product_review(self, user_message: str, review_count: int, context_json: str) -> str:
        template = self.get_template("product_review_meeting")
        clean_message = sanitize_input_text(user_message)
        return template.format(
            user_message=clean_message,
            review_count=review_count,
            context_json=context_json
        )
