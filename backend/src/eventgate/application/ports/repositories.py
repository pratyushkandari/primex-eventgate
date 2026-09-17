"""Repository port interfaces for contract persistence."""

from __future__ import annotations

from typing import Protocol

from eventgate.domain.models import ConsumerContract, EventContract


class IEventContractRepository(Protocol):
    """Port interface for loading event contracts."""

    def get_event_contract(self, event_type: str, version: int) -> EventContract:
        """Load a specific version of an event contract."""
        ...

    def list_event_contracts(self, event_type: str) -> list[EventContract]:
        """Load all versions of an event contract."""
        ...


class IConsumerContractRepository(Protocol):
    """Port interface for loading consumer contracts."""

    def get_consumer(self, consumer_id: str) -> ConsumerContract:
        """Load a specific consumer contract."""
        ...

    def list_consumers(self, event_type: str) -> list[ConsumerContract]:
        """Load all consumers subscribed to an event type."""
        ...
