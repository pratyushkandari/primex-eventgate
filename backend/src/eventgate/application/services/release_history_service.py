"""Release history application service.

Coordinates persisting, querying, correlating, and exporting release audit reviews.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from eventgate.application.ports.repositories import IReleaseReviewRepository
from eventgate.domain.errors import InvalidAnalysisRequestError, ReleaseRecordNotFoundError
from eventgate.domain.history import ReleaseRecord
from eventgate.domain.reports import generate_json_report, generate_markdown_report

logger = logging.getLogger(__name__)


class ReleaseHistoryService:
    """Service managing release reviews and audit lifecycle."""

    def __init__(self, review_repo: IReleaseReviewRepository):
        self._repo = review_repo

    def record_evaluation(
        self,
        analysis_id: str,
        event_type: str,
        current_version: int,
        proposed_version: int,
        environment: str,
        compatibility_result: str,
        severity: str,
        policy_name: str,
        policy_reason: str,
        decision: str,
        affected_consumers: list[str],
        findings_summary: list[dict[str, Any]],
        request_id: str | None = None,
    ) -> ReleaseRecord:
        """Create and persist an evaluated release review record."""
        record = ReleaseRecord(
            record_id=analysis_id,
            analysis_id=analysis_id,
            event_type=event_type,
            current_version=current_version,
            proposed_version=proposed_version,
            environment=environment,
            compatibility_result=compatibility_result,
            severity=severity,
            policy_name=policy_name,
            policy_reason=policy_reason,
            decision=decision,
            affected_consumers=affected_consumers,
            findings_summary=findings_summary,
            published=False,
            request_id=request_id,
            timestamp=datetime.now(UTC),
        )
        return self._repo.save_review(record)

    def record_publish(
        self,
        analysis_id: str | None,
        event_type: str,
        current_version: int,
        proposed_version: int,
        environment: str,
        decision: str,
        severity: str,
        compatibility_result: str,
        published: bool,
        event_id: str,
        event_bridge_event_id: str | None = None,
        request_id: str | None = None,
        error: str | None = None,
        affected_consumers: list[str] | None = None,
        findings_summary: list[dict[str, Any]] | None = None,
    ) -> ReleaseRecord:
        """Update existing correlated review or create new publication attempt record."""
        record_to_save: ReleaseRecord | None = None

        if analysis_id:
            try:
                existing = self._repo.get_review(analysis_id)
                record_to_save = ReleaseRecord(
                    record_id=existing.record_id,
                    analysis_id=existing.analysis_id,
                    event_type=existing.event_type,
                    current_version=existing.current_version,
                    proposed_version=existing.proposed_version,
                    environment=environment or existing.environment,
                    compatibility_result=existing.compatibility_result,
                    severity=existing.severity,
                    policy_name=existing.policy_name,
                    policy_reason=existing.policy_reason,
                    decision=decision,
                    affected_consumers=existing.affected_consumers,
                    findings_summary=existing.findings_summary,
                    published=published,
                    attempted_publish=True,
                    event_id=event_id,
                    event_bridge_event_id=event_bridge_event_id,
                    request_id=request_id or existing.request_id,
                    timestamp=existing.timestamp,
                    published_at=datetime.now(UTC) if published else None,
                    error=error,
                )
            except ReleaseRecordNotFoundError:
                pass

        if not record_to_save:
            record_to_save = ReleaseRecord(
                record_id=event_id,
                analysis_id=analysis_id or event_id,
                event_type=event_type,
                current_version=current_version,
                proposed_version=proposed_version,
                environment=environment,
                compatibility_result=compatibility_result,
                severity=severity,
                policy_name="StandardReleasePolicy",
                policy_reason="Direct publication evaluation",
                decision=decision,
                affected_consumers=affected_consumers or [],
                findings_summary=findings_summary or [],
                published=published,
                attempted_publish=True,
                event_id=event_id,
                event_bridge_event_id=event_bridge_event_id,
                request_id=request_id,
                timestamp=datetime.now(UTC),
                published_at=datetime.now(UTC) if published else None,
                error=error,
            )

        return self._repo.save_review(record_to_save)

    def get_review(self, record_id: str) -> ReleaseRecord:
        """Retrieve a specific release review."""
        if not record_id or not record_id.strip():
            raise InvalidAnalysisRequestError("Record ID must not be empty.")
        return self._repo.get_review(record_id.strip())

    def list_reviews(
        self, event_type: str | None = None, limit: int = 50
    ) -> list[ReleaseRecord]:
        """List historical release reviews."""
        clean_event = event_type.strip() if event_type else None
        return self._repo.list_reviews(event_type=clean_event, limit=limit)

    def export_report(self, record_id: str, format_type: str = "markdown") -> str:
        """Export formatted release report in Markdown or JSON."""
        record = self.get_review(record_id)
        if format_type.lower() == "json":
            return generate_json_report(record)
        return generate_markdown_report(record)
