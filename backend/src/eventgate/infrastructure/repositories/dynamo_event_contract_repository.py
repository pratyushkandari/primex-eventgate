"""DynamoDB-backed event contract repository for AWS serverless runtime.

Stores event contracts in a DynamoDB table:
  Partition Key (HASH): eventType (String)
  Sort Key (RANGE):      version   (Number)

Access patterns:
  - get_event_contract: GetItem(eventType, version)
  - list_event_contracts: Query(eventType)
  NO full-table scans.
"""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from eventgate.domain.enums import SUPPORTED_FIELD_TYPES
from eventgate.domain.errors import (
    ContractNotFoundError,
    InvalidContractError,
    UnsupportedEventVersionError,
)
from eventgate.domain.models import EventContract, EventField

logger = logging.getLogger(__name__)


def _parse_dynamo_event_contract(item: dict[str, Any], source: str) -> EventContract:
    """Parse and validate a DynamoDB item into an EventContract."""
    event_type = item.get("eventType")
    if not event_type or not isinstance(event_type, str):
        raise InvalidContractError(f"Missing or invalid 'eventType' in {source}.")

    raw_version = item.get("version")
    if raw_version is None:
        raise InvalidContractError(f"Missing 'version' in {source}.")
    try:
        version = int(raw_version)
    except (ValueError, TypeError):
        raise InvalidContractError(f"Invalid 'version' {raw_version} in {source}.") from None

    if version < 1:
        raise InvalidContractError(f"Version must be >= 1 in {source}.")

    raw_fields = item.get("fields")
    if not isinstance(raw_fields, dict):
        raise InvalidContractError(f"Missing or invalid 'fields' dict in {source}.")

    fields: dict[str, EventField] = {}
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

        fields[name] = EventField(name=name, type=field_type, required=required)

    return EventContract(event_type=event_type, version=version, fields=fields)


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
            # Check if the event type exists at all to return precise domain error
            try:
                check_query = self._table.query(
                    KeyConditionExpression=Key("eventType").eq(event_type),
                    Limit=1,
                )
                if check_query.get("Items"):
                    raise UnsupportedEventVersionError(event_type, version)
            except ClientError:
                pass
            raise ContractNotFoundError(f"No contracts found for event type '{event_type}'.")

        return _parse_dynamo_event_contract(item, source=f"DynamoDB {event_type}#v{version}")

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
            contract = _parse_dynamo_event_contract(
                item, source=f"DynamoDB {event_type}#v{item.get('version')}"
            )
            contracts.append(contract)

        contracts.sort(key=lambda c: c.version)
        return contracts
