"""Event publishing application service — enforces safety decisions via event transport."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from eventgate.application.ports.publisher import IEventPublisher
from eventgate.application.ports.repositories import IEventContractRepository
from eventgate.application.services.event_analysis_service import EventAnalysisService
from eventgate.application.services.release_history_service import ReleaseHistoryService
from eventgate.domain.enums import CompatibilityStatus, Decision, Severity
from eventgate.domain.models import AnalysisResult
from eventgate.domain.payload_validator import validate_event_payload

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PublishResult:
    """Outcome of an event publish and gate evaluation."""

    event_id: str
    published: bool
    decision: Decision
    severity: Severity
    analysis_result: AnalysisResult
    event_bridge_event_id: str | None = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))


class EventPublishService:
    """Orchestrates event payload validation, consumer impact analysis, and gated publishing."""

    def __init__(
        self,
        event_repo: IEventContractRepository,
        analysis_service: EventAnalysisService,
        publisher: IEventPublisher,
        history_service: ReleaseHistoryService | None = None,
    ):
        self._event_repo = event_repo
        self._analysis_service = analysis_service
        self._publisher = publisher
        self._history_service = history_service

    def publish_event(
        self,
        event_type: str,
        current_version: int,
        proposed_version: int,
        payload: dict[str, Any],
        environment: str = "production",
        analysis_id: str | None = None,
        request_id: str | None = None,
    ) -> PublishResult:
        """Evaluate consumer compatibility and publish the event only if decision is ALLOW.

        Order of execution:
        1. Generate unique event_id
        2. Load proposed contract
        3. Validate actual payload against proposed contract (raises InvalidEventPayloadError)
        4. Run consumer compatibility analysis via EventAnalysisService
        5. If ALLOW: publish to event transport and persist success audit record
        6. If BLOCK or REVIEW: prevent publication and persist prevention audit record
        7. Log structured execution record
        8. Return PublishResult
        """
        event_id = str(uuid.uuid4())

        # 1. Load proposed contract for payload validation
        proposed_contract = self._event_repo.get_event_contract(event_type, proposed_version)

        # 2. Validate payload before running analysis
        validate_event_payload(payload, proposed_contract)

        # 3. Analyze consumer impact for the target environment
        analysis_result = self._analysis_service.analyze(
            event_type=event_type,
            current_version=current_version,
            proposed_version=proposed_version,
            environment=environment,
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
            for f in analysis_result.findings
        ]
        affected_consumers = sorted(
            {
                f.consumer_id
                for f in analysis_result.findings
                if f.status != CompatibilityStatus.SAFE
            }
        )

        # 4. Gated publication invariant
        if analysis_result.decision == Decision.ALLOW:
            pub_res = self._publisher.publish(
                event_id=event_id,
                event_type=event_type,
                version=proposed_version,
                decision=analysis_result.decision.value,
                analysis_id=analysis_result.analysis_id,
                request_id=request_id,
                payload=payload,
            )
            published = True
            event_bridge_event_id = pub_res.event_bridge_event_id
            error = None
        else:
            published = False
            event_bridge_event_id = None
            error = (
                f"Publication prevented by {analysis_result.policy_name}: "
                f"{analysis_result.policy_reason or 'Gate enforced hard interception.'}"
            )

        # 5. Correlate with persistent release audit trail
        if self._history_service:
            try:
                self._history_service.record_publish(
                    analysis_id=analysis_id or analysis_result.analysis_id,
                    event_type=event_type,
                    current_version=current_version,
                    proposed_version=proposed_version,
                    environment=environment,
                    decision=analysis_result.decision.value,
                    severity=analysis_result.severity.value,
                    compatibility_result=analysis_result.compatibility_result,
                    published=published,
                    event_id=event_id,
                    event_bridge_event_id=event_bridge_event_id,
                    request_id=request_id,
                    error=error,
                    affected_consumers=affected_consumers,
                    findings_summary=findings_summary,
                )
            except Exception as exc:
                logger.warning("Failed to record publication audit history: %s", exc)

        logger.info(
            "EventGate publish evaluated: requestId=%s eventId=%s eventType=%s "
            "proposedVersion=%d decision=%s published=%s eventBridgeEventId=%s",
            request_id,
            event_id,
            event_type,
            proposed_version,
            analysis_result.decision.value,
            published,
            event_bridge_event_id,
        )


        return PublishResult(
            event_id=event_id,
            published=published,
            decision=analysis_result.decision,
            severity=analysis_result.severity,
            analysis_result=analysis_result,
            event_bridge_event_id=event_bridge_event_id,
        )
