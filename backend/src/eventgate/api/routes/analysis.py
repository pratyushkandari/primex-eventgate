"""Analysis endpoint — POST /api/v1/analyze.

Evaluates a proposed event contract against registered downstream consumer
contracts and returns consumer-specific findings with an overall decision.

Pydantic models here handle API serialization (camelCase JSON). Domain
dataclasses remain internal.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field

from eventgate.api.dependencies import get_analysis_service, get_history_service, get_request_id
from eventgate.application.services.event_analysis_service import EventAnalysisService
from eventgate.application.services.release_history_service import ReleaseHistoryService
from eventgate.domain.models import AnalysisResult

router = APIRouter(prefix="/api/v1")


# ---------------------------------------------------------------------------
# Request model
# ---------------------------------------------------------------------------


class AnalyzeRequest(BaseModel):
    """Request body for event compatibility analysis."""

    model_config = {"populate_by_name": True}

    event_type: str = Field(..., alias="eventType", min_length=1, description="Event type name")
    current_version: int = Field(
        ..., alias="currentVersion", ge=1, description="Current event version"
    )
    proposed_version: int = Field(
        ..., alias="proposedVersion", ge=1, description="Proposed event version"
    )
    environment: str = Field("production", description="Deployment environment")


# ---------------------------------------------------------------------------
# Response models (camelCase JSON for future React frontend)
# ---------------------------------------------------------------------------


class TypeChangeResponse(BaseModel):
    model_config = {"populate_by_name": True}
    field: str
    from_type: str = Field(..., alias="fromType")
    to_type: str = Field(..., alias="toType")


class RequirednessChangeResponse(BaseModel):
    model_config = {"populate_by_name": True}
    field: str
    from_required: bool = Field(..., alias="fromRequired")
    to_required: bool = Field(..., alias="toRequired")


class ChangeSetResponse(BaseModel):
    model_config = {"populate_by_name": True}
    added_fields: list[str] = Field(..., alias="addedFields")
    removed_fields: list[str] = Field(..., alias="removedFields")
    type_changes: list[TypeChangeResponse] = Field(..., alias="typeChanges")
    requiredness_changes: list[RequirednessChangeResponse] = Field(..., alias="requirednessChanges")


class FindingResponse(BaseModel):
    model_config = {"populate_by_name": True}
    consumer_id: str = Field(..., alias="consumerId")
    status: str
    rule_id: str = Field(..., alias="ruleId")
    field: str
    expected_type: str | None = Field(None, alias="expectedType")
    proposed_type: str | None = Field(None, alias="proposedType")
    severity: str
    reason: str


class AnalysisResponse(BaseModel):
    """Full analysis result returned to the client."""

    model_config = {"populate_by_name": True}

    analysis_id: str = Field(..., alias="analysisId")
    event_type: str = Field(..., alias="eventType")
    current_version: int = Field(..., alias="currentVersion")
    proposed_version: int = Field(..., alias="proposedVersion")
    environment: str = Field("production")
    compatibility_result: str = Field("SAFE", alias="compatibilityResult")
    policy_name: str = Field("StandardReleasePolicy", alias="policyName")
    policy_reason: str = Field("", alias="policyReason")
    warnings: list[str] = Field(default_factory=list)
    change_set: ChangeSetResponse = Field(..., alias="changeSet")
    findings: list[FindingResponse]
    decision: str
    severity: str
    summary: str
    timestamp: datetime
    request_id: str | None = Field(None, alias="requestId")


# ---------------------------------------------------------------------------
# Conversion helper
# ---------------------------------------------------------------------------


def _to_response(result: AnalysisResult) -> AnalysisResponse:
    """Convert a domain AnalysisResult into the API response model."""
    return AnalysisResponse(
        analysis_id=result.analysis_id,
        event_type=result.event_type,
        current_version=result.current_version,
        proposed_version=result.proposed_version,
        environment=result.environment,
        compatibility_result=result.compatibility_result,
        policy_name=result.policy_name,
        policy_reason=result.policy_reason,
        warnings=result.warnings,
        change_set=ChangeSetResponse(
            added_fields=result.change_set.added_fields,
            removed_fields=result.change_set.removed_fields,
            type_changes=[
                TypeChangeResponse(field=tc.field, from_type=tc.from_type, to_type=tc.to_type)
                for tc in result.change_set.type_changes
            ],
            requiredness_changes=[
                RequirednessChangeResponse(
                    field=rc.field,
                    from_required=rc.from_required,
                    to_required=rc.to_required,
                )
                for rc in result.change_set.requiredness_changes
            ],
        ),
        findings=[
            FindingResponse(
                consumer_id=f.consumer_id,
                status=f.status.value,
                rule_id=f.rule_id,
                field=f.field,
                expected_type=f.expected_type,
                proposed_type=f.proposed_type,
                severity=f.severity.value,
                reason=f.reason,
            )
            for f in result.findings
        ],
        decision=result.decision.value,
        severity=result.severity.value,
        summary=result.summary,
        timestamp=result.timestamp,
        request_id=result.request_id,
    )


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------


@router.post(
    "/analyze",
    response_model=AnalysisResponse,
    response_model_by_alias=True,
    summary="Analyze event compatibility",
    description=(
        "Evaluate a proposed event contract against the contracts registered "
        "by downstream consumers. Evaluates release policy for the target "
        "environment and returns per-consumer findings, policy reasons, and an "
        "authoritative ALLOW / REVIEW / BLOCK decision."
    ),
)
async def analyze_event(
    body: AnalyzeRequest,
    response: Response,
    request_id: str = Depends(get_request_id),
    service: EventAnalysisService = Depends(get_analysis_service),
    history_service: ReleaseHistoryService = Depends(get_history_service),
):
    response.headers["X-Request-ID"] = request_id
    result = service.analyze(
        event_type=body.event_type,
        current_version=body.current_version,
        proposed_version=body.proposed_version,
        environment=body.environment,
        request_id=request_id,
    )

    findings_summary = [
        {
            "consumerId": f.consumer_id,
            "status": f.status.value,
            "ruleId": f.rule_id,
            "field": f.field,
            "expectedType": f.expected_type,
            "proposedType": f.proposed_type,
            "severity": f.severity.value,
            "reason": f.reason,
        }
        for f in result.findings
    ]
    affected_consumers = sorted(
        {f.consumer_id for f in result.findings if f.status.value != "SAFE"}
    )

    try:
        history_service.record_evaluation(
            analysis_id=result.analysis_id,
            event_type=result.event_type,
            current_version=result.current_version,
            proposed_version=result.proposed_version,
            environment=result.environment,
            compatibility_result=result.compatibility_result,
            severity=result.severity.value,
            policy_name=result.policy_name,
            policy_reason=result.policy_reason or result.summary,
            decision=result.decision.value,
            affected_consumers=affected_consumers,
            findings_summary=findings_summary,
            request_id=request_id,
        )
    except Exception as exc:
        import logging

        logging.getLogger(__name__).warning("Failed to record evaluation in history: %s", exc)

    return _to_response(result)
