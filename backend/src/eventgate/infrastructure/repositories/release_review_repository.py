"""JSON-based release review repository for local development and Build It parity."""

from __future__ import annotations

import json
import logging
from pathlib import Path

from eventgate.domain.errors import ReleaseRecordNotFoundError
from eventgate.domain.history import ReleaseRecord

logger = logging.getLogger(__name__)


class JsonReleaseReviewRepository:
    """Local JSON-backed persistent store for release reviews."""

    def __init__(self, contracts_dir: Path):
        self._history_dir = contracts_dir / "history"
        self._file_path = self._history_dir / "reviews.json"
        self._ensure_storage()

    def _ensure_storage(self) -> None:
        """Ensure the history directory and empty reviews.json file exist."""
        try:
            self._history_dir.mkdir(parents=True, exist_ok=True)
            if not self._file_path.exists():
                self._file_path.write_text("[]", encoding="utf-8")
        except Exception as exc:
            logger.warning("Could not initialize local history storage: %s", exc)

    def _read_all(self) -> list[dict]:
        """Read all raw record dictionaries from disk."""
        if not self._file_path.exists():
            return []
        try:
            data = json.loads(self._file_path.read_text(encoding="utf-8"))
            if isinstance(data, list):
                return data
            return []
        except (json.JSONDecodeError, OSError) as exc:
            logger.error("Failed to read reviews file %s: %s", self._file_path, exc)
            return []

    def _write_all(self, records: list[dict]) -> None:
        """Write all raw record dictionaries back to disk."""
        self._ensure_storage()
        try:
            self._file_path.write_text(json.dumps(records, indent=2), encoding="utf-8")
        except OSError as exc:
            logger.error("Failed to write reviews file %s: %s", self._file_path, exc)
            raise

    def save_review(self, record: ReleaseRecord) -> ReleaseRecord:
        """Persist or update a release review record."""
        records = self._read_all()
        target_dict = record.to_dict()

        # Update in place if record_id or analysis_id exists
        updated = False
        for idx, existing in enumerate(records):
            if (
                existing.get("record_id") == record.record_id
                or existing.get("analysis_id") == record.analysis_id
            ):
                records[idx] = target_dict
                updated = True
                break

        if not updated:
            # Prepend new record so most recent is at the top
            records.insert(0, target_dict)

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
        """Retrieve a specific release review by record_id or analysis_id."""
        records = self._read_all()
        for r in records:
            if r.get("record_id") == record_id or r.get("analysis_id") == record_id:
                return ReleaseRecord.from_dict(r)

        raise ReleaseRecordNotFoundError(record_id)

    def list_reviews(
        self, event_type: str | None = None, limit: int = 50
    ) -> list[ReleaseRecord]:
        """Return recent release reviews, optionally filtered by event type."""
        records = self._read_all()
        results: list[ReleaseRecord] = []

        for r in records:
            if event_type and r.get("event_type") != event_type:
                continue
            try:
                results.append(ReleaseRecord.from_dict(r))
            except Exception as exc:
                logger.warning("Skipping invalid history record: %s", exc)

        results.sort(key=lambda x: x.timestamp, reverse=True)
        return results[:limit]
