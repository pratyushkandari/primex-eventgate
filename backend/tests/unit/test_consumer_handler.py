"""Unit tests for the demonstration consumer Lambda handler."""

import json
import logging
import sys
from pathlib import Path

# Add consumers/src to sys.path
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
_CONSUMERS_SRC = _REPO_ROOT / "consumers" / "src"
if str(_CONSUMERS_SRC) not in sys.path:
    sys.path.insert(0, str(_CONSUMERS_SRC))

import consumer_handler  # noqa: E402


def test_consumer_handler_logs_and_returns_success(monkeypatch, caplog):
    monkeypatch.setenv("CONSUMER_ID", "inventory-service")

    event = {
        "version": "0",
        "id": "eb-test-id",
        "detail-type": "EventGateEvent",
        "source": "primex.eventgate",
        "account": "123456789012",
        "time": "2026-09-18T00:00:00Z",
        "region": "ap-south-1",
        "detail": {
            "eventId": "evt-uuid-999",
            "eventType": "OrderPlaced",
            "version": 2,
            "decision": "ALLOW",
            "analysisId": "ana-uuid-888",
            "requestId": "req-uuid-777",
            "payload": {"orderId": "O100"},
        },
    }

    with caplog.at_level(logging.INFO, logger="consumer_handler"):
        result = consumer_handler.handler(event, None)

    assert result["statusCode"] == 200
    assert result["consumerId"] == "inventory-service"
    assert result["eventId"] == "evt-uuid-999"
    assert result["status"] == "PROCESSED"

    # Check that structured JSON record was logged
    matching_records = [
        r
        for r in caplog.records
        if "evt-uuid-999" in r.message and "inventory-service" in r.message
    ]
    assert len(matching_records) == 1
    log_data = json.loads(matching_records[0].message)
    assert log_data["consumerId"] == "inventory-service"
    assert log_data["eventId"] == "evt-uuid-999"
    assert log_data["eventType"] == "OrderPlaced"
    assert log_data["version"] == 2
    assert log_data["decision"] == "ALLOW"
    assert log_data["requestId"] == "req-uuid-777"
