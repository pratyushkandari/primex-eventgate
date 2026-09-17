"""Integration tests for the EventGate publish endpoint (POST /api/v1/events/publish)."""

import pytest
from fastapi.testclient import TestClient

from eventgate.api.dependencies import get_event_publisher
from eventgate.domain.errors import EventPublishFailedError
from eventgate.main import app


@pytest.fixture
def client():
    return TestClient(app)


# ---------------------------------------------------------------------------
# Golden Scenarios: Gated Publication
# ---------------------------------------------------------------------------


class TestPublishEndpointGoldenScenarios:
    def test_scenario_a_safe_publishes_successfully(self, client: TestClient):
        """Scenario A (v1 -> v2): Safe change must return 200 OK and published=True."""
        payload = {
            "orderId": "O1001",
            "amount": 500,
            "items": [{"sku": "SKU-001", "quantity": 1}],
            "shippingMethod": "FedEx",
            "couponCode": "SAVE10",
            "metadata": {"channel": "web"},
        }
        resp = client.post(
            "/api/v1/events/publish",
            json={
                "eventType": "OrderPlaced",
                "currentVersion": 1,
                "proposedVersion": 2,
                "payload": payload,
            },
            headers={"X-Request-ID": "test-publish-safe-123"},
        )

        assert resp.status_code == 200
        assert resp.headers.get("x-request-id") == "test-publish-safe-123"

        data = resp.json()
        assert data["published"] is True
        assert data["decision"] == "ALLOW"
        assert data["severity"] == "LOW"
        assert "eventId" in data
        assert data["eventBridgeEventId"] is not None
        assert "analysis" in data
        assert data["analysis"]["decision"] == "ALLOW"

    def test_scenario_b_breaking_prevents_publication_returns_409(self, client: TestClient):
        """Scenario B (v1 -> v3): Breaking change must return 409 Conflict and published=False."""
        payload = {
            "orderId": "O1001",
            "amount": 500,
            "items": [{"sku": "SKU-001", "quantity": 1}],
            "shippingMethod": {"carrier": "FedEx", "trackingCode": "TRK-1001"},
            "couponCode": "SAVE10",
        }
        resp = client.post(
            "/api/v1/events/publish",
            json={
                "eventType": "OrderPlaced",
                "currentVersion": 1,
                "proposedVersion": 3,
                "payload": payload,
            },
            headers={"X-Request-ID": "test-publish-break-123"},
        )

        assert resp.status_code == 409
        assert resp.headers.get("x-request-id") == "test-publish-break-123"

        data = resp.json()
        assert data["published"] is False
        assert data["decision"] == "BLOCK"
        assert data["severity"] == "HIGH"
        assert data["eventBridgeEventId"] is None
        assert "analysis" in data
        assert data["analysis"]["decision"] == "BLOCK"

        findings = data["analysis"]["findings"]
        inv_findings = [f for f in findings if f["consumerId"] == "inventory-service"]
        assert any(
            f["status"] == "BREAK" and f["ruleId"] == "EVT001_FIELD_TYPE_CHANGED"
            for f in inv_findings
        )

    def test_scenario_c_risk_prevents_publication_returns_409(self, client: TestClient):
        """Scenario C (v1 -> v4): Risky change must return 409 Conflict and published=False."""
        payload = {
            "orderId": "O1001",
            "amount": 500,
            "items": [{"sku": "SKU-001", "quantity": 1}],
            "shippingMethod": "FedEx",
        }
        resp = client.post(
            "/api/v1/events/publish",
            json={
                "eventType": "OrderPlaced",
                "currentVersion": 1,
                "proposedVersion": 4,
                "payload": payload,
            },
            headers={"X-Request-ID": "test-publish-risk-123"},
        )

        assert resp.status_code == 409
        assert resp.headers.get("x-request-id") == "test-publish-risk-123"

        data = resp.json()
        assert data["published"] is False
        assert data["decision"] == "REVIEW"
        assert data["severity"] == "MEDIUM"
        assert data["eventBridgeEventId"] is None
        assert "analysis" in data
        assert data["analysis"]["decision"] == "REVIEW"

        findings = data["analysis"]["findings"]
        ana_findings = [f for f in findings if f["consumerId"] == "analytics-service"]
        assert any(
            f["status"] == "RISK" and f["ruleId"] == "EVT006_OPTIONAL_FIELD_REMOVED"
            for f in ana_findings
        )


# ---------------------------------------------------------------------------
# Error Handling: Validation and Publisher Failures
# ---------------------------------------------------------------------------


class TestPublishEndpointErrors:
    def test_invalid_payload_type_returns_422(self, client: TestClient):
        """Malformed payload type must return 422 INVALID_EVENT_PAYLOAD."""
        payload = {
            "orderId": "O1001",
            "amount": "not-a-number",  # Invalid type
            "items": [],
            "shippingMethod": "FedEx",
        }
        resp = client.post(
            "/api/v1/events/publish",
            json={
                "eventType": "OrderPlaced",
                "currentVersion": 1,
                "proposedVersion": 2,
                "payload": payload,
            },
            headers={"X-Request-ID": "test-invalid-payload"},
        )

        assert resp.status_code == 422
        data = resp.json()
        assert "error" in data
        assert data["error"]["code"] == "INVALID_EVENT_PAYLOAD"
        assert "Field 'amount' must be of type 'number'" in data["error"]["message"]
        assert data["error"]["requestId"] == "test-invalid-payload"

    def test_missing_required_payload_field_returns_422(self, client: TestClient):
        """Missing required payload field must return 422 INVALID_EVENT_PAYLOAD."""
        payload = {
            # orderId is missing!
            "amount": 500,
            "items": [],
            "shippingMethod": "FedEx",
        }
        resp = client.post(
            "/api/v1/events/publish",
            json={
                "eventType": "OrderPlaced",
                "currentVersion": 1,
                "proposedVersion": 2,
                "payload": payload,
            },
        )

        assert resp.status_code == 422
        data = resp.json()
        assert data["error"]["code"] == "INVALID_EVENT_PAYLOAD"
        assert "Missing required field: 'orderId'" in data["error"]["message"]

    def test_publisher_failure_returns_503(self, client: TestClient):
        """Downstream transport failure must return 503 EVENT_PUBLISH_FAILED."""

        class FailingPublisher:
            def publish(self, *args, **kwargs):
                raise EventPublishFailedError("EventBridge is unreachable")

        app.dependency_overrides[get_event_publisher] = lambda: FailingPublisher()
        try:
            payload = {
                "orderId": "O1001",
                "amount": 500,
                "items": [{"sku": "SKU-001", "quantity": 1}],
                "shippingMethod": "FedEx",
                "couponCode": "SAVE10",
                "metadata": {"channel": "web"},
            }
            resp = client.post(
                "/api/v1/events/publish",
                json={
                    "eventType": "OrderPlaced",
                    "currentVersion": 1,
                    "proposedVersion": 2,
                    "payload": payload,
                },
                headers={"X-Request-ID": "test-pub-fail"},
            )

            assert resp.status_code == 503
            data = resp.json()
            assert data["error"]["code"] == "EVENT_PUBLISH_FAILED"
            assert data["error"]["requestId"] == "test-pub-fail"
        finally:
            app.dependency_overrides.pop(get_event_publisher, None)
