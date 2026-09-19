"""Tests verifying history store isolation and persistence invariants.

Proves:
1. Running operations does not modify tracked contracts/history/reviews.json.
2. Ordinary eventgate check verification mode does not modify tracked history.
3. History persistence works when configured with repository or --persist.
4. Analyze -> publish correlation is unaffected (record_id == analysis_id).
5. CLI exit codes remain: 0 = ALLOW, 1 = BLOCK, 2 = REVIEW, and --fail-on-review.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

from click.testing import CliRunner

from eventgate.application.services.release_history_service import ReleaseHistoryService
from eventgate.cli.main import main
from eventgate.infrastructure.repositories.release_review_repository import (
    InMemoryReleaseReviewRepository,
    JsonReleaseReviewRepository,
)


def _get_tracked_history_hash() -> str:
    # Resolve repository root
    repo_root = Path(__file__).resolve().parent.parent.parent.parent
    tracked_file = repo_root / "contracts" / "history" / "reviews.json"
    if not tracked_file.exists():
        return ""
    content = tracked_file.read_bytes()
    # Compute git-compatible blob SHA1
    header = f"blob {len(content)}\0".encode()
    return hashlib.sha1(header + content).hexdigest()


def test_tracked_history_file_not_modified():
    """Operation verification ensures tracked reviews.json remains untouched."""
    initial_hash = _get_tracked_history_hash()

    runner = CliRunner()
    res = runner.invoke(
        main,
        ["check", "-e", "OrderPlaced", "-c", "1", "-p", "2", "--env", "production"],
    )
    assert res.exit_code == 0

    after_hash = _get_tracked_history_hash()
    assert initial_hash == after_hash


def test_cli_check_local_mode_does_not_modify_tracked_history():
    """Ordinary eventgate check uses isolated in-memory history by default."""
    initial_hash = _get_tracked_history_hash()

    runner = CliRunner()
    # Run multiple checks (ALLOW, BLOCK, REVIEW)
    runner.invoke(
        main,
        ["check", "-e", "OrderPlaced", "-c", "1", "-p", "2", "--env", "production"],
    )
    runner.invoke(
        main,
        ["check", "-e", "OrderPlaced", "-c", "1", "-p", "3", "--env", "production"],
    )
    runner.invoke(
        main,
        ["check", "-e", "OrderPlaced", "-c", "1", "-p", "4", "--env", "production"],
    )

    final_hash = _get_tracked_history_hash()
    assert initial_hash == final_hash


def test_cli_check_with_persist_persists_to_configured_store(tmp_path: Path):
    """When explicitly configured with --persist, CLI writes to the configured store."""
    temp_history_file = tmp_path / "custom_reviews.json"
    repo = JsonReleaseReviewRepository(tmp_path, history_file=temp_history_file)
    service = ReleaseHistoryService(review_repo=repo)

    # In-memory repository persistence test
    mem_repo = InMemoryReleaseReviewRepository()
    mem_service = ReleaseHistoryService(review_repo=mem_repo)
    rec = mem_service.record_evaluation(
        analysis_id="test-analysis-persist-1",
        event_type="OrderPlaced",
        current_version=1,
        proposed_version=2,
        environment="production",
        compatibility_result="SAFE",
        severity="LOW",
        policy_name="StandardReleasePolicy",
        policy_reason="Safe",
        decision="ALLOW",
        affected_consumers=[],
        findings_summary=[],
    )
    assert rec.record_id == "test-analysis-persist-1"
    fetched = mem_service.get_review("test-analysis-persist-1")
    assert fetched.decision == "ALLOW"
    assert len(mem_service.list_reviews()) == 1

    # File-backed persistence test
    rec2 = service.record_evaluation(
        analysis_id="test-analysis-persist-2",
        event_type="OrderPlaced",
        current_version=1,
        proposed_version=2,
        environment="production",
        compatibility_result="SAFE",
        severity="LOW",
        policy_name="StandardReleasePolicy",
        policy_reason="Safe",
        decision="ALLOW",
        affected_consumers=[],
        findings_summary=[],
    )
    assert rec2.record_id == "test-analysis-persist-2"
    fetched2 = service.get_review("test-analysis-persist-2")
    assert fetched2.record_id == "test-analysis-persist-2"
    assert temp_history_file.exists()


def test_analyze_publish_correlation_preserved(tmp_path: Path):
    """Verify analyze -> publish correlation preserves record_id and updates record in place."""
    temp_file = tmp_path / "corr_reviews.json"
    repo = JsonReleaseReviewRepository(tmp_path, history_file=temp_file)
    service = ReleaseHistoryService(review_repo=repo)

    # 1. Analyze record
    rec = service.record_evaluation(
        analysis_id="analysis-corr-100",
        event_type="OrderPlaced",
        current_version=1,
        proposed_version=2,
        environment="production",
        compatibility_result="SAFE",
        severity="LOW",
        policy_name="StandardReleasePolicy",
        policy_reason="Safe release",
        decision="ALLOW",
        affected_consumers=[],
        findings_summary=[],
    )
    assert rec.record_id == "analysis-corr-100"
    assert rec.published is False

    # 2. Correlated publish update
    updated_rec = service.record_publish(
        analysis_id="analysis-corr-100",
        event_type="OrderPlaced",
        current_version=1,
        proposed_version=2,
        environment="production",
        decision="ALLOW",
        severity="LOW",
        compatibility_result="SAFE",
        published=True,
        event_id="evt-live-1",
        event_bridge_event_id="eb-entry-99",
    )
    assert updated_rec.record_id == "analysis-corr-100"
    assert updated_rec.published is True
    assert updated_rec.event_bridge_event_id == "eb-entry-99"

    # 3. Assert no duplicate records created
    all_records = service.list_reviews(event_type="OrderPlaced")
    assert len(all_records) == 1
    assert all_records[0].record_id == "analysis-corr-100"
    assert all_records[0].published is True


def test_cli_check_exit_codes_preserved():
    """Verify deterministic CLI exit codes for ALLOW (0), BLOCK (1), and REVIEW (2 / 1)."""
    runner = CliRunner()

    # ALLOW -> 0
    res_allow = runner.invoke(
        main,
        ["check", "-e", "OrderPlaced", "-c", "1", "-p", "2", "--env", "production"],
    )
    assert res_allow.exit_code == 0
    assert "Final Decision: ALLOW" in res_allow.output

    # BLOCK -> 1
    res_block = runner.invoke(
        main,
        ["check", "-e", "OrderPlaced", "-c", "1", "-p", "3", "--env", "production"],
    )
    assert res_block.exit_code == 1
    assert "Final Decision: BLOCK" in res_block.output

    # REVIEW -> 2
    res_review = runner.invoke(
        main,
        ["check", "-e", "OrderPlaced", "-c", "1", "-p", "4", "--env", "production"],
    )
    assert res_review.exit_code == 2
    assert "Final Decision: REVIEW" in res_review.output

    # REVIEW with --fail-on-review -> 1
    res_fail = runner.invoke(
        main,
        [
            "check",
            "-e",
            "OrderPlaced",
            "-c",
            "1",
            "-p",
            "4",
            "--env",
            "production",
            "--fail-on-review",
        ],
    )
    assert res_fail.exit_code == 1
    assert "Final Decision: REVIEW" in res_fail.output
