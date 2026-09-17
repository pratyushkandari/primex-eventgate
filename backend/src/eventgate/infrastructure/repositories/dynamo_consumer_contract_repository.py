"""DynamoDB-backed consumer contract repository for AWS serverless runtime.

Stores consumer contracts in a DynamoDB table:
  Partition Key (HASH): consumerId (String)
  Global Secondary Index: EventTypeIndex
    Partition Key (HASH): eventType  (String)
    Sort Key (RANGE):      consumerId (String)

Access patterns:
  - get_consumer: GetItem(consumerId)
  - list_consumers: Query(EventTypeIndex, eventType)
  NO full-table scans.
"""

from __future__ import annotations

import logging
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from eventgate.domain.enums import SUPPORTED_FIELD_TYPES
from eventgate.domain.errors import ContractNotFoundError, InvalidContractError
from eventgate.domain.models import ConsumerContract, ConsumerField

logger = logging.getLogger(__name__)


def _parse_dynamo_consumer_contract(item: dict[str, Any], source: str) -> ConsumerContract:
    """Parse and validate a DynamoDB item into a ConsumerContract."""
    consumer_id = item.get("consumerId")
    if not consumer_id or not isinstance(consumer_id, str):
        raise InvalidContractError(f"Missing or invalid 'consumerId' in {source}.")

    event_type = item.get("eventType")
    if not event_type or not isinstance(event_type, str):
        raise InvalidContractError(f"Missing or invalid 'eventType' in {source}.")

    raw_fields = item.get("expectedFields")
    if not isinstance(raw_fields, dict):
        raise InvalidContractError(f"Missing or invalid 'expectedFields' dict in {source}.")

    expected_fields: dict[str, ConsumerField] = {}
    for name, spec in raw_fields.items():
        if not isinstance(spec, dict):
            raise InvalidContractError(f"Invalid field spec for '{name}' in {source}.")

        field_type = spec.get("type")
        if field_type not in SUPPORTED_FIELD_TYPES:
            raise InvalidContractError(
                f"Unsupported type '{field_type}' for field '{name}' in {source}."
            )

        required = spec.get("required")
        if not isinstance(required, bool):
            raise InvalidContractError(
                f"Missing or invalid 'required' for field '{name}' in {source}."
            )

        expected_fields[name] = ConsumerField(name=name, type=field_type, required=required)

    return ConsumerContract(
        consumer_id=consumer_id,
        event_type=event_type,
        expected_fields=expected_fields,
    )


class DynamoConsumerContractRepository:
    """Loads consumer contracts from Amazon DynamoDB."""

    def __init__(
        self,
        table_name: str,
        dynamodb_resource: Any = None,
        region_name: str | None = None,
    ):
        self._table_name = table_name
        if dynamodb_resource is not None:
            self._dynamodb = dynamodb_resource
        else:
            self._dynamodb = boto3.resource("dynamodb", region_name=region_name)
        self._table = self._dynamodb.Table(table_name)

    def get_consumer(self, consumer_id: str) -> ConsumerContract:
        """Load a specific consumer contract using direct GetItem by consumerId."""
        try:
            response = self._table.get_item(Key={"consumerId": consumer_id})
        except ClientError as exc:
            logger.error("DynamoDB GetItem failed for consumer %s: %s", consumer_id, exc)
            raise

        item = response.get("Item")
        if not item:
            raise ContractNotFoundError(f"Consumer '{consumer_id}' was not found.")

        return _parse_dynamo_consumer_contract(item, source=f"DynamoDB consumer {consumer_id}")

    def list_consumers(self, event_type: str) -> list[ConsumerContract]:
        """Load all consumers subscribed to an event type using Query on EventTypeIndex."""
        try:
            response = self._table.query(
                IndexName="EventTypeIndex",
                KeyConditionExpression=Key("eventType").eq(event_type),
            )
        except ClientError as exc:
            logger.error(
                "DynamoDB Query on EventTypeIndex failed for event_type %s: %s", event_type, exc
            )
            raise

        items = response.get("Items", [])
        consumers: list[ConsumerContract] = []
        for item in items:
            contract = _parse_dynamo_consumer_contract(
                item, source=f"DynamoDB consumer {item.get('consumerId')}"
            )
            consumers.append(contract)

        consumers.sort(key=lambda c: c.consumer_id)
        return consumers
