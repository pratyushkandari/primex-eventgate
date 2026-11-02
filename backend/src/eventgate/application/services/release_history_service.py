"""Release history use cases: record analyses and publication attempts, query them,
and render reports.

A release record is keyed by the analysis ID that produced it. When a publish
request carries that analysis ID, the publication outcome is written onto the
same record so one entry tells the full story of a proposed change.
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

REPORT_FORMATS = ("markdown", "json")


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

    def find_correlated_review(
        self,
        analysis_id: str,
        event_type: str,
        current_version: int,
        proposed_version: int,
        environment: str,
    ) -> ReleaseRecord | None:
        """Return the recorded analysis a publish request refers to.

        Returns None when no record exists for the ID (for example, if recording
        the analysis failed). Raises InvalidAnalysisRequestError when the record
        describes a different change, so a publish can never be filed under
        another analysis's audit entry.
        """
        try:
            existing = self._repo.get_review(analysis_id)
        except ReleaseRecordNotFoundError:
            return None

        recorded = (
            existing.event_type,
            existing.current_version,
            existing.proposed_version,
            existing.environment,
        )
        requested = (event_type, current_version, proposed_version, environment)
        if recorded != requested:
            raise InvalidAnalysisRequestError(
                f"analysisId '{analysis_id}' belongs to {existing.event_type} "
                f"v{existing.current_version} -> v{existing.proposed_version} "
                f"({existing.environment}), not {event_type} v{current_version} -> "
                f"v{proposed_version} ({environment}). Re-run the analysis before publishing."
            )
        return existing

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
        policy_name: str | None = None,
        policy_reason: str | None = None,
    ) -> ReleaseRecord:
        """Write a publication attempt onto its analysis record, or create a new record.

        The values passed in come from the analysis run at publish time and take
        precedence over what the earlier analysis recorded: the gate decision that
        was actually enforced is the one the audit trail must show.
        """
        existing: ReleaseRecord | None = None
        if analysis_id:
            existing = self.find_correlated_review(
                analysis_id, event_type, current_version, proposed_version, environment
            )

        now = datetime.now(UTC)
        record = ReleaseRecord(
            record_id=existing.record_id if existing else event_id,
            analysis_id=existing.analysis_id if existing else (analysis_id or event_id),
            event_type=event_type,
            current_version=current_version,
            proposed_version=proposed_version,
            environment=environment,
            compatibility_result=compatibility_result,
            severity=severity,
            policy_name=policy_name or (existing.policy_name if existing else ""),
            policy_reason=policy_reason or (existing.policy_reason if existing else ""),
            decision=decision,
            affected_consumers=(
                affected_consumers
                if affected_consumers is not None
                else (existing.affected_consumers if existing else [])
            ),
            findings_summary=(
                findings_summary
                if findings_summary is not None
                else (existing.findings_summary if existing else [])
            ),
            published=published,
            attempted_publish=True,
            event_id=event_id,
            event_bridge_event_id=event_bridge_event_id,
            request_id=request_id or (existing.request_id if existing else None),
            timestamp=existing.timestamp if existing else now,
            published_at=now if published else None,
            error=error,
        )
        return self._repo.save_review(record)

    def get_review(self, record_id: str) -> ReleaseRecord:
        """Retrieve a specific release review."""
        if not record_id or not record_id.strip():
            raise InvalidAnalysisRequestError("Record ID must not be empty.")
        return self._repo.get_review(record_id.strip())

    def list_reviews(self, event_type: str | None = None, limit: int = 50) -> list[ReleaseRecord]:
        """List historical release reviews."""
        clean_event = event_type.strip() if event_type else None
        return self._repo.list_reviews(event_type=clean_event, limit=limit)

    def export_report(self, record_id: str, format_type: str = "markdown") -> str:
        """Render a stored record as a Markdown or JSON report.

        Raises:
            InvalidAnalysisRequestError: format_type is not 'markdown' or 'json'.
            ReleaseRecordNotFoundError: no record exists for record_id.
        """
        fmt = format_type.lower()
        if fmt not in REPORT_FORMATS:
            raise InvalidAnalysisRequestError(
                f"Unsupported report format '{format_type}'. Use 'markdown' or 'json'."
            )
        record = self.get_review(record_id)
        if fmt == "json":
            return generate_json_report(record)
        return generate_markdown_report(record)
