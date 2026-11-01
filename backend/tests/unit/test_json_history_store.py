"""JSON history store: concurrency safety, corruption handling and record timestamps."""

from __future__ import annotations

import threading
import time
from pathlib import Path

import pytest

from eventgate.domain.history import ReleaseRecord
from eventgate.infrastructure.repositories.release_review_repository import (
    HistoryStoreCorruptedError,
    JsonReleaseReviewRepository,
)


def _record(record_id: str, event_type: str = "OrderPlaced") -> ReleaseRecord:
    return ReleaseRecord(
        record_id=record_id,
        analysis_id=record_id,
        event_type=event_type,
        current_version=1,
        proposed_version=2,
        environment="production",
        compatibility_result="SAFE",
        severity="LOW",
        policy_name="StandardReleasePolicy",
        policy_reason="ok",
        decision="ALLOW",
        affected_consumers=[],
        findings_summary=[],
        published=False,
    )


def test_concurrent_saves_lose_no_records(tmp_path: Path):
    repo = JsonReleaseReviewRepository(tmp_path / "history.json")
    errors: list[Exception] = []

    def worker(n: int) -> None:
        try:
            for i in range(10):
                repo.save_review(_record(f"r-{n}-{i}"))
        except Exception as exc:  # pragma: no cover - only on failure
            errors.append(exc)

    threads = [threading.Thread(target=worker, args=(n,)) for n in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert errors == []
    assert len(repo.list_reviews(limit=200)) == 80


def test_two_instances_on_one_file_share_a_lock(tmp_path: Path):
    path = tmp_path / "history.json"
    a, b = JsonReleaseReviewRepository(path), JsonReleaseReviewRepository(path)
    threads = [
        threading.Thread(
            target=lambda r=r, n=n: [r.save_review(_record(f"{n}-{i}")) for i in range(20)]
        )
        for n, r in enumerate((a, b))
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert len(a.list_reviews(limit=100)) == 40


def test_corrupt_file_raises_and_is_not_overwritten(tmp_path: Path):
    path = tmp_path / "history.json"
    path.write_text('[{"record_id": "keep-me"', encoding="utf-8")
    repo = JsonReleaseReviewRepository(path)

    with pytest.raises(HistoryStoreCorruptedError):
        repo.save_review(_record("new"))

    assert path.read_text(encoding="utf-8") == '[{"record_id": "keep-me"'


def test_missing_and_empty_files_read_as_empty(tmp_path: Path):
    assert JsonReleaseReviewRepository(tmp_path / "nope.json").list_reviews() == []
    empty = tmp_path / "empty.json"
    empty.write_text("", encoding="utf-8")
    assert JsonReleaseReviewRepository(empty).list_reviews() == []


def test_save_replaces_by_record_id_only(tmp_path: Path):
    repo = JsonReleaseReviewRepository(tmp_path / "history.json")
    repo.save_review(_record("a"))
    updated = _record("a")
    repo.save_review(updated)
    assert len(repo.list_reviews()) == 1


def test_no_temp_files_left_behind(tmp_path: Path):
    store_dir = tmp_path / "store"
    repo = JsonReleaseReviewRepository(store_dir / "history.json")
    repo.save_review(_record("a"))
    repo.save_review(_record("b"))
    assert [p.name for p in store_dir.iterdir()] == ["history.json"]


def test_records_created_later_get_later_timestamps():
    first = _record("a")
    time.sleep(0.01)
    second = _record("b")
    assert second.timestamp > first.timestamp
