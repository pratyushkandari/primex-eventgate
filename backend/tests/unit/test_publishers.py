"""Unit tests for EventGate event publisher adapters."""

from unittest.mock import MagicMock

import pytest

from eventgate.domain.errors import EventPublishFailedError
from eventgate.infrastructure.publishers.eventbridge_publisher import EventBridgeEventPublisher
from eventgate.infrastructure.publishers.local_publisher import LocalEventPublisher


def test_local_publisher_records_event() -> None:
    publisher = LocalEventPublisher()
    result = publisher.publish(
        event_id="evt-123",
        event_type="OrderPlaced",
        version=2,
        decision="ALLOW",
        analysis_id="ana-456",
        request_id="req-789",
        payload={"orderId": "O1"},
    )

    assert result.event_id == "evt-123"
    assert result.published is True
    assert result.event_bridge_event_id is not None
    assert result.event_bridge_event_id.startswith("local-eb-")
    assert len(publisher.published_events) == 1

    record = publisher.published_events[0]
    assert record.event_id == "evt-123"
    assert record.decision == "ALLOW"
    assert record.payload == {"orderId": "O1"}

    publisher.clear()
    assert len(publisher.published_events) == 0


def test_eventbridge_publisher_success() -> None:
    mock_client = MagicMock()
    mock_client.put_events.return_value = {
        "FailedEntryCount": 0,
        "Entries": [{"EventId": "eb-real-uuid-123"}],
    }

    publisher = EventBridgeEventPublisher(
        bus_name="test-bus",
        eventbridge_client=mock_client,
    )

    result = publisher.publish(
        event_id="evt-123",
        event_type="OrderPlaced",
        version=2,
        decision="ALLOW",
        analysis_id="ana-456",
        request_id="req-789",
        payload={"orderId": "O1"},
    )

    assert result.event_id == "evt-123"
    assert result.published is True
    assert result.event_bridge_event_id == "eb-real-uuid-123"

    mock_client.put_events.assert_called_once()
    call_args = mock_client.put_events.call_args[1]
    entries = call_args["Entries"]
    assert len(entries) == 1
    assert entries[0]["EventBusName"] == "test-bus"
    assert entries[0]["Source"] == "primex.eventgate"
    assert entries[0]["DetailType"] == "EventGateEvent"


def test_eventbridge_publisher_failed_entry_count_raises() -> None:
    mock_client = MagicMock()
    mock_client.put_events.return_value = {
        "FailedEntryCount": 1,
        "Entries": [{"ErrorCode": "InternalFailure", "ErrorMessage": "Service unavailable"}],
    }

    publisher = EventBridgeEventPublisher(
        bus_name="test-bus",
        eventbridge_client=mock_client,
    )

    with pytest.raises(EventPublishFailedError, match="The event could not be published"):
        publisher.publish(
            event_id="evt-123",
            event_type="OrderPlaced",
            version=2,
            decision="ALLOW",
            analysis_id="ana-456",
            request_id="req-789",
            payload={"orderId": "O1"},
        )


def test_eventbridge_publisher_missing_event_id_raises() -> None:
    # Edge case requested by user: FailedEntryCount == 0, but no EventId in entry
    mock_client = MagicMock()
    mock_client.put_events.return_value = {
        "FailedEntryCount": 0,
        "Entries": [{"EventId": None}],
    }

    publisher = EventBridgeEventPublisher(
        bus_name="test-bus",
        eventbridge_client=mock_client,
    )

    with pytest.raises(EventPublishFailedError, match="The event could not be published"):
        publisher.publish(
            event_id="evt-123",
            event_type="OrderPlaced",
            version=2,
            decision="ALLOW",
            analysis_id="ana-456",
            request_id="req-789",
            payload={"orderId": "O1"},
        )


def test_eventbridge_publisher_api_exception_raises() -> None:
    mock_client = MagicMock()
    mock_client.put_events.side_effect = RuntimeError("Network error")

    publisher = EventBridgeEventPublisher(
        bus_name="test-bus",
        eventbridge_client=mock_client,
    )

    with pytest.raises(EventPublishFailedError, match="The event could not be published"):
        publisher.publish(
            event_id="evt-123",
            event_type="OrderPlaced",
            version=2,
            decision="ALLOW",
            analysis_id="ana-456",
            request_id="req-789",
            payload={"orderId": "O1"},
        )
