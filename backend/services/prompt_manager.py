import pathlib
from typing import Dict, Any
from core.exceptions import RoadmapAIException
from core.logging import get_logger

logger = get_logger("services.prompt_manager")

PROMPTS_DIR = pathlib.Path(__file__).parent.parent / "prompts"


class PromptManager:
    """
    Module 14 — Prompt Manager.
    Centralized loader and renderer for LLM prompts with template validation.
    """

    def __init__(self):
        self._prompts_dir = PROMPTS_DIR

    def load_prompt(self, template_name: str) -> str:
        file_path = self._prompts_dir / f"{template_name}.txt"
        if not file_path.exists():
            raise RoadmapAIException(f"Prompt template '{template_name}' not found at {file_path}")
        return file_path.read_text(encoding="utf-8")

    def render_categorize_prompt(self, reviews_json: str, count: int) -> str:
        template = self.load_prompt("categorize")
        return template.format(count=count, reviews_json=reviews_json)

    def render_summary_prompt(self, data_json: str) -> str:
        template = self.load_prompt("summary")
        return template.format(data_json=data_json)
