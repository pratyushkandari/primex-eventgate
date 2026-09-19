"""Contract catalog application service.

Coordinates loading and aggregating event contracts, versions, and consumer
dependency metadata across repositories.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from eventgate.application.ports.repositories import (
    IConsumerContractRepository,
    IEventContractRepository,
)
from eventgate.domain.errors import ContractNotFoundError, InvalidAnalysisRequestError
from eventgate.domain.models import ConsumerContract, EventContract

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EventCatalogSummary:
    """Summary of an event type in the catalog."""

    event_type: str
    version_count: int
    versions: list[int]
    latest_version: int
    consumer_count: int


@dataclass(frozen=True)
class EventDetail:
    """Complete detail of an event type including all versions and subscribed consumers."""

    event_type: str
    version_count: int
    versions: list[int]
    latest_version: int
    contracts: list[EventContract]
    consumers: list[ConsumerContract]


@dataclass(frozen=True)
class ConsumerSummary:
    """Summary of a consumer in the catalog."""

    consumer_id: str
    event_type: str
    expected_fields_count: int


class ContractCatalogService:
    """Service providing event catalog and consumer contract exploration."""

    def __init__(
        self,
        event_repo: IEventContractRepository,
        consumer_repo: IConsumerContractRepository,
    ):
        self._event_repo = event_repo
        self._consumer_repo = consumer_repo

    def get_event_catalog(self) -> list[EventCatalogSummary]:
        """Return catalog of all available event types with version and consumer counts."""
        event_types = self._event_repo.list_event_types()
        catalog: list[EventCatalogSummary] = []

        for et in event_types:
            try:
                versions = self._event_repo.get_event_versions(et)
                consumers = self._consumer_repo.list_consumers(et)
                if versions:
                    latest = max(versions)
                    catalog.append(
                        EventCatalogSummary(
                            event_type=et,
                            version_count=len(versions),
                            versions=versions,
                            latest_version=latest,
                            consumer_count=len(consumers),
                        )
                    )
            except Exception as exc:
                logger.warning("Could not load catalog info for event type %s: %s", et, exc)

        catalog.sort(key=lambda c: c.event_type)
        return catalog

    def get_event_detail(self, event_type: str) -> EventDetail:
        """Return all versions, schemas, and consumers for a specific event type."""
        if not event_type or not event_type.strip():
            raise InvalidAnalysisRequestError("Event type must not be empty.")

        contracts = self._event_repo.list_event_contracts(event_type)
        if not contracts:
            raise ContractNotFoundError(f"No contracts found for event type '{event_type}'.")

        versions = [c.version for c in contracts]
        latest = max(versions)
        consumers = self._consumer_repo.list_consumers(event_type)

        return EventDetail(
            event_type=event_type,
            version_count=len(versions),
            versions=versions,
            latest_version=latest,
            contracts=contracts,
            consumers=consumers,
        )

    def get_consumer_catalog(self) -> list[ConsumerSummary]:
        """Return all registered downstream consumers and their subscribed events."""
        consumers = self._consumer_repo.list_all_consumers()
        catalog = [
            ConsumerSummary(
                consumer_id=c.consumer_id,
                event_type=c.event_type,
                expected_fields_count=len(c.expected_fields),
            )
            for c in consumers
        ]
        catalog.sort(key=lambda c: c.consumer_id)
        return catalog

    def get_consumer_detail(self, consumer_id: str) -> ConsumerContract:
        """Return full contract detail for a specific downstream consumer."""
        if not consumer_id or not consumer_id.strip():
            raise InvalidAnalysisRequestError("Consumer ID must not be empty.")
        return self._consumer_repo.get_consumer(consumer_id)
