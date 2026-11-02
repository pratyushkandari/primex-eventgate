"""JSON contract repositories: malformed, mismatched, duplicate and missing files."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from eventgate.domain.errors import ContractNotFoundError, InvalidContractError
from eventgate.infrastructure.repositories.consumer_contract_repository import (
    JsonConsumerContractRepository,
)
from eventgate.infrastructure.repositories.event_contract_repository import (
    JsonEventContractRepository,
)

FIELDS = {"orderId": {"type": "string", "required": True}}


def _write(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(data if isinstance(data, str) else json.dumps(data), encoding="utf-8")


def _event(root: Path, name: str, data) -> None:
    _write(root / "events" / "order-placed" / name, data)


class TestJsonEventContractRepository:
    def test_list_skips_malformed_and_invalid_files(self, tmp_path: Path):
        _event(tmp_path, "v1.json", {"eventType": "OrderPlaced", "version": 1, "fields": FIELDS})
        _event(tmp_path, "v2.json", "{not json")
        _event(tmp_path, "v3.json", {"eventType": "OrderPlaced", "version": 3, "fields": "x"})
        repo = JsonEventContractRepository(tmp_path)

        assert [c.version for c in repo.list_event_contracts("OrderPlaced")] == [1]
        assert repo.get_event_versions("OrderPlaced") == [1]

    def test_list_raises_when_no_file_is_valid(self, tmp_path: Path):
        _event(tmp_path, "v1.json", "{not json")
        with pytest.raises(ContractNotFoundError, match="No valid contracts"):
            JsonEventContractRepository(tmp_path).list_event_contracts("OrderPlaced")

    def test_get_reports_malformed_json(self, tmp_path: Path):
        _event(tmp_path, "v1.json", "{not json")
        with pytest.raises(InvalidContractError, match="Malformed JSON in v1.json"):
            JsonEventContractRepository(tmp_path).get_event_contract("OrderPlaced", 1)

    def test_get_rejects_a_file_for_another_event_type(self, tmp_path: Path):
        _event(tmp_path, "v1.json", {"eventType": "OrderShipped", "version": 1, "fields": FIELDS})
        with pytest.raises(InvalidContractError, match="eventType 'OrderShipped'"):
            JsonEventContractRepository(tmp_path).get_event_contract("OrderPlaced", 1)

    def test_get_rejects_a_file_whose_version_differs_from_its_name(self, tmp_path: Path):
        _event(tmp_path, "v1.json", {"eventType": "OrderPlaced", "version": 2, "fields": FIELDS})
        with pytest.raises(InvalidContractError, match="has version 2 but expected 1"):
            JsonEventContractRepository(tmp_path).get_event_contract("OrderPlaced", 1)

    def test_unknown_event_type_has_no_versions(self, tmp_path: Path):
        repo = JsonEventContractRepository(tmp_path)
        assert repo.get_event_versions("Nope") == []
        with pytest.raises(ContractNotFoundError):
            repo.get_event_contract("Nope", 1)

    def test_list_event_types_without_events_directory_is_empty(self, tmp_path: Path):
        assert JsonEventContractRepository(tmp_path).list_event_types() == []

    def test_list_event_types_ignores_directories_without_a_readable_contract(self, tmp_path: Path):
        _event(tmp_path, "v1.json", {"eventType": "OrderPlaced", "version": 1, "fields": FIELDS})
        _write(tmp_path / "events" / "broken" / "v1.json", "{not json")
        _write(tmp_path / "events" / "nameless" / "v1.json", {"version": 1})
        assert JsonEventContractRepository(tmp_path).list_event_types() == ["OrderPlaced"]


class TestJsonConsumerContractRepository:
    def _consumer(self, root: Path, name: str, data) -> None:
        _write(root / "consumers" / name, data)

    def test_missing_consumers_directory_means_no_consumers(self, tmp_path: Path):
        repo = JsonConsumerContractRepository(tmp_path)
        assert repo.list_all_consumers() == []
        assert repo.list_consumers("OrderPlaced") == []

    def test_invalid_files_are_skipped(self, tmp_path: Path):
        self._consumer(
            tmp_path,
            "a.json",
            {"consumerId": "a", "eventType": "OrderPlaced", "expectedFields": FIELDS},
        )
        self._consumer(tmp_path, "b.json", "{not json")
        self._consumer(tmp_path, "c.json", {"consumerId": "c", "eventType": "OrderPlaced"})
        (tmp_path / "consumers" / "subdir.json").mkdir()
        repo = JsonConsumerContractRepository(tmp_path)
        assert [c.consumer_id for c in repo.list_all_consumers()] == ["a"]

    def test_duplicate_consumer_id_keeps_the_first_file(self, tmp_path: Path):
        self._consumer(
            tmp_path,
            "a1.json",
            {"consumerId": "a", "eventType": "OrderPlaced", "expectedFields": FIELDS},
        )
        self._consumer(
            tmp_path,
            "a2.json",
            {"consumerId": "a", "eventType": "UserCreated", "expectedFields": FIELDS},
        )
        consumers = JsonConsumerContractRepository(tmp_path).list_all_consumers()
        assert [(c.consumer_id, c.event_type) for c in consumers] == [("a", "OrderPlaced")]

    def test_unknown_consumer_is_not_found(self, tmp_path: Path):
        with pytest.raises(ContractNotFoundError, match="'ghost'"):
            JsonConsumerContractRepository(tmp_path).get_consumer("ghost")
