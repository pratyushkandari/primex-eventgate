"""AWS EventBridge event publisher implementation."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any

import boto3

from eventgate.application.ports.publisher import EventPublishResult
from eventgate.domain.errors import EventPublishFailedError

logger = logging.getLogger(__name__)


class EventBridgeEventPublisher:
    """Publishes approved events to an Amazon EventBridge custom event bus."""

    def __init__(
        self,
        bus_name: str,
        region_name: str | None = None,
        eventbridge_client: Any = None,
    ):
        self._bus_name = bus_name
        self._region_name = region_name
        self._client = eventbridge_client or boto3.client("events", region_name=region_name)

    def publish(
        self,
        event_id: str,
        event_type: str,
        version: int,
        decision: str,
        analysis_id: str,
        request_id: str | None,
        payload: dict[str, Any],
    ) -> EventPublishResult:
        """Translate event into EventBridge PutEvents call and dispatch.

        Raises:
            EventPublishFailedError: If the PutEvents API fails, returns FailedEntryCount > 0,
                or fails to return an EventId.
        """
        detail = {
            "eventId": event_id,
            "eventType": event_type,
            "version": version,
            "decision": decision,
            "analysisId": analysis_id,
            "requestId": request_id,
            "payload": payload,
        }

        entry = {
            "Source": "primex.eventgate",
            "DetailType": "EventGateEvent",
            "EventBusName": self._bus_name,
            "Detail": json.dumps(detail),
        }

        try:
            response = self._client.put_events(Entries=[entry])
        except Exception as exc:
            logger.exception("EventBridge PutEvents API call failed: %s", exc)
            raise EventPublishFailedError("The event could not be published.") from exc

        failed_count = response.get("FailedEntryCount", 0)
        entries = response.get("Entries", [])

        if failed_count > 0 or not entries:
            error_msg = "Unknown EventBridge error"
            if entries:
                error_msg = entries[0].get("ErrorMessage", entries[0].get("ErrorCode", error_msg))
            logger.error(
                "EventBridge PutEvents returned FailedEntryCount=%d: %s",
                failed_count,
                error_msg,
            )
            raise EventPublishFailedError("The event could not be published.")

        eb_entry = entries[0]
        eb_event_id = eb_entry.get("EventId")
        if not eb_event_id:
            logger.error("EventBridge PutEvents returned entry without EventId: %s", eb_entry)
            raise EventPublishFailedError("The event could not be published.")

        logger.info(
            "Event published to EventBridge: bus=%s eventId=%s ebEventId=%s",
            self._bus_name,
            event_id,
            eb_event_id,
        )

        return EventPublishResult(
            event_id=event_id,
            published=True,
            event_bridge_event_id=eb_event_id,
            timestamp=datetime.now(UTC),
        )
