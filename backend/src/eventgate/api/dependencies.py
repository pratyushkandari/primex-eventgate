"""API dependencies — constructs application services and handles request IDs."""

from __future__ import annotations

import uuid
from functools import lru_cache

from fastapi import Request

from eventgate.application.services.event_analysis_service import EventAnalysisService
from eventgate.config.settings import get_contracts_dir
from eventgate.domain.compatibility import CompatibilityEngine
from eventgate.infrastructure.repositories.consumer_contract_repository import (
    JsonConsumerContractRepository,
)
from eventgate.infrastructure.repositories.event_contract_repository import (
    JsonEventContractRepository,
)


@lru_cache(maxsize=1)
def get_analysis_service() -> EventAnalysisService:
    """Create and cache the analysis service with its dependencies."""
    contracts_dir = get_contracts_dir()
    event_repo = JsonEventContractRepository(contracts_dir)
    consumer_repo = JsonConsumerContractRepository(contracts_dir)
    engine = CompatibilityEngine()
    return EventAnalysisService(event_repo, consumer_repo, engine)


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
