"""DynamoDB-backed event contract repository for AWS serverless runtime.

Stores event contracts in a DynamoDB table:
  Partition Key (HASH): eventType (String)
  Sort Key (RANGE):      version   (Number)

Access patterns (no table scans):
  - get_event_contract: GetItem(eventType, version)
  - list_event_contracts: Query(eventType)
  - list_event_types: GetItem on the catalog item (eventType="METADATA#CATALOG",
    version=0), which scripts/seed_dynamodb.py maintains.
"""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from eventgate.domain.errors import ContractNotFoundError, UnsupportedEventVersionError
from eventgate.domain.models import EventContract
from eventgate.infrastructure.repositories.contract_parsing import parse_event_contract

logger = logging.getLogger(__name__)

# Item holding the list of registered event types, written by scripts/seed_dynamodb.py.
CATALOG_KEY = {"eventType": "METADATA#CATALOG", "version": Decimal(0)}


class DynamoEventContractRepository:
    """Loads event contracts from Amazon DynamoDB."""

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

    def get_event_contract(self, event_type: str, version: int) -> EventContract:
        """Load a specific event contract version using direct GetItem."""
        try:
            response = self._table.get_item(
                Key={"eventType": event_type, "version": Decimal(str(version))}
            )
        except ClientError as exc:
            logger.error("DynamoDB GetItem failed for %s v%d: %s", event_type, version, exc)
            raise

        item = response.get("Item")
        if not item:
            # Distinguish "unknown version" from "unknown event type" for a precise 404.
            check_query = self._table.query(
                KeyConditionExpression=Key("eventType").eq(event_type),
                Limit=1,
            )
            if check_query.get("Items"):
                raise UnsupportedEventVersionError(event_type, version)
            raise ContractNotFoundError(f"No contracts found for event type '{event_type}'.")

        return parse_event_contract(item, source=f"DynamoDB {event_type}#v{version}")

    def list_event_contracts(self, event_type: str) -> list[EventContract]:
        """Load all versions of an event contract using a Query on eventType."""
        try:
            response = self._table.query(KeyConditionExpression=Key("eventType").eq(event_type))
        except ClientError as exc:
            logger.error("DynamoDB Query failed for %s: %s", event_type, exc)
            raise

        items = response.get("Items", [])
        if not items:
            raise ContractNotFoundError(f"No contracts found for event type '{event_type}'.")

        contracts: list[EventContract] = []
        for item in items:
            contract = parse_event_contract(
                item, source=f"DynamoDB {event_type}#v{item.get('version')}"
            )
            contracts.append(contract)

        contracts.sort(key=lambda c: c.version)
        return contracts

    def list_event_types(self) -> list[str]:
        """Return registered event types from the catalog item (one GetItem, no scan).

        Returns an empty list, with a warning, if the catalog item has not been seeded.
        """
        response = self._table.get_item(Key=CATALOG_KEY)
        item = response.get("Item")
        if not item or "eventTypes" not in item:
            logger.warning(
                "Event catalog item missing from %s; run scripts/seed_dynamodb.py",
                self._table_name,
            )
            return []
        return sorted(str(et) for et in item["eventTypes"])

    def get_event_versions(self, event_type: str) -> list[int]:
        """Return all available version numbers for an event type via targeted Query."""
        try:
            contracts = self.list_event_contracts(event_type)
            return [c.version for c in contracts]
        except ContractNotFoundError:
            return []
