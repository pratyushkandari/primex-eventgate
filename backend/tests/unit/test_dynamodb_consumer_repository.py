"""Unit tests for DynamoConsumerContractRepository."""

from unittest.mock import MagicMock

import pytest
from botocore.exceptions import ClientError

from eventgate.domain.errors import ContractNotFoundError, InvalidContractError
from eventgate.infrastructure.repositories.dynamo_consumer_contract_repository import (
    DynamoConsumerContractRepository,
)


def _make_sample_consumer_item(consumer_id="billing-service", event_type="OrderPlaced"):
    return {
        "consumerId": consumer_id,
        "eventType": event_type,
        "expectedFields": {
            "orderId": {"type": "string", "required": True},
            "amount": {"type": "number", "required": True},
            "currency": {"type": "string", "required": False},
        },
    }


class TestDynamoConsumerContractRepository:
    def setup_method(self):
        self.mock_table = MagicMock()
        self.mock_resource = MagicMock()
        self.mock_resource.Table.return_value = self.mock_table
        self.repo = DynamoConsumerContractRepository(
            table_name="test-consumer-contracts",
            dynamodb_resource=self.mock_resource,
        )

    def test_get_consumer_success(self):
        self.mock_table.get_item.return_value = {"Item": _make_sample_consumer_item()}

        consumer = self.repo.get_consumer("billing-service")
        assert consumer.consumer_id == "billing-service"
        assert consumer.event_type == "OrderPlaced"
        assert "orderId" in consumer.expected_fields
        assert consumer.expected_fields["orderId"].type == "string"
        assert consumer.expected_fields["orderId"].required is True
        assert consumer.expected_fields["currency"].required is False

        # Verify GetItem by consumerId
        self.mock_table.get_item.assert_called_once_with(Key={"consumerId": "billing-service"})

    def test_get_consumer_not_found(self):
        self.mock_table.get_item.return_value = {}
        with pytest.raises(ContractNotFoundError, match="was not found"):
            self.repo.get_consumer("non-existent-consumer")

    def test_get_consumer_client_error(self):
        self.mock_table.get_item.side_effect = ClientError(
            {"Error": {"Code": "AccessDeniedException", "Message": "Not authorized"}},
            "GetItem",
        )
        with pytest.raises(ClientError):
            self.repo.get_consumer("billing-service")

    def test_list_consumers_success(self):
        self.mock_table.query.return_value = {
            "Items": [
                _make_sample_consumer_item("inventory-service", "OrderPlaced"),
                _make_sample_consumer_item("billing-service", "OrderPlaced"),
            ]
        }

        consumers = self.repo.list_consumers("OrderPlaced")
        assert len(consumers) == 2
        # Must be sorted by consumer_id
        assert consumers[0].consumer_id == "billing-service"
        assert consumers[1].consumer_id == "inventory-service"

        # Verify Query used EventTypeIndex and KeyCondition
        self.mock_table.query.assert_called_once()
        call_kwargs = self.mock_table.query.call_args[1]
        assert call_kwargs["IndexName"] == "EventTypeIndex"

    def test_list_consumers_empty(self):
        self.mock_table.query.return_value = {"Items": []}
        consumers = self.repo.list_consumers("UnusedEvent")
        assert consumers == []

    def test_list_consumers_client_error(self):
        self.mock_table.query.side_effect = ClientError(
            {"Error": {"Code": "InternalServerError", "Message": "AWS error"}},
            "Query",
        )
        with pytest.raises(ClientError):
            self.repo.list_consumers("OrderPlaced")

    # Malformed data validation tests
    def test_malformed_missing_consumer_id(self):
        self.mock_table.get_item.return_value = {
            "Item": {
                "eventType": "OrderPlaced",
                "expectedFields": {"id": {"type": "string", "required": True}},
            }
        }
        with pytest.raises(InvalidContractError, match="Missing or invalid 'consumerId'"):
            self.repo.get_consumer("billing-service")

    def test_malformed_missing_event_type(self):
        self.mock_table.get_item.return_value = {
            "Item": {
                "consumerId": "billing-service",
                "expectedFields": {"id": {"type": "string", "required": True}},
            }
        }
        with pytest.raises(InvalidContractError, match="Missing or invalid 'eventType'"):
            self.repo.get_consumer("billing-service")

    def test_malformed_missing_expected_fields(self):
        self.mock_table.get_item.return_value = {
            "Item": {
                "consumerId": "billing-service",
                "eventType": "OrderPlaced",
                "expectedFields": None,
            }
        }
        with pytest.raises(InvalidContractError, match="Missing or invalid 'expectedFields' dict"):
            self.repo.get_consumer("billing-service")

    def test_malformed_invalid_field_spec(self):
        self.mock_table.get_item.return_value = {
            "Item": {
                "consumerId": "billing-service",
                "eventType": "OrderPlaced",
                "expectedFields": {"orderId": "not-a-dict"},
            }
        }
        with pytest.raises(InvalidContractError, match="Invalid field spec"):
            self.repo.get_consumer("billing-service")

    def test_malformed_unsupported_field_type(self):
        self.mock_table.get_item.return_value = {
            "Item": {
                "consumerId": "billing-service",
                "eventType": "OrderPlaced",
                "expectedFields": {"orderId": {"type": "complex_number", "required": True}},
            }
        }
        with pytest.raises(InvalidContractError, match="Unsupported type"):
            self.repo.get_consumer("billing-service")

    def test_malformed_missing_field_required(self):
        self.mock_table.get_item.return_value = {
            "Item": {
                "consumerId": "billing-service",
                "eventType": "OrderPlaced",
                "expectedFields": {"orderId": {"type": "string", "required": "yes"}},
            }
        }
        with pytest.raises(InvalidContractError, match="Missing or invalid 'required'"):
            self.repo.get_consumer("billing-service")
