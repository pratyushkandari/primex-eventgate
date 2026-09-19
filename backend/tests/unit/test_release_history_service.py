"""Unit tests for release history repository, service, and reporting."""

import json
from pathlib import Path

import pytest

from eventgate.application.services.release_history_service import ReleaseHistoryService
from eventgate.domain.enums import Decision, Severity
from eventgate.domain.errors import ReleaseRecordNotFoundError
from eventgate.domain.history import ReleaseRecord
from eventgate.domain.reports import generate_json_report, generate_markdown_report
from eventgate.infrastructure.repositories.release_review_repository import (
    JsonReleaseReviewRepository,
)


@pytest.fixture
def temp_contracts_dir(tmp_path: Path) -> Path:
    """Fixture providing a temporary contracts directory with clean history."""
    return tmp_path


@pytest.fixture
def history_repo(temp_contracts_dir: Path) -> JsonReleaseReviewRepository:
    return JsonReleaseReviewRepository(temp_contracts_dir)


@pytest.fixture
def history_service(history_repo: JsonReleaseReviewRepository) -> ReleaseHistoryService:
    return ReleaseHistoryService(history_repo)


def test_fresh_installation_history_is_empty(history_service: ReleaseHistoryService):
    """Zero fake functionality: fresh install has empty history."""
    reviews = history_service.list_reviews()
    assert reviews == []


def test_record_evaluation_creates_authoritative_record(
    history_service: ReleaseHistoryService,
):
    """Recording an evaluation persists record with record_id = analysis_id."""
    analysis_id = "test-analysis-001"
    record = history_service.record_evaluation(
        analysis_id=analysis_id,
        event_type="OrderPlaced",
        current_version=1,
        proposed_version=2,
        environment="production",
        compatibility_result="SAFE",
        severity=Severity.LOW.value,
        policy_name="StandardReleasePolicy",
        policy_reason="Safe release",
        decision=Decision.ALLOW.value,
        affected_consumers=[],
        findings_summary=[],
        request_id="req-123",
    )

    assert record.record_id == analysis_id
    assert record.analysis_id == analysis_id
    assert record.published is False
    assert record.attempted_publish is False

    retrieved = history_service.get_review(analysis_id)
    assert retrieved.record_id == analysis_id
    assert retrieved.decision == "ALLOW"
    assert retrieved.environment == "production"


def test_record_publish_correlates_existing_evaluation(
    history_service: ReleaseHistoryService,
):
    """Publishing updates the existing evaluation record rather than creating a duplicate."""
    analysis_id = "corr-analysis-002"
    history_service.record_evaluation(
        analysis_id=analysis_id,
        event_type="OrderPlaced",
        current_version=1,
        proposed_version=2,
        environment="production",
        compatibility_result="SAFE",
        severity=Severity.LOW.value,
        policy_name="StandardReleasePolicy",
        policy_reason="Safe release",
        decision=Decision.ALLOW.value,
        affected_consumers=[],
        findings_summary=[],
    )

    # Correlated publish
    pub_record = history_service.record_publish(
        analysis_id=analysis_id,
        event_type="OrderPlaced",
        current_version=1,
        proposed_version=2,
        environment="production",
        decision=Decision.ALLOW.value,
        severity=Severity.LOW.value,
        compatibility_result="SAFE",
        published=True,
        event_id="evt-999",
        event_bridge_event_id="eb-111-222",
    )

    assert pub_record.record_id == analysis_id
    assert pub_record.published is True
    assert pub_record.attempted_publish is True
    assert pub_record.event_id == "evt-999"
    assert pub_record.event_bridge_event_id == "eb-111-222"

    # Must be exactly 1 record in history, not 2
    all_records = history_service.list_reviews()
    assert len(all_records) == 1
    assert all_records[0].published is True


def test_record_publish_prevention(history_service: ReleaseHistoryService):
    """When a release is prevented (e.g. BLOCK), record stores attempted_publish=True and error."""
    analysis_id = "block-analysis-003"
    history_service.record_evaluation(
        analysis_id=analysis_id,
        event_type="OrderPlaced",
        current_version=1,
        proposed_version=3,
        environment="production",
        compatibility_result="BREAK",
        severity=Severity.HIGH.value,
        policy_name="StandardReleasePolicy",
        policy_reason="Breaking change detected",
        decision=Decision.BLOCK.value,
        affected_consumers=["inventory-service"],
        findings_summary=[],
    )

    pub_record = history_service.record_publish(
        analysis_id=analysis_id,
        event_type="OrderPlaced",
        current_version=1,
        proposed_version=3,
        environment="production",
        decision=Decision.BLOCK.value,
        severity=Severity.HIGH.value,
        compatibility_result="BREAK",
        published=False,
        event_id="attempted-evt",
        error="Publication prevented by StandardReleasePolicy: Breaking change detected",
    )

    assert pub_record.published is False
    assert pub_record.attempted_publish is True
    assert "Publication prevented" in (pub_record.error or "")


def test_get_nonexistent_review_raises_error(history_service: ReleaseHistoryService):
    """Querying an unknown review raises ReleaseRecordNotFoundError."""
    with pytest.raises(ReleaseRecordNotFoundError):
        history_service.get_review("nonexistent-id")


def test_reports_generation(history_service: ReleaseHistoryService):
    """Markdown and JSON reports generate correctly with deterministic formatting."""
    record = ReleaseRecord(
        record_id="rec-report-01",
        analysis_id="rec-report-01",
        event_type="OrderPlaced",
        current_version=1,
        proposed_version=2,
        environment="production",
        compatibility_result="SAFE",
        severity="LOW",
        policy_name="StandardReleasePolicy",
        policy_reason="Backward-compatible change",
        decision="ALLOW",
        affected_consumers=[],
        findings_summary=[],
        published=True,
        event_id="evt-123",
        event_bridge_event_id="eb-456",
    )

    md = generate_markdown_report(record)
    assert "# EventGate Release Review Report" in md
    assert "`OrderPlaced`" in md
    assert "`v1` → `v2`" in md
    assert "PUBLISHED" in md

    json_str = generate_json_report(record)
    parsed = json.loads(json_str)
    assert parsed["record_id"] == "rec-report-01"
    assert parsed["published"] is True
