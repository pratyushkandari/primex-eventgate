"""API dependencies — constructs application services and handles request IDs."""

from __future__ import annotations

import uuid
from functools import lru_cache

from fastapi import Request

from eventgate.application.services.event_analysis_service import EventAnalysisService
from eventgate.config.settings import (
    STORAGE_BACKEND_DYNAMODB,
    get_aws_region,
    get_consumer_contracts_table_name,
    get_contracts_dir,
    get_event_contracts_table_name,
    get_storage_backend,
)
from eventgate.domain.compatibility import CompatibilityEngine
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
def _build_analysis_service(
    backend: str,
    contracts_dir_str: str,
    event_table: str,
    consumer_table: str,
    region: str,
) -> EventAnalysisService:
    """Instantiate and cache the analysis service for the configured storage backend."""
    engine = CompatibilityEngine()

    if backend == STORAGE_BACKEND_DYNAMODB:
        event_repo = DynamoEventContractRepository(
            table_name=event_table,
            region_name=region,
        )
        consumer_repo = DynamoConsumerContractRepository(
            table_name=consumer_table,
            region_name=region,
        )
    else:
        from pathlib import Path

        contracts_dir = Path(contracts_dir_str)
        event_repo = JsonEventContractRepository(contracts_dir)
        consumer_repo = JsonConsumerContractRepository(contracts_dir)

    return EventAnalysisService(event_repo, consumer_repo, engine)


def get_analysis_service() -> EventAnalysisService:
    """Create and return the analysis service with its configured dependencies."""
    return _build_analysis_service(
        backend=get_storage_backend(),
        contracts_dir_str=str(get_contracts_dir()),
        event_table=get_event_contracts_table_name(),
        consumer_table=get_consumer_contracts_table_name(),
        region=get_aws_region(),
    )


# Expose cache_clear on get_analysis_service for testing
get_analysis_service.cache_clear = _build_analysis_service.cache_clear  # type: ignore[attr-defined]


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
