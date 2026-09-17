"""Unit tests for DynamoEventContractRepository."""

from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from botocore.exceptions import ClientError

from eventgate.domain.errors import (
    ContractNotFoundError,
    InvalidContractError,
    UnsupportedEventVersionError,
)
from eventgate.infrastructure.repositories.dynamo_event_contract_repository import (
    DynamoEventContractRepository,
)


def _make_sample_item(event_type="OrderPlaced", version=1):
    return {
        "eventType": event_type,
        "version": Decimal(str(version)),
        "fields": {
            "orderId": {"type": "string", "required": True},
            "amount": {"type": "number", "required": True},
            "couponCode": {"type": "string", "required": False},
        },
    }


class TestDynamoEventContractRepository:
    def setup_method(self):
        self.mock_table = MagicMock()
        self.mock_resource = MagicMock()
        self.mock_resource.Table.return_value = self.mock_table
        self.repo = DynamoEventContractRepository(
            table_name="test-event-contracts",
            dynamodb_resource=self.mock_resource,
        )

    def test_get_event_contract_success(self):
        self.mock_table.get_item.return_value = {"Item": _make_sample_item("OrderPlaced", 1)}

        contract = self.repo.get_event_contract("OrderPlaced", 1)
        assert contract.event_type == "OrderPlaced"
        assert contract.version == 1
        assert "orderId" in contract.fields
        assert contract.fields["orderId"].type == "string"
        assert contract.fields["orderId"].required is True
        assert contract.fields["couponCode"].required is False

        # Verify GetItem was called with exact partition & sort key
        self.mock_table.get_item.assert_called_once_with(
            Key={"eventType": "OrderPlaced", "version": Decimal("1")}
        )

    def test_get_event_contract_unsupported_version(self):
        # get_item returns None, but query for eventType returns an item
        self.mock_table.get_item.return_value = {}
        self.mock_table.query.return_value = {"Items": [_make_sample_item("OrderPlaced", 1)]}

        with pytest.raises(UnsupportedEventVersionError) as exc_info:
            self.repo.get_event_contract("OrderPlaced", 99)
        assert "99" in str(exc_info.value)

    def test_get_event_contract_unknown_event_type(self):
        # get_item returns None and query returns empty
        self.mock_table.get_item.return_value = {}
        self.mock_table.query.return_value = {"Items": []}

        with pytest.raises(ContractNotFoundError):
            self.repo.get_event_contract("UnknownEvent", 1)

    def test_get_event_contract_client_error(self):
        self.mock_table.get_item.side_effect = ClientError(
            {"Error": {"Code": "ResourceNotFoundException", "Message": "Table not found"}},
            "GetItem",
        )
        with pytest.raises(ClientError):
            self.repo.get_event_contract("OrderPlaced", 1)

    def test_list_event_contracts_success(self):
        self.mock_table.query.return_value = {
            "Items": [
                _make_sample_item("OrderPlaced", 2),
                _make_sample_item("OrderPlaced", 1),
            ]
        }

        contracts = self.repo.list_event_contracts("OrderPlaced")
        assert len(contracts) == 2
        # Must be sorted by version ascending
        assert contracts[0].version == 1
        assert contracts[1].version == 2

    def test_list_event_contracts_not_found(self):
        self.mock_table.query.return_value = {"Items": []}
        with pytest.raises(ContractNotFoundError):
            self.repo.list_event_contracts("NonExistent")

    def test_list_event_contracts_client_error(self):
        self.mock_table.query.side_effect = ClientError(
            {"Error": {"Code": "ProvisionedThroughputExceededException", "Message": "Throttled"}},
            "Query",
        )
        with pytest.raises(ClientError):
            self.repo.list_event_contracts("OrderPlaced")

    # Malformed data validation tests
    def test_malformed_missing_event_type(self):
        self.mock_table.get_item.return_value = {
            "Item": {
                "version": Decimal("1"),
                "fields": {"id": {"type": "string", "required": True}},
            }
        }
        with pytest.raises(InvalidContractError, match="Missing or invalid 'eventType'"):
            self.repo.get_event_contract("OrderPlaced", 1)

    def test_malformed_missing_version(self):
        self.mock_table.get_item.return_value = {
            "Item": {
                "eventType": "OrderPlaced",
                "fields": {"id": {"type": "string", "required": True}},
            }
        }
        with pytest.raises(InvalidContractError, match="Missing 'version'"):
            self.repo.get_event_contract("OrderPlaced", 1)

    def test_malformed_invalid_version_type(self):
        self.mock_table.get_item.return_value = {
            "Item": {"eventType": "OrderPlaced", "version": "invalid", "fields": {}}
        }
        with pytest.raises(InvalidContractError, match="Invalid 'version'"):
            self.repo.get_event_contract("OrderPlaced", 1)

    def test_malformed_version_zero(self):
        self.mock_table.get_item.return_value = {
            "Item": {"eventType": "OrderPlaced", "version": Decimal("0"), "fields": {}}
        }
        with pytest.raises(InvalidContractError, match="Version must be >= 1"):
            self.repo.get_event_contract("OrderPlaced", 1)

    def test_malformed_missing_fields_dict(self):
        self.mock_table.get_item.return_value = {
            "Item": {"eventType": "OrderPlaced", "version": Decimal("1"), "fields": "not-a-dict"}
        }
        with pytest.raises(InvalidContractError, match="Missing or invalid 'fields' dict"):
            self.repo.get_event_contract("OrderPlaced", 1)

    def test_malformed_invalid_field_spec(self):
        self.mock_table.get_item.return_value = {
            "Item": {
                "eventType": "OrderPlaced",
                "version": Decimal("1"),
                "fields": {"id": "invalid"},
            }
        }
        with pytest.raises(InvalidContractError, match="Invalid field spec"):
            self.repo.get_event_contract("OrderPlaced", 1)

    def test_malformed_unsupported_field_type(self):
        self.mock_table.get_item.return_value = {
            "Item": {
                "eventType": "OrderPlaced",
                "version": Decimal("1"),
                "fields": {"id": {"type": "unsupported_type", "required": True}},
            }
        }
        with pytest.raises(InvalidContractError, match="Unsupported type"):
            self.repo.get_event_contract("OrderPlaced", 1)

    def test_malformed_missing_field_required(self):
        self.mock_table.get_item.return_value = {
            "Item": {
                "eventType": "OrderPlaced",
                "version": Decimal("1"),
                "fields": {"id": {"type": "string", "required": "not-a-bool"}},
            }
        }
        with pytest.raises(InvalidContractError, match="Missing or invalid 'required'"):
            self.repo.get_event_contract("OrderPlaced", 1)
