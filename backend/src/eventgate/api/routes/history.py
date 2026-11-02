"""Release history endpoints.

GET /api/v1/history                               newest records first, filterable by event type
GET /api/v1/history/{record_id}                   one record, by record ID or analysis ID
GET /api/v1/history/{record_id}/report?format=    the record rendered as Markdown or JSON
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from eventgate.api.dependencies import get_history_service
from eventgate.application.services.release_history_service import ReleaseHistoryService
from eventgate.domain.history import ReleaseRecord

router = APIRouter(prefix="/api/v1")


class ReleaseRecordResponse(BaseModel):
    """API response model for a persistent release review record."""

    model_config = {"populate_by_name": True}

    record_id: str = Field(..., alias="recordId")
    analysis_id: str = Field(..., alias="analysisId")
    event_type: str = Field(..., alias="eventType")
    current_version: int = Field(..., alias="currentVersion")
    proposed_version: int = Field(..., alias="proposedVersion")
    environment: str
    compatibility_result: str = Field(..., alias="compatibilityResult")
    severity: str
    policy_name: str = Field(..., alias="policyName")
    policy_reason: str = Field(..., alias="policyReason")
    decision: str
    affected_consumers: list[str] = Field(..., alias="affectedConsumers")
    findings_summary: list[dict[str, Any]] = Field(..., alias="findingsSummary")
    published: bool
    attempted_publish: bool = Field(False, alias="attemptedPublish")
    event_id: str | None = Field(None, alias="eventId")
    event_bridge_event_id: str | None = Field(None, alias="eventBridgeEventId")
    request_id: str | None = Field(None, alias="requestId")
    timestamp: datetime
    published_at: datetime | None = Field(None, alias="publishedAt")
    error: str | None = None


class ReportExportResponse(BaseModel):
    """API response containing exported report content."""

    model_config = {"populate_by_name": True}

    record_id: str = Field(..., alias="recordId")
    format: str
    content: str


def _record_to_response(rec: ReleaseRecord) -> ReleaseRecordResponse:
    return ReleaseRecordResponse(
        record_id=rec.record_id,
        analysis_id=rec.analysis_id,
        event_type=rec.event_type,
        current_version=rec.current_version,
        proposed_version=rec.proposed_version,
        environment=rec.environment,
        compatibility_result=rec.compatibility_result,
        severity=rec.severity,
        policy_name=rec.policy_name,
        policy_reason=rec.policy_reason,
        decision=rec.decision,
        affected_consumers=rec.affected_consumers,
        findings_summary=rec.findings_summary,
        published=rec.published,
        attempted_publish=rec.attempted_publish,
        event_id=rec.event_id,
        event_bridge_event_id=rec.event_bridge_event_id,
        request_id=rec.request_id,
        timestamp=rec.timestamp,
        published_at=rec.published_at,
        error=rec.error,
    )


@router.get(
    "/history",
    response_model=list[ReleaseRecordResponse],
    response_model_by_alias=True,
    summary="List release history audit reviews",
)
def list_history(
    event_type: str | None = Query(None, alias="eventType"),
    limit: int = Query(50, ge=1, le=200),
    service: ReleaseHistoryService = Depends(get_history_service),
) -> list[ReleaseRecordResponse]:
    """Return historical release audit records ordered by most recent first."""
    records = service.list_reviews(event_type=event_type, limit=limit)
    return [_record_to_response(r) for r in records]


@router.get(
    "/history/{record_id}",
    response_model=ReleaseRecordResponse,
    response_model_by_alias=True,
    summary="Get single release review record",
)
def get_history_record(
    record_id: str,
    service: ReleaseHistoryService = Depends(get_history_service),
) -> ReleaseRecordResponse:
    """Retrieve audit record details by recordId or analysisId."""
    rec = service.get_review(record_id)
    return _record_to_response(rec)


@router.get(
    "/history/{record_id}/report",
    response_model=ReportExportResponse,
    response_model_by_alias=True,
    summary="Export release review report",
)
def export_history_report(
    record_id: str,
    format: Literal["markdown", "json"] = Query("markdown"),
    service: ReleaseHistoryService = Depends(get_history_service),
) -> ReportExportResponse:
    """Generate and return a release report in Markdown or JSON format."""
    content = service.export_report(record_id, format_type=format)
    return ReportExportResponse(
        record_id=record_id,
        format=format,
        content=content,
    )
