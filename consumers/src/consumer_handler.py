"""Lightweight AWS Lambda consumer handler for EventGate event fan-out demonstration."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

logger = logging.getLogger("consumer_handler")
logger.setLevel(logging.INFO)


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Process incoming EventBridge event, log receipt, and return success.

    Never publishes events to prevent event loops.
    """
    consumer_id = os.environ.get("CONSUMER_ID", "unknown-consumer")

    detail = event.get("detail", {})
    event_id = detail.get("eventId")
    event_type = detail.get("eventType")
    version = detail.get("version")
    decision = detail.get("decision")
    request_id = detail.get("requestId")

    record = {
        "consumerId": consumer_id,
        "eventId": event_id,
        "eventType": event_type,
        "version": version,
        "decision": decision,
        "requestId": request_id,
        "message": "Consumer received an EventGate-approved event.",
    }

    logger.info(json.dumps(record))

    return {
        "statusCode": 200,
        "consumerId": consumer_id,
        "eventId": event_id,
        "status": "PROCESSED",
    }
