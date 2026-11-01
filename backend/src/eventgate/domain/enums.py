"""Domain enumerations for EventGate compatibility analysis."""

from __future__ import annotations

from enum import StrEnum

from eventgate.domain.errors import InvalidAnalysisRequestError


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


class Environment(StrEnum):
    """Release target environment. Selects which row of the release policy applies."""

    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"

    @classmethod
    def parse(cls, value: str | None) -> Environment:
        """Normalize a user-supplied environment name; None means production.

        Raises InvalidAnalysisRequestError for names outside the three supported
        environments, so a typo can never silently fall through to another policy row.
        """
        if value is None:
            return cls.PRODUCTION
        try:
            return cls(value.strip().lower())
        except ValueError:
            allowed = ", ".join(e.value for e in cls)
            raise InvalidAnalysisRequestError(
                f"Unknown environment '{value}'. Expected one of: {allowed}."
            ) from None


# Field types an event or consumer contract may declare (top-level JSON types).
SUPPORTED_FIELD_TYPES = frozenset(
    {"string", "number", "integer", "boolean", "object", "array", "null"}
)
