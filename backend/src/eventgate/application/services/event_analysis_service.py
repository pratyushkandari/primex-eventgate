"""Event analysis service — the main application use case.

Orchestrates the full analysis workflow:
1. Validate request
2. Load current event contract
3. Load proposed event contract
4. Compute ChangeSet
5. Load consumers for the event type
6. Evaluate each consumer
7. Collect findings
8. Aggregate decision
9. Build AnalysisResult

This layer coordinates domain and infrastructure. It must NOT contain
compatibility rules, decision logic, or HTTP concepts.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from eventgate.domain.changes import compute_change_set
from eventgate.domain.compatibility import CompatibilityEngine
from eventgate.domain.decision import aggregate_decision, generate_summary
from eventgate.domain.errors import InvalidAnalysisRequestError
from eventgate.domain.models import AnalysisResult, Finding
from eventgate.infrastructure.repositories.consumer_contract_repository import (
    JsonConsumerContractRepository,
)
from eventgate.infrastructure.repositories.event_contract_repository import (
    JsonEventContractRepository,
)

logger = logging.getLogger(__name__)


class EventAnalysisService:
    """Coordinates consumer impact analysis for a proposed event change."""

    def __init__(
        self,
        event_repo: JsonEventContractRepository,
        consumer_repo: JsonConsumerContractRepository,
        engine: CompatibilityEngine,
    ):
        self._event_repo = event_repo
        self._consumer_repo = consumer_repo
        self._engine = engine

    def analyze(
        self,
        event_type: str,
        current_version: int,
        proposed_version: int,
        request_id: str | None = None,
    ) -> AnalysisResult:
        """Run a full consumer impact analysis.

        Raises domain errors for invalid input, missing contracts, etc.
        """
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

        # 1. Load contracts.
        current_contract = self._event_repo.get_event_contract(event_type, current_version)
        proposed_contract = self._event_repo.get_event_contract(event_type, proposed_version)

        # 2. Compute structural diff.
        change_set = compute_change_set(current_contract, proposed_contract)

        # 3. Load consumers.
        consumers = self._consumer_repo.list_consumers(event_type)

        # 4. Evaluate each consumer.
        all_findings: list[Finding] = []
        for consumer in consumers:
            consumer_findings = self._engine.evaluate(current_contract, proposed_contract, consumer)
            all_findings.extend(consumer_findings)

        # Sort all findings for determinism.
        all_findings.sort(key=lambda f: (f.consumer_id, f.field, f.rule_id))

        # 5. Aggregate decision.
        decision, severity = aggregate_decision(all_findings)
        summary = generate_summary(decision, all_findings)

        logger.info(
            "Analysis complete: event_type=%s decision=%s severity=%s consumers=%d findings=%d",
            event_type,
            decision.value,
            severity.value,
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
            decision=decision,
            severity=severity,
            summary=summary,
            timestamp=datetime.now(UTC),
            request_id=request_id,
        )
