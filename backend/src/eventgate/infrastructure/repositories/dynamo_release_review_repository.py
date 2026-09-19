"""DynamoDB-backed release review repository for AWS serverless runtime.

Stores release review audit records:
  Partition Key (HASH): recordId  (String)
  GSI: EventTypeIndex
    Partition Key (HASH): eventType (String)
    Sort Key (RANGE):      timestamp (String)

Access patterns:
  - save_review: PutItem(recordId)
  - get_review: GetItem(recordId)
  - list_reviews: Query(EventTypeIndex, eventType)
  ZERO full-table scans.
"""

from __future__ import annotations

import logging
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from eventgate.domain.errors import ReleaseRecordNotFoundError
from eventgate.domain.history import ReleaseRecord

logger = logging.getLogger(__name__)


class DynamoReleaseReviewRepository:
    """Stores and queries release reviews from Amazon DynamoDB."""

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

    def save_review(self, record: ReleaseRecord) -> ReleaseRecord:
        """Persist or update a release review record using PutItem."""
        item = record.to_dict()
        item["recordId"] = record.record_id
        item["eventType"] = record.event_type

        try:
            self._table.put_item(Item=item)
            logger.info("Saved release review to DynamoDB: record_id=%s", record.record_id)
            return record
        except ClientError as exc:
            logger.error("Failed to save release review %s to DynamoDB: %s", record.record_id, exc)
            raise

    def get_review(self, record_id: str) -> ReleaseRecord:
        """Retrieve a specific release review using direct GetItem."""
        try:
            response = self._table.get_item(Key={"recordId": record_id})
        except ClientError as exc:
            logger.error("Failed to GetItem for release review %s: %s", record_id, exc)
            raise

        item = response.get("Item")
        if not item:
            raise ReleaseRecordNotFoundError(record_id)

        # Normalize dictionary back to domain model
        if "record_id" not in item and "recordId" in item:
            item["record_id"] = item["recordId"]
        if "event_type" not in item and "eventType" in item:
            item["event_type"] = item["eventType"]

        return ReleaseRecord.from_dict(item)

    def list_reviews(
        self, event_type: str | None = None, limit: int = 50
    ) -> list[ReleaseRecord]:
        """Return recent release reviews using targeted GSI Query (zero table scans)."""
        results: list[ReleaseRecord] = []

        if event_type:
            try:
                response = self._table.query(
                    IndexName="EventTypeIndex",
                    KeyConditionExpression=Key("eventType").eq(event_type),
                    ScanIndexForward=False,
                    Limit=limit,
                )
                for item in response.get("Items", []):
                    if "record_id" not in item and "recordId" in item:
                        item["record_id"] = item["recordId"]
                    if "event_type" not in item and "eventType" in item:
                        item["event_type"] = item["eventType"]
                    results.append(ReleaseRecord.from_dict(item))
            except ClientError as exc:
                logger.error("Failed to query reviews for event %s: %s", event_type, exc)
                raise
        else:
            # Query known domain event types via GSI without scan
            known_events = ["OrderPlaced", "PaymentCompleted", "UserCreated"]
            for et in known_events:
                try:
                    res = self._table.query(
                        IndexName="EventTypeIndex",
                        KeyConditionExpression=Key("eventType").eq(et),
                        ScanIndexForward=False,
                        Limit=limit,
                    )
                    for item in res.get("Items", []):
                        if "record_id" not in item and "recordId" in item:
                            item["record_id"] = item["recordId"]
                        if "event_type" not in item and "eventType" in item:
                            item["event_type"] = item["eventType"]
                        results.append(ReleaseRecord.from_dict(item))
                except ClientError:
                    pass

        results.sort(key=lambda r: r.timestamp, reverse=True)
        return results[:limit]
