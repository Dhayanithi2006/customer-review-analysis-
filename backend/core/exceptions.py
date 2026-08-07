"""
Custom Exception Hierarchy for RoadmapAI Backend Foundation.
Clean Architecture domain & infrastructure exceptions.
"""

class RoadmapAIException(Exception):
    """Base exception for all RoadmapAI domain errors."""
    def __init__(self, message: str, code: str = "INTERNAL_ERROR"):
        self.message = message
        self.code = code
        super().__init__(self.message)


class IngestionError(RoadmapAIException):
    """Raised when review ingestion fails from CSV, Google Play, or App Store."""
    def __init__(self, message: str, source: str):
        self.source = source
        super().__init__(f"[{source}] Ingestion failed: {message}", code="INGESTION_ERROR")


class ColumnDetectionError(IngestionError):
    """Raised when CSV column auto-detection fails."""
    def __init__(self, message: str, headers: list[str]):
        self.headers = headers
        super().__init__(f"CSV Column detection failed: {message}", source="CSV")


class CleaningError(RoadmapAIException):
    """Raised during data cleaning or spam detection processing."""
    def __init__(self, message: str):
        super().__init__(message, code="CLEANING_ERROR")


class GeminiAPIError(RoadmapAIException):
    """Raised when Gemini LLM invocation fails or exceeds retries."""
    def __init__(self, message: str, status_code: int = 500):
        self.status_code = status_code
        super().__init__(f"Gemini API Error: {message}", code="GEMINI_API_ERROR")


class JSONValidationError(RoadmapAIException):
    """Raised when LLM output fails schema validation."""
    def __init__(self, message: str, raw_output: str):
        self.raw_output = raw_output
        super().__init__(f"JSON Validation Error: {message}", code="JSON_VALIDATION_ERROR")


class ClusteringError(RoadmapAIException):
    """Raised when issue clustering fails."""
    def __init__(self, message: str):
        super().__init__(message, code="CLUSTERING_ERROR")


class PriorityEngineError(RoadmapAIException):
    """Raised when priority engine calculation fails."""
    def __init__(self, message: str):
        super().__init__(message, code="PRIORITY_ENGINE_ERROR")
