"""Publish endpoint — POST /api/v1/events/publish.

Validates the proposed event payload, executes consumer impact analysis,
and publishes the event to downstream transport if and only if the decision is ALLOW.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel, Field

from eventgate.api.dependencies import get_publish_service, get_request_id
from eventgate.api.routes.analysis import AnalysisResponse, _to_response
from eventgate.application.services.event_publish_service import EventPublishService
from eventgate.domain.enums import Decision

router = APIRouter(prefix="/api/v1")


class PublishRequest(BaseModel):
    """Request body for event publication evaluation."""

    model_config = {"populate_by_name": True}

    event_type: str = Field(..., alias="eventType", min_length=1, description="Event type name")
    current_version: int = Field(
        ..., alias="currentVersion", ge=1, description="Current event version"
    )
    proposed_version: int = Field(
        ..., alias="proposedVersion", ge=1, description="Proposed event version"
    )
    payload: dict[str, Any] = Field(
        ..., description="Event payload conforming to the proposed version contract"
    )


class PublishResponse(BaseModel):
    """Response returned after gated publication evaluation."""

    model_config = {"populate_by_name": True}

    event_id: str = Field(..., alias="eventId")
    published: bool
    decision: str
    severity: str
    event_bridge_event_id: str | None = Field(None, alias="eventBridgeEventId")
    analysis: AnalysisResponse


@router.post("/events/publish", response_model=PublishResponse)
def publish_event(
    req: PublishRequest,
    response: Response,
    service: EventPublishService = Depends(get_publish_service),
    request_id: str = Depends(get_request_id),
) -> PublishResponse:
    """Evaluate consumer impact and publish event only when decision is ALLOW."""
    result = service.publish_event(
        event_type=req.event_type,
        current_version=req.current_version,
        proposed_version=req.proposed_version,
        payload=req.payload,
        request_id=request_id,
    )

    response.headers["X-Request-ID"] = request_id

    # BLOCK and REVIEW are rejected with HTTP 409 Conflict
    if result.decision in (Decision.BLOCK, Decision.REVIEW):
        response.status_code = status.HTTP_409_CONFLICT
    else:
        response.status_code = status.HTTP_200_OK

    return PublishResponse(
        event_id=result.event_id,
        published=result.published,
        decision=result.decision.value,
        severity=result.severity.value,
        event_bridge_event_id=result.event_bridge_event_id,
        analysis=_to_response(result.analysis_result),
    )
