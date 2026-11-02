"""Release history stores for local runs: a JSON file and an in-memory list.

The JSON store keeps every record in one file. Writes go to a temporary file
that is then renamed over the original, and a process-wide lock serializes
read-modify-write cycles, because FastAPI runs sync routes on a thread pool.
A file that exists but cannot be parsed raises instead of being treated as
empty, so a bad read can never cause the next save to overwrite the history.

Parsed records are cached and reused while the file's mtime and size are
unchanged, and the file is written as one compact JSON string; rewriting it
with json.dump(indent=2) made each save cost ~0.5 s at a few hundred records.
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
import threading
from pathlib import Path
from typing import Any

from eventgate.domain.errors import ReleaseRecordNotFoundError
from eventgate.domain.history import ReleaseRecord

logger = logging.getLogger(__name__)

_FILE_LOCKS: dict[Path, threading.Lock] = {}
_FILE_LOCKS_GUARD = threading.Lock()


def _lock_for(path: Path) -> threading.Lock:
    with _FILE_LOCKS_GUARD:
        return _FILE_LOCKS.setdefault(path, threading.Lock())


class HistoryStoreCorruptedError(RuntimeError):
    """Raised when the history file exists but does not contain a JSON list."""


class JsonReleaseReviewRepository:
    """Release history persisted to a single JSON file (local development and CI)."""

    def __init__(self, history_file: Path):
        self._file_path = Path(history_file).resolve()
        self._lock = _lock_for(self._file_path)
        self._cache: list[dict[str, Any]] = []
        self._cache_stamp: tuple[int, int] | None = None

    def _stamp(self) -> tuple[int, int] | None:
        try:
            stat = self._file_path.stat()
        except FileNotFoundError:
            return None
        return (stat.st_mtime_ns, stat.st_size)

    def _read_all(self) -> list[dict[str, Any]]:
        """Return the raw records. The list is the cache itself: copy before changing it."""
        stamp = self._stamp()
        if stamp is None:
            self._cache, self._cache_stamp = [], None
            return self._cache
        if stamp == self._cache_stamp:
            return self._cache

        text = self._file_path.read_text(encoding="utf-8")
        data: Any = []
        if text.strip():
            try:
                data = json.loads(text)
            except json.JSONDecodeError as exc:
                raise HistoryStoreCorruptedError(
                    f"History file {self._file_path} is not valid JSON: {exc}"
                ) from exc
        if not isinstance(data, list):
            raise HistoryStoreCorruptedError(f"History file {self._file_path} is not a list.")
        self._cache, self._cache_stamp = data, stamp
        return data

    def _write_all(self, records: list[dict[str, Any]]) -> None:
        self._file_path.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(records, separators=(",", ":"))
        fd, tmp_name = tempfile.mkstemp(
            dir=self._file_path.parent, prefix=".history-", suffix=".tmp"
        )
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                handle.write(payload)
            os.replace(tmp_name, self._file_path)
        except BaseException:
            Path(tmp_name).unlink(missing_ok=True)
            raise
        self._cache, self._cache_stamp = records, self._stamp()

    def save_review(self, record: ReleaseRecord) -> ReleaseRecord:
        """Insert the record, or replace the one with the same record_id."""
        target = record.to_dict()
        with self._lock:
            records = list(self._read_all())
            for idx, existing in enumerate(records):
                if existing.get("record_id") == record.record_id:
                    records[idx] = target
                    break
            else:
                records.insert(0, target)
            self._write_all(records)
        logger.info(
            "Persisted release review: record_id=%s event_type=%s decision=%s published=%s",
            record.record_id,
            record.event_type,
            record.decision,
            record.published,
        )
        return record

    def get_review(self, record_id: str) -> ReleaseRecord:
        """Return the record with this record_id (or analysis_id)."""
        with self._lock:
            records = self._read_all()
        for r in records:
            if r.get("record_id") == record_id or r.get("analysis_id") == record_id:
                return ReleaseRecord.from_dict(r)
        raise ReleaseRecordNotFoundError(record_id)

    def list_reviews(self, event_type: str | None = None, limit: int = 50) -> list[ReleaseRecord]:
        """Return the newest records first, optionally for one event type."""
        with self._lock:
            records = self._read_all()
        results: list[ReleaseRecord] = []
        for r in records:
            if event_type and r.get("event_type") != event_type:
                continue
            try:
                results.append(ReleaseRecord.from_dict(r))
            except (KeyError, TypeError, ValueError) as exc:
                logger.warning("Skipping invalid history record: %s", exc)
        results.sort(key=lambda x: x.timestamp, reverse=True)
        return results[:limit]


class InMemoryReleaseReviewRepository:
    """Release history kept in memory; the CLI uses it when --persist is not set."""

    def __init__(self, initial_records: list[ReleaseRecord] | None = None) -> None:
        self._records: list[ReleaseRecord] = list(initial_records or [])

    def save_review(self, record: ReleaseRecord) -> ReleaseRecord:
        """Insert the record, or replace the one with the same record_id."""
        for idx, existing in enumerate(self._records):
            if existing.record_id == record.record_id:
                self._records[idx] = record
                break
        else:
            self._records.insert(0, record)
        return record

    def get_review(self, record_id: str) -> ReleaseRecord:
        """Return the record with this record_id (or analysis_id)."""
        for r in self._records:
            if r.record_id == record_id or r.analysis_id == record_id:
                return r
        raise ReleaseRecordNotFoundError(record_id)

    def list_reviews(self, event_type: str | None = None, limit: int = 50) -> list[ReleaseRecord]:
        """Return the newest records first, optionally for one event type."""
        results = [r for r in self._records if not event_type or r.event_type == event_type]
        results.sort(key=lambda x: x.timestamp, reverse=True)
        return results[:limit]
