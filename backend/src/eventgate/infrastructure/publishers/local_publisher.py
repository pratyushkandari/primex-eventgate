"""Local in-memory event publisher for development and automated testing."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from eventgate.application.ports.publisher import EventPublishResult

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PublishedEventRecord:
    """In-memory record of an event published locally."""

    event_id: str
    event_type: str
    version: int
    decision: str
    analysis_id: str
    request_id: str | None
    payload: dict[str, Any]
    event_bridge_event_id: str
    timestamp: datetime


class LocalEventPublisher:
    """Local mock publisher that logs events and stores them in an in-memory list."""

    def __init__(self) -> None:
        self.published_events: list[PublishedEventRecord] = []

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
        """Record and log the published event locally without cloud transport."""
        synthetic_eb_id = f"local-eb-{uuid.uuid4().hex[:12]}"
        now = datetime.now(UTC)

        record = PublishedEventRecord(
            event_id=event_id,
            event_type=event_type,
            version=version,
            decision=decision,
            analysis_id=analysis_id,
            request_id=request_id,
            payload=payload,
            event_bridge_event_id=synthetic_eb_id,
            timestamp=now,
        )
        self.published_events.append(record)

        logger.info(
            "[LocalEventPublisher] Published event: event_id=%s event_type=%s "
            "version=%d decision=%s eb_id=%s",
            event_id,
            event_type,
            version,
            decision,
            synthetic_eb_id,
        )

        return EventPublishResult(
            event_id=event_id,
            published=True,
            event_bridge_event_id=synthetic_eb_id,
            timestamp=now,
        )

    def clear(self) -> None:
        """Clear the in-memory recorded events."""
        self.published_events.clear()
