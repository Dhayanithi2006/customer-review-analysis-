import re
import json
from typing import Type, TypeVar, Tuple, List, Any
from pydantic import BaseModel, ValidationError
from ai.schemas import (
    CategorizationItem, CategorizationBatchResult,
    ExecutiveSummarySchema, RoadmapSchema, WeeklyProductReviewSchema
)
from core.exceptions import JSONValidationError
from core.logging import get_logger

logger = get_logger("ai.parser")

T = TypeVar("T", bound=BaseModel)


class ResponseParser:
    """
    Response Parser & Confidence Extraction.
    - Strips markdown code fences
    - Performs strict JSON Schema Validation using Pydantic
    - Extracts confidence scores for categorized outputs
    """

    @staticmethod
    def strip_markdown(raw_output: str) -> str:
        """Removes markdown code block formatting ```json ... ``` from LLM response."""
        if not raw_output:
            return ""
        cleaned = re.sub(r"```(?:json)?\s*", "", raw_output).strip().rstrip("`").strip()
        for i, ch in enumerate(cleaned):
            if ch in ("{", "["):
                return cleaned[i:]
        return cleaned

    def parse_and_validate(self, raw_output: str, schema_cls: Type[T]) -> T:
        """Parses raw text into JSON and validates against Pydantic schema."""
        cleaned_json = self.strip_markdown(raw_output)
        if not cleaned_json:
            raise JSONValidationError("LLM response was empty", raw_output=raw_output)

        try:
            parsed_dict = json.loads(cleaned_json)
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}. Raw snippet: {cleaned_json[:200]}")
            raise JSONValidationError(f"Invalid JSON syntax: {e}", raw_output=raw_output)

        try:
            return schema_cls.model_validate(parsed_dict)
        except ValidationError as ve:
            logger.error(f"Pydantic schema validation error for {schema_cls.__name__}: {ve}")
            raise JSONValidationError(f"JSON Schema Validation failed: {ve}", raw_output=raw_output)

    def parse_categorization_list(self, raw_output: str) -> Tuple[List[CategorizationItem], float]:
        """
        Parses categorization batch response.
        Extracts individual confidence scores and calculates mean batch confidence.
        """
        cleaned_json = self.strip_markdown(raw_output)
        try:
            parsed_list = json.loads(cleaned_json)
        except json.JSONDecodeError as e:
            raise JSONValidationError(f"Invalid JSON syntax in categorization: {e}", raw_output=raw_output)

        if not isinstance(parsed_list, list):
            raise JSONValidationError("Expected JSON array for categorization", raw_output=raw_output)

        valid_items: List[CategorizationItem] = []
        confidences: List[int] = []

        for item in parsed_list:
            try:
                cat_item = CategorizationItem.model_validate(item)
                valid_items.append(cat_item)
                confidences.append(cat_item.confidence)
            except ValidationError as ve:
                logger.warning(f"Skipping malformed categorization item: {ve}")
                continue

        mean_confidence = sum(confidences) / max(len(confidences), 1) if confidences else 0.0
        logger.info(f"Parsed {len(valid_items)} categorizations with mean confidence {mean_confidence:.1f}%")
        return valid_items, round(mean_confidence, 2)
