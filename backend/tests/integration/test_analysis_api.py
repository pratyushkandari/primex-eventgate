"""Integration tests for the EventGate API."""

import pytest
from fastapi.testclient import TestClient

from eventgate.main import app


@pytest.fixture
def client():
    return TestClient(app)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


class TestHealthEndpoint:
    def test_health(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["service"] == "eventgate"
        assert data["version"] == "0.1.0"


# ---------------------------------------------------------------------------
# Analyze — success scenarios
# ---------------------------------------------------------------------------


class TestAnalyzeEndpoint:
    def test_safe_analysis(self, client):
        resp = client.post(
            "/api/v1/analyze",
            json={"eventType": "OrderPlaced", "currentVersion": 1, "proposedVersion": 2},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["decision"] == "ALLOW"
        assert data["severity"] == "LOW"
        assert data["eventType"] == "OrderPlaced"
        assert data["currentVersion"] == 1
        assert data["proposedVersion"] == 2
        assert "analysisId" in data
        assert "changeSet" in data
        assert "findings" in data
        assert "summary" in data
        assert "timestamp" in data

    def test_breaking_analysis(self, client):
        resp = client.post(
            "/api/v1/analyze",
            json={"eventType": "OrderPlaced", "currentVersion": 1, "proposedVersion": 3},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["decision"] == "BLOCK"
        assert data["severity"] == "HIGH"

        # Verify inventory-service BREAK finding and unaffected consumer finding.
        inv_findings = [f for f in data["findings"] if f["consumerId"] == "inventory-service"]
        assert any(
            f["status"] == "BREAK" and f["ruleId"] == "EVT001_FIELD_TYPE_CHANGED"
            for f in inv_findings
        )

        bill_findings = [f for f in data["findings"] if f["consumerId"] == "billing-service"]
        assert any(
            f["status"] == "SAFE" and f["ruleId"] == "EVT008_CONSUMER_UNAFFECTED"
            for f in bill_findings
        )

    def test_risk_analysis(self, client):
        resp = client.post(
            "/api/v1/analyze",
            json={"eventType": "OrderPlaced", "currentVersion": 1, "proposedVersion": 4},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["decision"] == "REVIEW"
        assert data["severity"] == "MEDIUM"

        ana_findings = [f for f in data["findings"] if f["consumerId"] == "analytics-service"]
        assert any(
            f["status"] == "RISK" and f["ruleId"] == "EVT006_OPTIONAL_FIELD_REMOVED"
            for f in ana_findings
        )

        bill_findings = [f for f in data["findings"] if f["consumerId"] == "billing-service"]
        assert any(
            f["status"] == "SAFE" and f["ruleId"] == "EVT008_CONSUMER_UNAFFECTED"
            for f in bill_findings
        )

    def test_camel_case_response(self, client):
        """API responses must use camelCase field names."""
        resp = client.post(
            "/api/v1/analyze",
            json={"eventType": "OrderPlaced", "currentVersion": 1, "proposedVersion": 2},
        )
        data = resp.json()
        assert "analysisId" in data
        assert "eventType" in data
        assert "currentVersion" in data
        assert "proposedVersion" in data
        assert "changeSet" in data
        cs = data["changeSet"]
        assert "addedFields" in cs
        assert "removedFields" in cs
        assert "typeChanges" in cs
        assert "requirednessChanges" in cs

    def test_change_set_structure(self, client):
        """v1→v3 should show shippingMethod type change in changeSet."""
        resp = client.post(
            "/api/v1/analyze",
            json={"eventType": "OrderPlaced", "currentVersion": 1, "proposedVersion": 3},
        )
        data = resp.json()
        cs = data["changeSet"]
        assert len(cs["typeChanges"]) > 0
        tc = cs["typeChanges"][0]
        assert "field" in tc
        assert "fromType" in tc
        assert "toType" in tc


# ---------------------------------------------------------------------------
# Analyze — error scenarios
# ---------------------------------------------------------------------------


class TestAnalyzeErrors:
    def test_unknown_event_type(self, client):
        resp = client.post(
            "/api/v1/analyze",
            json={"eventType": "NonExistent", "currentVersion": 1, "proposedVersion": 2},
        )
        assert resp.status_code == 404
        data = resp.json()
        assert "error" in data
        assert data["error"]["code"] in ("CONTRACT_NOT_FOUND", "UNSUPPORTED_EVENT_TYPE")

    def test_unknown_version(self, client):
        resp = client.post(
            "/api/v1/analyze",
            json={"eventType": "OrderPlaced", "currentVersion": 1, "proposedVersion": 99},
        )
        assert resp.status_code == 404
        data = resp.json()
        assert "error" in data

    def test_missing_event_type(self, client):
        resp = client.post(
            "/api/v1/analyze",
            json={"currentVersion": 1, "proposedVersion": 2},
        )
        assert resp.status_code == 422

    def test_invalid_version_type(self, client):
        resp = client.post(
            "/api/v1/analyze",
            json={"eventType": "OrderPlaced", "currentVersion": "one", "proposedVersion": 2},
        )
        assert resp.status_code == 422

    def test_malformed_json(self, client):
        resp = client.post(
            "/api/v1/analyze",
            content="not json",
            headers={"Content-Type": "application/json"},
        )
        assert resp.status_code == 422

    def test_zero_version(self, client):
        resp = client.post(
            "/api/v1/analyze",
            json={"eventType": "OrderPlaced", "currentVersion": 0, "proposedVersion": 2},
        )
        assert resp.status_code == 422

    def test_error_response_structure(self, client):
        """Error responses must have stable {error: {code, message, requestId}} format."""
        resp = client.post(
            "/api/v1/analyze",
            json={"eventType": "OrderPlaced", "currentVersion": 1, "proposedVersion": 99},
        )
        data = resp.json()
        assert "error" in data
        assert "code" in data["error"]
        assert "message" in data["error"]
        assert "requestId" in data["error"]


# ---------------------------------------------------------------------------
# Request ID
# ---------------------------------------------------------------------------


class TestRequestId:
    def test_client_request_id_preserved(self, client):
        resp = client.post(
            "/api/v1/analyze",
            json={"eventType": "OrderPlaced", "currentVersion": 1, "proposedVersion": 2},
            headers={"X-Request-ID": "my-test-id-123"},
        )
        data = resp.json()
        assert data["requestId"] == "my-test-id-123"

    def test_request_id_generated_when_absent(self, client):
        resp = client.post(
            "/api/v1/analyze",
            json={"eventType": "OrderPlaced", "currentVersion": 1, "proposedVersion": 2},
        )
        data = resp.json()
        assert data["requestId"] is not None
        assert len(data["requestId"]) > 0

    def test_request_id_sanitized(self, client):
        resp = client.post(
            "/api/v1/analyze",
            json={"eventType": "OrderPlaced", "currentVersion": 1, "proposedVersion": 2},
            headers={"X-Request-ID": "id<script>alert(1)</script>"},
        )
        data = resp.json()
        # Should strip dangerous characters.
        assert "<" not in data["requestId"]
        assert ">" not in data["requestId"]
