"""Domain enumerations for EventGate compatibility analysis."""

from enum import StrEnum


class CompatibilityStatus(StrEnum):
    """Per-consumer compatibility result for a proposed event change."""

    SAFE = "SAFE"
    RISK = "RISK"
    BREAK = "BREAK"


class Decision(StrEnum):
    """Aggregate decision across all consumer findings."""

    ALLOW = "ALLOW"
    REVIEW = "REVIEW"
    BLOCK = "BLOCK"


class Severity(StrEnum):
    """Severity level of the overall analysis result."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


# Supported field types for Phase 1 event/consumer contracts.
SUPPORTED_FIELD_TYPES = frozenset(
    {"string", "number", "integer", "boolean", "object", "array", "null"}
)
