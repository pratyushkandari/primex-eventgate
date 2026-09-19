import sys
from decimal import Decimal
from pathlib import Path
from unittest.mock import MagicMock

import pytest

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from scripts.seed_dynamodb import (  # noqa: E402
    seed_dynamodb,
    validate_consumer_contract_data,
    validate_event_contract_data,
)

_CONTRACTS_DIR = _PROJECT_ROOT / "contracts"


class TestSeedValidation:
    def test_validate_event_contract_data_valid(self):
        data = {
            "eventType": "OrderPlaced",
            "version": 1,
            "fields": {
                "orderId": {"type": "string", "required": True},
                "amount": {"type": "number", "required": True},
            },
        }
        validated = validate_event_contract_data(data, Path("test.json"))
        assert validated["eventType"] == "OrderPlaced"
        assert validated["version"] == Decimal("1")
        assert "orderId" in validated["fields"]

    def test_validate_event_contract_missing_eventType(self):
        data = {"version": 1, "fields": {"id": {"type": "string", "required": True}}}
        with pytest.raises(ValueError, match="Invalid or missing 'eventType'"):
            validate_event_contract_data(data, Path("test.json"))

    def test_validate_event_contract_invalid_version(self):
        data = {
            "eventType": "OrderPlaced",
            "version": 0,
            "fields": {"id": {"type": "string", "required": True}},
        }
        with pytest.raises(ValueError, match="Invalid or missing 'version'"):
            validate_event_contract_data(data, Path("test.json"))

    def test_validate_event_contract_unsupported_field_type(self):
        data = {
            "eventType": "OrderPlaced",
            "version": 1,
            "fields": {"id": {"type": "invalid_type", "required": True}},
        }
        with pytest.raises(ValueError, match="Unsupported field type"):
            validate_event_contract_data(data, Path("test.json"))

    def test_validate_consumer_contract_data_valid(self):
        data = {
            "consumerId": "billing-service",
            "eventType": "OrderPlaced",
            "expectedFields": {
                "orderId": {"type": "string", "required": True},
            },
        }
        validated = validate_consumer_contract_data(data, Path("test.json"))
        assert validated["consumerId"] == "billing-service"
        assert validated["eventType"] == "OrderPlaced"
        assert "orderId" in validated["expectedFields"]

    def test_validate_consumer_contract_missing_consumerId(self):
        data = {
            "eventType": "OrderPlaced",
            "expectedFields": {"id": {"type": "string", "required": True}},
        }
        with pytest.raises(ValueError, match="Invalid or missing 'consumerId'"):
            validate_consumer_contract_data(data, Path("test.json"))


class TestSeedDynamoDBExecution:
    def test_seed_dynamodb_with_mock_resource(self):
        mock_event_table = MagicMock()
        mock_consumer_table = MagicMock()
        mock_resource = MagicMock()

        def table_side_effect(name):
            if "event" in name:
                return mock_event_table
            return mock_consumer_table

        mock_resource.Table.side_effect = table_side_effect

        # Seed from real repo contracts dir
        result = seed_dynamodb(
            event_table_name="test-events",
            consumer_table_name="test-consumers",
            contracts_dir=_CONTRACTS_DIR,
            dynamodb_resource=mock_resource,
        )

        expected_events = len(list((_CONTRACTS_DIR / "events").rglob("*.json")))
        expected_consumers = len(list((_CONTRACTS_DIR / "consumers").glob("*.json")))

        assert result["event_contracts"] == expected_events
        assert result["consumer_contracts"] == expected_consumers
        assert mock_event_table.put_item.call_count == expected_events
        assert mock_consumer_table.put_item.call_count == expected_consumers

    def test_seed_idempotency(self):
        """Executing seed_dynamodb multiple times safely overwrites without error."""
        mock_event_table = MagicMock()
        mock_consumer_table = MagicMock()
        mock_resource = MagicMock()

        def table_side_effect(name):
            if "event" in name:
                return mock_event_table
            return mock_consumer_table

        mock_resource.Table.side_effect = table_side_effect

        # Run 1
        res1 = seed_dynamodb(
            event_table_name="test-events",
            consumer_table_name="test-consumers",
            contracts_dir=_CONTRACTS_DIR,
            dynamodb_resource=mock_resource,
        )

        # Run 2
        res2 = seed_dynamodb(
            event_table_name="test-events",
            consumer_table_name="test-consumers",
            contracts_dir=_CONTRACTS_DIR,
            dynamodb_resource=mock_resource,
        )

        expected_events = len(list((_CONTRACTS_DIR / "events").rglob("*.json")))
        expected_consumers = len(list((_CONTRACTS_DIR / "consumers").glob("*.json")))

        assert res1 == res2
        assert mock_event_table.put_item.call_count == expected_events * 2
        assert mock_consumer_table.put_item.call_count == expected_consumers * 2
