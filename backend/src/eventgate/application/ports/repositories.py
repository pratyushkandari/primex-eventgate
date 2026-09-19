"""Repository port interfaces for contract persistence."""

from __future__ import annotations

from typing import Protocol

from eventgate.domain.history import ReleaseRecord
from eventgate.domain.models import ConsumerContract, EventContract


class IEventContractRepository(Protocol):
    """Port interface for loading event contracts."""

    def get_event_contract(self, event_type: str, version: int) -> EventContract:
        """Load a specific version of an event contract."""
        ...

    def list_event_contracts(self, event_type: str) -> list[EventContract]:
        """Load all versions of an event contract."""
        ...

    def list_event_types(self) -> list[str]:
        """Load all distinct registered event types."""
        ...

    def get_event_versions(self, event_type: str) -> list[int]:
        """Load all available version numbers for an event type."""
        ...


class IConsumerContractRepository(Protocol):
    """Port interface for loading consumer contracts."""

    def get_consumer(self, consumer_id: str) -> ConsumerContract:
        """Load a specific consumer contract."""
        ...

    def list_consumers(self, event_type: str) -> list[ConsumerContract]:
        """Load all consumers subscribed to an event type."""
        ...

    def list_all_consumers(self) -> list[ConsumerContract]:
        """Load all registered consumer contracts across all event types."""
        ...


class IReleaseReviewRepository(Protocol):
    """Port interface for persisting and querying release reviews."""

    def save_review(self, record: ReleaseRecord) -> ReleaseRecord:
        """Persist or update a release review record."""
        ...

    def get_review(self, record_id: str) -> ReleaseRecord:
        """Load a single release review record by ID."""
        ...

    def list_reviews(
        self, event_type: str | None = None, limit: int = 50
    ) -> list[ReleaseRecord]:
        """Load recent release reviews, optionally filtered by event type."""
        ...
