"""API dependencies — constructs application services and handles request IDs."""

from __future__ import annotations

import uuid
from functools import lru_cache

from fastapi import Depends, Request

from eventgate.application.ports.publisher import IEventPublisher
from eventgate.application.ports.repositories import (
    IConsumerContractRepository,
    IEventContractRepository,
)
from eventgate.application.services.event_analysis_service import EventAnalysisService
from eventgate.application.services.event_publish_service import EventPublishService
from eventgate.config.settings import (
    PUBLISHER_BACKEND_EVENTBRIDGE,
    STORAGE_BACKEND_DYNAMODB,
    get_aws_region,
    get_consumer_contracts_table_name,
    get_contracts_dir,
    get_event_contracts_table_name,
    get_event_publisher_backend,
    get_eventbridge_bus_name,
    get_storage_backend,
)
from eventgate.domain.compatibility import CompatibilityEngine
from eventgate.infrastructure.publishers.eventbridge_publisher import EventBridgeEventPublisher
from eventgate.infrastructure.publishers.local_publisher import LocalEventPublisher
from eventgate.infrastructure.repositories.consumer_contract_repository import (
    JsonConsumerContractRepository,
)
from eventgate.infrastructure.repositories.dynamo_consumer_contract_repository import (
    DynamoConsumerContractRepository,
)
from eventgate.infrastructure.repositories.dynamo_event_contract_repository import (
    DynamoEventContractRepository,
)
from eventgate.infrastructure.repositories.event_contract_repository import (
    JsonEventContractRepository,
)


@lru_cache(maxsize=4)
def _build_event_repo(
    backend: str, contracts_dir_str: str, event_table: str, region: str
) -> IEventContractRepository:
    if backend == STORAGE_BACKEND_DYNAMODB:
        return DynamoEventContractRepository(table_name=event_table, region_name=region)
    from pathlib import Path

    return JsonEventContractRepository(Path(contracts_dir_str))


@lru_cache(maxsize=4)
def _build_consumer_repo(
    backend: str, contracts_dir_str: str, consumer_table: str, region: str
) -> IConsumerContractRepository:
    if backend == STORAGE_BACKEND_DYNAMODB:
        return DynamoConsumerContractRepository(table_name=consumer_table, region_name=region)
    from pathlib import Path

    return JsonConsumerContractRepository(Path(contracts_dir_str))


@lru_cache(maxsize=4)
def _build_analysis_service(
    backend: str,
    contracts_dir_str: str,
    event_table: str,
    consumer_table: str,
    region: str,
) -> EventAnalysisService:
    """Instantiate and cache the analysis service for the configured storage backend."""
    engine = CompatibilityEngine()
    event_repo = _build_event_repo(backend, contracts_dir_str, event_table, region)
    consumer_repo = _build_consumer_repo(backend, contracts_dir_str, consumer_table, region)
    return EventAnalysisService(event_repo, consumer_repo, engine)


@lru_cache(maxsize=4)
def _build_publisher(publisher_backend: str, bus_name: str, region: str) -> IEventPublisher:
    """Instantiate and cache the event publisher."""
    if publisher_backend == PUBLISHER_BACKEND_EVENTBRIDGE:
        return EventBridgeEventPublisher(bus_name=bus_name, region_name=region)
    return LocalEventPublisher()


def get_event_repo() -> IEventContractRepository:
    """Return the configured event contract repository."""
    return _build_event_repo(
        backend=get_storage_backend(),
        contracts_dir_str=str(get_contracts_dir()),
        event_table=get_event_contracts_table_name(),
        region=get_aws_region(),
    )


def get_analysis_service() -> EventAnalysisService:
    """Create and return the analysis service with its configured dependencies."""
    return _build_analysis_service(
        backend=get_storage_backend(),
        contracts_dir_str=str(get_contracts_dir()),
        event_table=get_event_contracts_table_name(),
        consumer_table=get_consumer_contracts_table_name(),
        region=get_aws_region(),
    )


def get_event_publisher() -> IEventPublisher:
    """Return the configured event publisher."""
    return _build_publisher(
        publisher_backend=get_event_publisher_backend(),
        bus_name=get_eventbridge_bus_name(),
        region=get_aws_region(),
    )


def get_publish_service(
    event_repo: IEventContractRepository = Depends(get_event_repo),
    analysis_service: EventAnalysisService = Depends(get_analysis_service),
    publisher: IEventPublisher = Depends(get_event_publisher),
) -> EventPublishService:
    """Create and return the event publish service with its configured dependencies."""
    return EventPublishService(
        event_repo=event_repo,
        analysis_service=analysis_service,
        publisher=publisher,
    )


# Expose cache_clear on factories for testing
get_analysis_service.cache_clear = _build_analysis_service.cache_clear  # type: ignore[attr-defined]
get_event_repo.cache_clear = _build_event_repo.cache_clear  # type: ignore[attr-defined]
get_event_publisher.cache_clear = _build_publisher.cache_clear  # type: ignore[attr-defined]


def get_request_id(request: Request) -> str:
    """Extract or generate a request ID.

    If the client sends X-Request-ID, use a sanitized version.
    Otherwise generate a new UUID.
    """
    client_id = request.headers.get("X-Request-ID", "")
    # Sanitize: keep only alphanumeric, hyphens, and underscores, max 128 chars.
    sanitized = "".join(c for c in client_id if c.isalnum() or c in "-_")[:128]
    request_id = sanitized if sanitized else str(uuid.uuid4())
    # Store on request state for error handlers.
    request.state.request_id = request_id
    return request_id
