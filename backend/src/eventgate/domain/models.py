"""Domain models for EventGate.

All models are plain dataclasses — independent of FastAPI, Pydantic, and AWS.
Pydantic is used only at API/configuration boundaries.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime

from eventgate.domain.enums import SUPPORTED_FIELD_TYPES, CompatibilityStatus, Decision, Severity
from eventgate.domain.errors import InvalidContractError

# ---------------------------------------------------------------------------
# Event contract models
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class EventField:
    """A single field within an event contract."""

    name: str
    type: str
    required: bool

    def __post_init__(self):
        if not self.name:
            raise InvalidContractError("Event field name must not be empty.")
        if self.type not in SUPPORTED_FIELD_TYPES:
            raise InvalidContractError(
                f"Unsupported field type '{self.type}' for field '{self.name}'. "
                f"Supported types: {sorted(SUPPORTED_FIELD_TYPES)}."
            )


@dataclass(frozen=True)
class EventContract:
    """A versioned event contract describing the fields published by a producer."""

    event_type: str
    version: int
    fields: dict[str, EventField]

    def __post_init__(self):
        if not self.event_type:
            raise InvalidContractError("Event type must not be empty.")
        if self.version < 1:
            raise InvalidContractError(
                f"Event version must be a positive integer, got {self.version}."
            )
        if not isinstance(self.fields, dict):
            raise InvalidContractError("Event fields must be a dictionary.")


# ---------------------------------------------------------------------------
# Consumer contract models
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ConsumerField:
    """A single field expected by a downstream consumer."""

    name: str
    type: str
    required: bool

    def __post_init__(self):
        if not self.name:
            raise InvalidContractError("Consumer field name must not be empty.")
        if self.type not in SUPPORTED_FIELD_TYPES:
            raise InvalidContractError(
                f"Unsupported field type '{self.type}' for consumer field '{self.name}'. "
                f"Supported types: {sorted(SUPPORTED_FIELD_TYPES)}."
            )


@dataclass(frozen=True)
class ConsumerContract:
    """Describes what a downstream consumer expects from a specific event type."""

    consumer_id: str
    event_type: str
    expected_fields: dict[str, ConsumerField]

    def __post_init__(self):
        if not self.consumer_id:
            raise InvalidContractError("Consumer ID must not be empty.")
        if not self.event_type:
            raise InvalidContractError("Consumer event type must not be empty.")
        if not isinstance(self.expected_fields, dict):
            raise InvalidContractError("Consumer expected fields must be a dictionary.")


# ---------------------------------------------------------------------------
# Change set models
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class TypeChange:
    """Records a field whose type changed between event versions."""

    field: str
    from_type: str
    to_type: str


@dataclass(frozen=True)
class RequirednessChange:
    """Records a field whose requiredness changed between event versions."""

    field: str
    from_required: bool
    to_required: bool


@dataclass(frozen=True)
class ChangeSet:
    """Structural differences between two event contract versions.

    This is purely an event-level diff. It does not contain consumer-specific
    compatibility information — that is the job of the CompatibilityEngine.
    """

    added_fields: list[str] = field(default_factory=list)
    removed_fields: list[str] = field(default_factory=list)
    type_changes: list[TypeChange] = field(default_factory=list)
    requiredness_changes: list[RequirednessChange] = field(default_factory=list)

    @property
    def has_changes(self) -> bool:
        return bool(
            self.added_fields
            or self.removed_fields
            or self.type_changes
            or self.requiredness_changes
        )


# ---------------------------------------------------------------------------
# Finding and analysis result
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Finding:
    """A single consumer-specific compatibility result.

    Each Finding answers: "Is this specific change safe for this specific consumer?"
    """

    consumer_id: str
    status: CompatibilityStatus
    rule_id: str
    field: str
    expected_type: str | None
    proposed_type: str | None
    severity: Severity
    reason: str


@dataclass(frozen=True)
class AnalysisResult:
    """The complete result of evaluating a proposed event change."""

    analysis_id: str
    event_type: str
    current_version: int
    proposed_version: int
    change_set: ChangeSet
    findings: list[Finding]
    decision: Decision
    severity: Severity
    summary: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))
    request_id: str | None = None
