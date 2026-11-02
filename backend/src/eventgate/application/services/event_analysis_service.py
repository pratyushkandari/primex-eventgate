"""Event analysis use case.

Loads the current and proposed contracts plus every consumer registered for the
event type, runs the compatibility engine per consumer, aggregates the findings
into SAFE / RISK / BREAK, and asks the policy engine for the release decision in
the target environment. Compatibility rules and policy live in the domain layer;
this module only coordinates them.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from eventgate.application.ports.repositories import (
    IConsumerContractRepository,
    IEventContractRepository,
)
from eventgate.domain.changes import compute_change_set
from eventgate.domain.compatibility import CompatibilityEngine
from eventgate.domain.decision import aggregate_decision, generate_summary
from eventgate.domain.enums import Environment, Severity
from eventgate.domain.errors import InvalidAnalysisRequestError
from eventgate.domain.models import AnalysisResult, Finding
from eventgate.domain.policy import IPolicyEngine, get_policy_engine

logger = logging.getLogger(__name__)


class EventAnalysisService:
    """Coordinates consumer impact analysis for a proposed event change."""

    def __init__(
        self,
        event_repo: IEventContractRepository,
        consumer_repo: IConsumerContractRepository,
        engine: CompatibilityEngine,
        policy_engine: IPolicyEngine | None = None,
    ):
        self._event_repo = event_repo
        self._consumer_repo = consumer_repo
        self._engine = engine
        self._policy_engine = policy_engine or get_policy_engine()

    def analyze(
        self,
        event_type: str,
        current_version: int,
        proposed_version: int,
        environment: str = "production",
        request_id: str | None = None,
    ) -> AnalysisResult:
        """Run a full consumer impact analysis.

        Raises:
            InvalidAnalysisRequestError: empty event type, non-positive or equal
                versions, or an unknown environment name.
            ContractNotFoundError / UnsupportedEventVersionError: a requested
                contract version does not exist.
        """
        env = Environment.parse(environment)
        if not event_type or not event_type.strip():
            raise InvalidAnalysisRequestError("Event type must not be empty.")

        if current_version < 1:
            raise InvalidAnalysisRequestError(
                f"Current version must be a positive integer, got {current_version}."
            )
        if proposed_version < 1:
            raise InvalidAnalysisRequestError(
                f"Proposed version must be a positive integer, got {proposed_version}."
            )
        if current_version == proposed_version:
            raise InvalidAnalysisRequestError(
                "Current version and proposed version must be different."
            )

        logger.info(
            "Starting analysis: event_type=%s current=%d proposed=%d request_id=%s",
            event_type,
            current_version,
            proposed_version,
            request_id,
        )

        current_contract = self._event_repo.get_event_contract(event_type, current_version)
        proposed_contract = self._event_repo.get_event_contract(event_type, proposed_version)

        change_set = compute_change_set(current_contract, proposed_contract)

        consumers = self._consumer_repo.list_consumers(event_type)

        all_findings: list[Finding] = []
        for consumer in consumers:
            consumer_findings = self._engine.evaluate(current_contract, proposed_contract, consumer)
            all_findings.extend(consumer_findings)

        # Stable order so identical inputs give identical responses and reports.
        all_findings.sort(key=lambda f: (f.consumer_id, f.field, f.rule_id))

        compat_decision, severity = aggregate_decision(all_findings)
        summary = generate_summary(decision=compat_decision, findings=all_findings)

        compat_result = (
            "BREAK"
            if severity == Severity.HIGH
            else ("RISK" if severity == Severity.MEDIUM else "SAFE")
        )

        policy_eval = self._policy_engine.evaluate(
            compatibility_result=compat_result,
            severity=severity,
            environment=env.value,
            findings=all_findings,
            context={"event_type": event_type},
        )

        logger.info(
            "Analysis complete: event_type=%s compat=%s severity=%s "
            "policy=%s decision=%s env=%s consumers=%d findings=%d",
            event_type,
            compat_result,
            severity.value,
            policy_eval.policy_name,
            policy_eval.decision.value,
            env.value,
            len(consumers),
            len(all_findings),
        )

        return AnalysisResult(
            analysis_id=str(uuid.uuid4()),
            event_type=event_type,
            current_version=current_version,
            proposed_version=proposed_version,
            change_set=change_set,
            findings=all_findings,
            decision=policy_eval.decision,
            severity=severity,
            summary=summary,
            compatibility_result=compat_result,
            environment=env.value,
            policy_name=policy_eval.policy_name,
            policy_reason=policy_eval.reason,
            warnings=policy_eval.warnings,
            timestamp=datetime.now(UTC),
            request_id=request_id,
        )
