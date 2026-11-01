"""POST /api/v1/events/publish: gated publication.

Returns 200 with published=true when the decision is ALLOW and the transport
accepted the event, and 409 with the same body shape (published=false) when the
decision is BLOCK or REVIEW. Payload/contract mismatches are 422, a mismatched
analysisId is 400, and a transport failure is 503 EVENT_PUBLISH_FAILED.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel, Field

from eventgate.api.dependencies import get_publish_service
from eventgate.api.request_id import get_request_id
from eventgate.api.routes.analysis import AnalysisResponse, ChangeRequest, _to_response
from eventgate.application.services.event_publish_service import EventPublishService
from eventgate.domain.enums import Decision

router = APIRouter(prefix="/api/v1")


class PublishRequest(ChangeRequest):
    """Request body for gated publication."""

    payload: dict[str, Any] = Field(
        ..., description="Event payload conforming to the proposed version contract"
    )
    analysis_id: str | None = Field(
        None,
        alias="analysisId",
        description="ID from a prior /analyze call; the outcome is recorded on that record",
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


@router.post(
    "/events/publish",
    response_model=PublishResponse,
    response_model_by_alias=True,
    responses={409: {"model": PublishResponse, "description": "Decision was BLOCK or REVIEW"}},
)
def publish_event(
    req: PublishRequest,
    response: Response,
    service: EventPublishService = Depends(get_publish_service),
    request_id: str = Depends(get_request_id),
) -> PublishResponse:
    """Evaluate consumer impact and publish the event only when the decision is ALLOW."""
    result = service.publish_event(
        event_type=req.event_type,
        current_version=req.current_version,
        proposed_version=req.proposed_version,
        payload=req.payload,
        environment=req.environment.value,
        analysis_id=req.analysis_id,
        request_id=request_id,
    )

    if result.decision in (Decision.BLOCK, Decision.REVIEW):
        response.status_code = status.HTTP_409_CONFLICT

    return PublishResponse(
        event_id=result.event_id,
        published=result.published,
        decision=result.decision.value,
        severity=result.severity.value,
        event_bridge_event_id=result.event_bridge_event_id,
        analysis=_to_response(result.analysis_result),
    )
