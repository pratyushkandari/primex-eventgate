"""Publisher port interface for EventGate enforcement."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Protocol


@dataclass(frozen=True)
class EventPublishResult:
    """Outcome of an event publishing operation."""

    event_id: str
    published: bool
    event_bridge_event_id: str | None = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))


class IEventPublisher(Protocol):
    """Port interface for publishing approved events to downstream transport."""

    def publish(
        self,
        event_id: str,
        event_type: str,
        version: int,
        decision: str,
        analysis_id: str,
        request_id: str | None,
        payload: dict[str, Any],
    ) -> EventPublishResult:
        """Publish an approved event to the event transport.

        Raises:
            EventPublishFailedError: If publication fails.
        """
        ...
