"""Gated publish use case: validate the payload, re-run the analysis, and hand the
event to the publisher only when the release decision is ALLOW.

Every attempt, including blocked, held and failed ones, is written to release
history so the audit trail shows what the gate actually did.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from typing import Any

from eventgate.application.ports.publisher import IEventPublisher
from eventgate.application.ports.repositories import IEventContractRepository
from eventgate.application.services.event_analysis_service import EventAnalysisService
from eventgate.application.services.release_history_service import ReleaseHistoryService
from eventgate.domain.enums import Decision, Environment, Severity
from eventgate.domain.errors import EventPublishFailedError
from eventgate.domain.history import affected_consumer_ids, summarize_findings
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
        """Evaluate consumer compatibility and publish the event only if the decision is ALLOW.

        Raises:
            InvalidEventPayloadError: the payload does not match the proposed contract.
            InvalidAnalysisRequestError: bad versions or environment, or analysis_id
                refers to a different change.
            EventPublishFailedError: the decision was ALLOW but the transport failed.
                The failed attempt is still recorded in history.
        """
        env = Environment.parse(environment).value
        event_id = str(uuid.uuid4())

        proposed_contract = self._event_repo.get_event_contract(event_type, proposed_version)
        validate_event_payload(payload, proposed_contract)

        # Reject a mismatched analysisId before anything is published.
        if analysis_id and self._history_service:
            self._history_service.find_correlated_review(
                analysis_id, event_type, current_version, proposed_version, env
            )

        analysis_result = self._analysis_service.analyze(
            event_type=event_type,
            current_version=current_version,
            proposed_version=proposed_version,
            environment=env,
            request_id=request_id,
        )
        if analysis_id:
            # The re-run gets a fresh ID; keep the one the client reviewed so the
            # event, the response and the history record all point to one record.
            analysis_result = replace(analysis_result, analysis_id=analysis_id)

        published = False
        event_bridge_event_id: str | None = None
        error: str | None = None
        publish_failure: EventPublishFailedError | None = None

        if analysis_result.decision == Decision.ALLOW:
            try:
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
            except EventPublishFailedError as exc:
                publish_failure = exc
                error = f"Publication failed: {exc.message}"
        else:
            error = (
                f"Publication prevented by {analysis_result.policy_name}: "
                f"{analysis_result.policy_reason or 'release decision was not ALLOW.'}"
            )

        self._record_attempt(
            analysis_id=analysis_id or analysis_result.analysis_id,
            result=analysis_result,
            published=published,
            event_id=event_id,
            event_bridge_event_id=event_bridge_event_id,
            request_id=request_id,
            error=error,
        )

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

        if publish_failure is not None:
            raise publish_failure

        return PublishResult(
            event_id=event_id,
            published=published,
            decision=analysis_result.decision,
            severity=analysis_result.severity,
            analysis_result=analysis_result,
            event_bridge_event_id=event_bridge_event_id,
        )

    def _record_attempt(
        self,
        analysis_id: str,
        result: AnalysisResult,
        published: bool,
        event_id: str,
        event_bridge_event_id: str | None,
        request_id: str | None,
        error: str | None,
    ) -> None:
        """Persist the attempt; a history outage must not undo a publish that happened."""
        if not self._history_service:
            return
        try:
            self._history_service.record_publish(
                analysis_id=analysis_id,
                event_type=result.event_type,
                current_version=result.current_version,
                proposed_version=result.proposed_version,
                environment=result.environment,
                decision=result.decision.value,
                severity=result.severity.value,
                compatibility_result=result.compatibility_result,
                published=published,
                event_id=event_id,
                event_bridge_event_id=event_bridge_event_id,
                request_id=request_id,
                error=error,
                affected_consumers=affected_consumer_ids(result.findings),
                findings_summary=summarize_findings(result.findings),
                policy_name=result.policy_name,
                policy_reason=result.policy_reason,
            )
        except Exception as exc:
            logger.warning("Failed to record publication audit history: %s", exc)
