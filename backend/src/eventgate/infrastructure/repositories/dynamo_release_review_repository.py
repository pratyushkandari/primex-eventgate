"""Release history stored in DynamoDB.

Table: partition key recordId (String).
GSI EventTypeIndex: partition key eventType, sort key timestamp (ISO-8601 string).

Access patterns (no table scans):
  - save_review: PutItem(recordId)
  - get_review: GetItem(recordId)
  - list_reviews(event_type): Query(EventTypeIndex) newest first
  - list_reviews(None): one such Query per registered event type, merged. The
    event types come from the injected provider (the event contract catalog),
    because history alone cannot enumerate its partitions without a scan.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key

from eventgate.domain.errors import ReleaseRecordNotFoundError
from eventgate.domain.history import ReleaseRecord

logger = logging.getLogger(__name__)


def _item_to_record(item: dict[str, Any]) -> ReleaseRecord:
    item.setdefault("record_id", item.get("recordId"))
    item.setdefault("event_type", item.get("eventType"))
    return ReleaseRecord.from_dict(item)


class DynamoReleaseReviewRepository:
    """Stores and queries release reviews in Amazon DynamoDB."""

    def __init__(
        self,
        table_name: str,
        dynamodb_resource: Any = None,
        region_name: str | None = None,
        event_types_provider: Callable[[], list[str]] | None = None,
    ):
        self._table_name = table_name
        self._dynamodb = dynamodb_resource or boto3.resource("dynamodb", region_name=region_name)
        self._table = self._dynamodb.Table(table_name)
        self._event_types_provider = event_types_provider

    def save_review(self, record: ReleaseRecord) -> ReleaseRecord:
        """Insert or replace the record keyed by record_id."""
        item = record.to_dict()
        item["recordId"] = record.record_id
        item["eventType"] = record.event_type
        self._table.put_item(Item=item)
        logger.info("Saved release review to DynamoDB: record_id=%s", record.record_id)
        return record

    def get_review(self, record_id: str) -> ReleaseRecord:
        """Return the record; raises ReleaseRecordNotFoundError if absent."""
        item = self._table.get_item(Key={"recordId": record_id}).get("Item")
        if not item:
            raise ReleaseRecordNotFoundError(record_id)
        return _item_to_record(item)

    def list_reviews(self, event_type: str | None = None, limit: int = 50) -> list[ReleaseRecord]:
        """Return the newest records first, optionally for one event type."""
        if event_type:
            event_types = [event_type]
        elif self._event_types_provider is not None:
            event_types = self._event_types_provider()
        else:
            logger.warning("No event type provider configured; cannot list all history")
            event_types = []

        results: list[ReleaseRecord] = []
        for et in event_types:
            response = self._table.query(
                IndexName="EventTypeIndex",
                KeyConditionExpression=Key("eventType").eq(et),
                ScanIndexForward=False,
                Limit=limit,
            )
            results.extend(_item_to_record(item) for item in response.get("Items", []))

        results.sort(key=lambda r: r.timestamp, reverse=True)
        return results[:limit]
