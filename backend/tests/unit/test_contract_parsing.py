"""Shared contract parsing, environment parsing and version-file resolution."""

from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path

import pytest

from eventgate.domain.enums import Environment
from eventgate.domain.errors import (
    InvalidAnalysisRequestError,
    InvalidContractError,
    UnsupportedEventVersionError,
)
from eventgate.infrastructure.repositories.contract_parsing import (
    parse_consumer_contract,
    parse_event_contract,
)
from eventgate.infrastructure.repositories.event_contract_repository import (
    JsonEventContractRepository,
)

FIELDS = {"orderId": {"type": "string", "required": True}}


class TestParseEventContract:
    def test_accepts_int_and_integral_decimal_versions(self):
        assert (
            parse_event_contract({"eventType": "E", "version": 2, "fields": FIELDS}, "s").version
            == 2
        )
        dynamo_item = {"eventType": "E", "version": Decimal("3"), "fields": FIELDS}
        assert parse_event_contract(dynamo_item, "s").version == 3

    @pytest.mark.parametrize("version", [True, "1", 1.5, Decimal("1.5"), 0, -1, None])
    def test_rejects_invalid_versions(self, version):
        with pytest.raises(InvalidContractError, match="(?i)version"):
            parse_event_contract({"eventType": "E", "version": version, "fields": FIELDS}, "s")

    def test_error_names_the_source(self):
        with pytest.raises(InvalidContractError, match="orders/v9.json"):
            parse_event_contract({"version": 1, "fields": FIELDS}, "orders/v9.json")

    @pytest.mark.parametrize(
        "spec, message",
        [
            ("string", "Invalid field spec"),
            ({"type": "date", "required": True}, "Unsupported type"),
            ({"type": "string"}, "required"),
            ({"type": "string", "required": "yes"}, "required"),
        ],
    )
    def test_rejects_bad_field_specs(self, spec, message):
        with pytest.raises(InvalidContractError, match=message):
            parse_event_contract({"eventType": "E", "version": 1, "fields": {"f": spec}}, "s")


class TestParseConsumerContract:
    def test_valid(self):
        c = parse_consumer_contract(
            {"consumerId": "c", "eventType": "E", "expectedFields": FIELDS}, "s"
        )
        assert c.expected_fields["orderId"].required is True

    def test_missing_event_type(self):
        with pytest.raises(InvalidContractError, match="eventType"):
            parse_consumer_contract({"consumerId": "c", "expectedFields": FIELDS}, "s")


class TestEnvironmentParse:
    @pytest.mark.parametrize("raw", ["production", "Production", " STAGING ", "development"])
    def test_known_names_normalize(self, raw):
        assert Environment.parse(raw).value == raw.strip().lower()

    def test_none_defaults_to_production(self):
        assert Environment.parse(None) is Environment.PRODUCTION

    @pytest.mark.parametrize("raw", ["prod", "qa", "", "dev"])
    def test_unknown_names_raise(self, raw):
        with pytest.raises(InvalidAnalysisRequestError, match="Unknown environment"):
            Environment.parse(raw)


class TestVersionFileResolution:
    def _write(self, root: Path, name: str, version: int) -> None:
        d = root / "events" / "order-placed"
        d.mkdir(parents=True, exist_ok=True)
        (d / name).write_text(
            json.dumps({"eventType": "OrderPlaced", "version": version, "fields": FIELDS}),
            encoding="utf-8",
        )

    def test_v1_does_not_match_v10(self, tmp_path: Path):
        self._write(tmp_path, "v10.json", 10)
        repo = JsonEventContractRepository(tmp_path)
        with pytest.raises(UnsupportedEventVersionError):
            repo.get_event_contract("OrderPlaced", 1)
        assert repo.get_event_contract("OrderPlaced", 10).version == 10

    def test_descriptive_suffix_is_allowed(self, tmp_path: Path):
        self._write(tmp_path, "v2-safe.json", 2)
        assert (
            JsonEventContractRepository(tmp_path).get_event_contract("OrderPlaced", 2).version == 2
        )

    def test_two_files_for_one_version_is_an_error(self, tmp_path: Path):
        self._write(tmp_path, "v2.json", 2)
        self._write(tmp_path, "v2-copy.json", 2)
        with pytest.raises(InvalidContractError, match="Multiple files"):
            JsonEventContractRepository(tmp_path).get_event_contract("OrderPlaced", 2)
