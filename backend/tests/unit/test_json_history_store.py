"""JSON history store: concurrency safety, corruption handling and record timestamps."""

from __future__ import annotations

import json
import threading
import time
from pathlib import Path

import pytest

from eventgate.domain.errors import ReleaseRecordNotFoundError
from eventgate.domain.history import ReleaseRecord
from eventgate.infrastructure.repositories.release_review_repository import (
    HistoryStoreCorruptedError,
    InMemoryReleaseReviewRepository,
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


def test_failed_write_leaves_store_consistent(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    repo = JsonReleaseReviewRepository(tmp_path / "history.json")
    repo.save_review(_record("kept"))

    def broken(_payload):
        raise OSError("disk full")

    monkeypatch.setattr(repo, "_write_all", broken)
    with pytest.raises(OSError):
        repo.save_review(_record("lost"))

    assert [r.record_id for r in repo.list_reviews()] == ["kept"]


def test_external_changes_to_the_file_are_picked_up(tmp_path: Path):
    path = tmp_path / "history.json"
    writer, reader = JsonReleaseReviewRepository(path), JsonReleaseReviewRepository(path)
    writer.save_review(_record("a"))
    assert len(reader.list_reviews()) == 1
    writer.save_review(_record("b"))
    assert len(reader.list_reviews()) == 2


def test_save_cost_stays_flat_as_history_grows(tmp_path: Path):
    """Regression: each save rewrote the file with indent=2 and took ~0.5 s at ~600 records."""
    repo = JsonReleaseReviewRepository(tmp_path / "history.json")
    for i in range(600):
        repo.save_review(_record(f"r-{i}"))
    start = time.perf_counter()
    for i in range(20):
        repo.save_review(_record(f"late-{i}"))
    assert (time.perf_counter() - start) / 20 < 0.1


def test_file_holding_a_json_object_is_corrupt(tmp_path: Path):
    path = tmp_path / "history.json"
    path.write_text('{"record_id": "x"}', encoding="utf-8")
    with pytest.raises(HistoryStoreCorruptedError, match="not a list"):
        JsonReleaseReviewRepository(path).list_reviews()


def test_unreadable_records_are_skipped_when_listing(tmp_path: Path):
    path = tmp_path / "history.json"
    repo = JsonReleaseReviewRepository(path)
    repo.save_review(_record("good"))
    records = json.loads(path.read_text(encoding="utf-8"))
    records.append({"record_id": "bad"})
    path.write_text(json.dumps(records), encoding="utf-8")

    assert [r.record_id for r in JsonReleaseReviewRepository(path).list_reviews()] == ["good"]


def test_listing_filters_by_event_type(tmp_path: Path):
    repo = JsonReleaseReviewRepository(tmp_path / "history.json")
    repo.save_review(_record("a", "OrderPlaced"))
    repo.save_review(_record("b", "UserCreated"))
    assert [r.record_id for r in repo.list_reviews(event_type="UserCreated")] == ["b"]


def test_failed_rename_removes_the_temporary_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    store = tmp_path / "store"
    repo = JsonReleaseReviewRepository(store / "history.json")

    def failing_replace(src, dst):
        raise PermissionError("file locked")

    monkeypatch.setattr("os.replace", failing_replace)
    with pytest.raises(PermissionError):
        repo.save_review(_record("a"))
    assert list(store.iterdir()) == []


class TestInMemoryStore:
    def test_save_replaces_by_record_id_and_finds_by_analysis_id(self):
        repo = InMemoryReleaseReviewRepository([_record("a")])
        repo.save_review(_record("a"))
        repo.save_review(_record("b"))
        assert len(repo.list_reviews()) == 2
        assert repo.get_review("b").analysis_id == "b"

    def test_unknown_record_is_not_found(self):
        with pytest.raises(ReleaseRecordNotFoundError):
            InMemoryReleaseReviewRepository().get_review("missing")
