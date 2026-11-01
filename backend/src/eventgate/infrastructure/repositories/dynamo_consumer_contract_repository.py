"""DynamoDB-backed consumer contract repository for AWS serverless runtime.

Stores consumer contracts in a DynamoDB table:
  Partition Key (HASH): consumerId (String)
  Global Secondary Index: EventTypeIndex
    Partition Key (HASH): eventType  (String)
    Sort Key (RANGE):      consumerId (String)

Access patterns (no table scans):
  - get_consumer: GetItem(consumerId)
  - list_consumers: Query(EventTypeIndex, eventType)
  - list_all_consumers: GetItem on the catalog item (consumerId="METADATA#CATALOG"),
    then GetItem per listed consumer.
"""

from __future__ import annotations

import logging
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from eventgate.domain.errors import ContractNotFoundError
from eventgate.domain.models import ConsumerContract
from eventgate.infrastructure.repositories.contract_parsing import parse_consumer_contract

logger = logging.getLogger(__name__)

# Item holding the list of registered consumer IDs, written by scripts/seed_dynamodb.py.
# It has no eventType attribute, so it never appears in EventTypeIndex.
CATALOG_KEY = {"consumerId": "METADATA#CATALOG"}


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

        return parse_consumer_contract(item, source=f"DynamoDB consumer {consumer_id}")

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
            contract = parse_consumer_contract(
                item, source=f"DynamoDB consumer {item.get('consumerId')}"
            )
            consumers.append(contract)

        consumers.sort(key=lambda c: c.consumer_id)
        return consumers

    def list_all_consumers(self) -> list[ConsumerContract]:
        """Return every consumer listed in the catalog item, sorted by ID.

        Returns an empty list, with a warning, if the catalog item has not been seeded.
        """
        response = self._table.get_item(Key=CATALOG_KEY)
        item = response.get("Item")
        if not item or "consumerIds" not in item:
            logger.warning(
                "Consumer catalog item missing from %s; run scripts/seed_dynamodb.py",
                self._table_name,
            )
            return []

        consumers: list[ConsumerContract] = []
        for consumer_id in item["consumerIds"]:
            try:
                consumers.append(self.get_consumer(str(consumer_id)))
            except ContractNotFoundError:
                logger.warning("Catalog lists consumer '%s' but it has no item", consumer_id)
        consumers.sort(key=lambda c: c.consumer_id)
        return consumers
