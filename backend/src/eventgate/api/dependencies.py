"""Composition root: builds repositories, publishers and services from settings.

The factories are plain functions so both FastAPI (as dependencies) and the CLI
can call them. Adapters are cached per configuration, so a Lambda container
reuses its boto3 clients and loaded contracts across invocations; tests reset
the caches with ``cache_clear`` after changing environment variables.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from fastapi import Depends

from eventgate.application.ports.publisher import IEventPublisher
from eventgate.application.ports.repositories import (
    IConsumerContractRepository,
    IEventContractRepository,
    IReleaseReviewRepository,
)
from eventgate.application.services.contract_catalog_service import ContractCatalogService
from eventgate.application.services.event_analysis_service import EventAnalysisService
from eventgate.application.services.event_publish_service import EventPublishService
from eventgate.application.services.release_history_service import ReleaseHistoryService
from eventgate.config.settings import (
    PUBLISHER_BACKEND_EVENTBRIDGE,
    STORAGE_BACKEND_DYNAMODB,
    get_aws_region,
    get_consumer_contracts_table_name,
    get_contracts_dir,
    get_event_contracts_table_name,
    get_event_publisher_backend,
    get_eventbridge_bus_name,
    get_history_file,
    get_release_history_table_name,
    get_storage_backend,
)
from eventgate.domain.compatibility import CompatibilityEngine
from eventgate.domain.policy import get_policy_engine
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
from eventgate.infrastructure.repositories.dynamo_release_review_repository import (
    DynamoReleaseReviewRepository,
)
from eventgate.infrastructure.repositories.event_contract_repository import (
    JsonEventContractRepository,
)
from eventgate.infrastructure.repositories.release_review_repository import (
    JsonReleaseReviewRepository,
)


@lru_cache(maxsize=4)
def _build_event_repo(
    backend: str, contracts_dir: str, event_table: str, region: str
) -> IEventContractRepository:
    if backend == STORAGE_BACKEND_DYNAMODB:
        return DynamoEventContractRepository(table_name=event_table, region_name=region)
    return JsonEventContractRepository(Path(contracts_dir))


@lru_cache(maxsize=4)
def _build_consumer_repo(
    backend: str, contracts_dir: str, consumer_table: str, region: str
) -> IConsumerContractRepository:
    if backend == STORAGE_BACKEND_DYNAMODB:
        return DynamoConsumerContractRepository(table_name=consumer_table, region_name=region)
    return JsonConsumerContractRepository(Path(contracts_dir))


@lru_cache(maxsize=4)
def _build_history_repo(
    backend: str, history_file: str, history_table: str, region: str
) -> IReleaseReviewRepository:
    if backend == STORAGE_BACKEND_DYNAMODB:
        # History has no scan-free way to enumerate event types, so it borrows
        # the event contract catalog for unfiltered listings.
        return DynamoReleaseReviewRepository(
            table_name=history_table,
            region_name=region,
            event_types_provider=lambda: get_event_repo().list_event_types(),
        )
    return JsonReleaseReviewRepository(Path(history_file))


@lru_cache(maxsize=4)
def _build_analysis_service(
    backend: str, contracts_dir: str, event_table: str, consumer_table: str, region: str
) -> EventAnalysisService:
    return EventAnalysisService(
        _build_event_repo(backend, contracts_dir, event_table, region),
        _build_consumer_repo(backend, contracts_dir, consumer_table, region),
        CompatibilityEngine(),
        policy_engine=get_policy_engine(),
    )


@lru_cache(maxsize=4)
def _build_publisher(publisher_backend: str, bus_name: str, region: str) -> IEventPublisher:
    if publisher_backend == PUBLISHER_BACKEND_EVENTBRIDGE:
        return EventBridgeEventPublisher(bus_name=bus_name, region_name=region)
    return LocalEventPublisher()


def get_event_repo() -> IEventContractRepository:
    """Return the configured event contract repository."""
    return _build_event_repo(
        get_storage_backend(),
        str(get_contracts_dir()),
        get_event_contracts_table_name(),
        get_aws_region(),
    )


def get_consumer_repo() -> IConsumerContractRepository:
    """Return the configured consumer contract repository."""
    return _build_consumer_repo(
        get_storage_backend(),
        str(get_contracts_dir()),
        get_consumer_contracts_table_name(),
        get_aws_region(),
    )


def get_history_repo() -> IReleaseReviewRepository:
    """Return the configured release history repository."""
    return _build_history_repo(
        get_storage_backend(),
        str(get_history_file()),
        get_release_history_table_name(),
        get_aws_region(),
    )


def get_analysis_service() -> EventAnalysisService:
    """Return the analysis service wired to the configured repositories and policy engine."""
    return _build_analysis_service(
        get_storage_backend(),
        str(get_contracts_dir()),
        get_event_contracts_table_name(),
        get_consumer_contracts_table_name(),
        get_aws_region(),
    )


def get_event_publisher() -> IEventPublisher:
    """Return the configured event publisher."""
    return _build_publisher(
        get_event_publisher_backend(), get_eventbridge_bus_name(), get_aws_region()
    )


def get_history_service() -> ReleaseHistoryService:
    """Return the release history service."""
    return ReleaseHistoryService(review_repo=get_history_repo())


def get_catalog_service() -> ContractCatalogService:
    """Return the contract catalog service."""
    return ContractCatalogService(event_repo=get_event_repo(), consumer_repo=get_consumer_repo())


def get_publish_service(
    publisher: IEventPublisher = Depends(get_event_publisher),
) -> EventPublishService:
    """Return the gated publish service; the publisher is a dependency so tests can swap it."""
    return EventPublishService(
        event_repo=get_event_repo(),
        analysis_service=get_analysis_service(),
        publisher=publisher,
        history_service=get_history_service(),
    )


def clear_caches() -> None:
    """Drop cached adapters so the next call re-reads configuration."""
    for factory in (
        _build_event_repo,
        _build_consumer_repo,
        _build_history_repo,
        _build_analysis_service,
        _build_publisher,
    ):
        factory.cache_clear()


# Kept for tests that clear a single factory after changing env vars.
get_analysis_service.cache_clear = _build_analysis_service.cache_clear  # type: ignore[attr-defined]
get_event_repo.cache_clear = _build_event_repo.cache_clear  # type: ignore[attr-defined]
get_consumer_repo.cache_clear = _build_consumer_repo.cache_clear  # type: ignore[attr-defined]
get_event_publisher.cache_clear = _build_publisher.cache_clear  # type: ignore[attr-defined]
get_history_repo.cache_clear = _build_history_repo.cache_clear  # type: ignore[attr-defined]
