"""Unit tests for EventPublishService and enforcement invariants."""

from unittest.mock import MagicMock

import pytest

from eventgate.application.ports.publisher import EventPublishResult
from eventgate.application.services.event_publish_service import EventPublishService
from eventgate.domain.enums import Decision, Severity
from eventgate.domain.errors import InvalidEventPayloadError
from eventgate.domain.models import (
    AnalysisResult,
    ChangeSet,
    EventContract,
    EventField,
)


@pytest.fixture
def mock_event_repo() -> MagicMock:
    repo = MagicMock()

    # Return contracts based on version
    def get_contract(event_type: str, version: int) -> EventContract:
        if version == 2:
            return EventContract(
                event_type="OrderPlaced",
                version=2,
                fields={
                    "orderId": EventField("orderId", "string", True),
                    "amount": EventField("amount", "number", True),
                },
            )
        if version == 3:
            return EventContract(
                event_type="OrderPlaced",
                version=3,
                fields={
                    "orderId": EventField("orderId", "string", True),
                    "amount": EventField("amount", "number", True),
                    "shippingMethod": EventField("shippingMethod", "object", True),
                },
            )
        if version == 4:
            return EventContract(
                event_type="OrderPlaced",
                version=4,
                fields={
                    "orderId": EventField("orderId", "string", True),
                    "amount": EventField("amount", "number", True),
                },
            )
        return EventContract(
            event_type="OrderPlaced",
            version=1,
            fields={
                "orderId": EventField("orderId", "string", True),
                "amount": EventField("amount", "number", True),
            },
        )

    repo.get_event_contract.side_effect = get_contract
    return repo


@pytest.fixture
def mock_analysis_service() -> MagicMock:
    return MagicMock()


@pytest.fixture
def mock_publisher() -> MagicMock:
    pub = MagicMock()
    pub.publish.return_value = EventPublishResult(
        event_id="test-event-id",
        published=True,
        event_bridge_event_id="eb-12345",
    )
    return pub


def test_allow_calls_publisher_once(
    mock_event_repo: MagicMock,
    mock_analysis_service: MagicMock,
    mock_publisher: MagicMock,
) -> None:
    """Invariant: ALLOW decision must call the event publisher exactly once."""
    mock_analysis_service.analyze.return_value = AnalysisResult(
        analysis_id="ana-1",
        event_type="OrderPlaced",
        current_version=1,
        proposed_version=2,
        change_set=ChangeSet(),
        findings=[],
        decision=Decision.ALLOW,
        severity=Severity.LOW,
        summary="Safe change",
    )

    service = EventPublishService(
        event_repo=mock_event_repo,
        analysis_service=mock_analysis_service,
        publisher=mock_publisher,
    )

    valid_payload = {"orderId": "O100", "amount": 250.0}
    result = service.publish_event(
        event_type="OrderPlaced",
        current_version=1,
        proposed_version=2,
        payload=valid_payload,
        request_id="req-1",
    )

    assert result.published is True
    assert result.decision == Decision.ALLOW
    assert result.event_bridge_event_id == "eb-12345"
    mock_publisher.publish.assert_called_once()

    call_kwargs = mock_publisher.publish.call_args[1]
    assert call_kwargs["event_type"] == "OrderPlaced"
    assert call_kwargs["version"] == 2
    assert call_kwargs["decision"] == "ALLOW"
    assert call_kwargs["request_id"] == "req-1"
    assert call_kwargs["payload"] == valid_payload


def test_block_does_not_call_publisher(
    mock_event_repo: MagicMock,
    mock_analysis_service: MagicMock,
    mock_publisher: MagicMock,
) -> None:
    """Invariant: BLOCK decision must NEVER call the event publisher."""
    mock_analysis_service.analyze.return_value = AnalysisResult(
        analysis_id="ana-2",
        event_type="OrderPlaced",
        current_version=1,
        proposed_version=3,
        change_set=ChangeSet(),
        findings=[],
        decision=Decision.BLOCK,
        severity=Severity.HIGH,
        summary="Breaking change",
    )

    service = EventPublishService(
        event_repo=mock_event_repo,
        analysis_service=mock_analysis_service,
        publisher=mock_publisher,
    )

    payload_conforming_to_v3 = {
        "orderId": "O100",
        "amount": 250.0,
        "shippingMethod": {"carrier": "FedEx"},
    }

    result = service.publish_event(
        event_type="OrderPlaced",
        current_version=1,
        proposed_version=3,
        payload=payload_conforming_to_v3,
        request_id="req-2",
    )

    assert result.published is False
    assert result.decision == Decision.BLOCK
    assert result.event_bridge_event_id is None
    # Publisher must NOT be called
    mock_publisher.publish.assert_not_called()


def test_review_does_not_call_publisher(
    mock_event_repo: MagicMock,
    mock_analysis_service: MagicMock,
    mock_publisher: MagicMock,
) -> None:
    """Invariant: REVIEW decision must NEVER call the event publisher."""
    mock_analysis_service.analyze.return_value = AnalysisResult(
        analysis_id="ana-3",
        event_type="OrderPlaced",
        current_version=1,
        proposed_version=4,
        change_set=ChangeSet(),
        findings=[],
        decision=Decision.REVIEW,
        severity=Severity.MEDIUM,
        summary="Risky change",
    )

    service = EventPublishService(
        event_repo=mock_event_repo,
        analysis_service=mock_analysis_service,
        publisher=mock_publisher,
    )

    payload_conforming_to_v4 = {"orderId": "O100", "amount": 250.0}

    result = service.publish_event(
        event_type="OrderPlaced",
        current_version=1,
        proposed_version=4,
        payload=payload_conforming_to_v4,
        request_id="req-3",
    )

    assert result.published is False
    assert result.decision == Decision.REVIEW
    assert result.event_bridge_event_id is None
    # Publisher must NOT be called
    mock_publisher.publish.assert_not_called()


def test_invalid_payload_does_not_call_publisher(
    mock_event_repo: MagicMock,
    mock_analysis_service: MagicMock,
    mock_publisher: MagicMock,
) -> None:
    """Invariant: Malformed payload must fail early and never call analysis or publisher."""
    service = EventPublishService(
        event_repo=mock_event_repo,
        analysis_service=mock_analysis_service,
        publisher=mock_publisher,
    )

    invalid_payload = {"orderId": "O100", "amount": "string-not-number"}

    with pytest.raises(InvalidEventPayloadError, match="Field 'amount' must be of type 'number'"):
        service.publish_event(
            event_type="OrderPlaced",
            current_version=1,
            proposed_version=2,
            payload=invalid_payload,
        )

    # Neither analysis nor publisher should be called on payload error
    mock_analysis_service.analyze.assert_not_called()
    mock_publisher.publish.assert_not_called()
