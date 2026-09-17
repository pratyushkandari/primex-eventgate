"""Integration tests for the AWS Lambda handler with Mangum."""

import json
from pathlib import Path
from unittest.mock import MagicMock

from eventgate.lambda_handler import handler

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
_EVENTS_DIR = _PROJECT_ROOT / "events"


def _load_event(filename: str) -> dict:
    with open(_EVENTS_DIR / filename, encoding="utf-8") as f:
        return json.load(f)


class TestLambdaHandler:
    def setup_method(self):
        self.mock_context = MagicMock()
        self.mock_context.aws_request_id = "test-aws-req-id"
        self.mock_context.function_name = "primex-eventgate-dev-api"

    def test_health_check_via_event_file(self):
        event = _load_event("health.json")
        response = handler(event, self.mock_context)

        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["status"] == "ok"
        assert body["service"] == "eventgate"
        assert "version" in body

    def test_analyze_scenario_a_v1_to_v2(self):
        event = _load_event("analyze-v2.json")
        response = handler(event, self.mock_context)

        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["decision"] == "ALLOW"
        assert body["severity"] == "LOW"
        assert body["eventType"] == "OrderPlaced"
        assert body["currentVersion"] == 1
        assert body["proposedVersion"] == 2

    def test_analyze_scenario_b_v1_to_v3(self):
        event = _load_event("analyze-v3.json")
        response = handler(event, self.mock_context)

        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["decision"] == "BLOCK"
        assert body["severity"] == "HIGH"
        # Verify inventory-service BREAK
        inv_findings = [f for f in body["findings"] if f["consumerId"] == "inventory-service"]
        assert any(f["status"] == "BREAK" for f in inv_findings)

    def test_analyze_scenario_c_v1_to_v4(self):
        event = _load_event("analyze-v4.json")
        response = handler(event, self.mock_context)

        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["decision"] == "REVIEW"
        assert body["severity"] == "MEDIUM"
        # Verify analytics-service RISK
        ana_findings = [f for f in body["findings"] if f["consumerId"] == "analytics-service"]
        assert any(f["status"] == "RISK" for f in ana_findings)

    def test_request_id_preservation_in_headers(self):
        event = _load_event("analyze-v2.json")
        event["headers"]["x-request-id"] = "trace-correlation-id-999"

        response = handler(event, self.mock_context)
        assert response["statusCode"] == 200
        headers = response.get("headers", {})
        # Headers might be lowercase in HTTP API v2
        x_req = headers.get("x-request-id") or headers.get("X-Request-ID")
        assert x_req == "trace-correlation-id-999"

        body = json.loads(response["body"])
        assert body["requestId"] == "trace-correlation-id-999"

    def test_structured_error_handling_unknown_version(self):
        event = {
            "version": "2.0",
            "routeKey": "POST /api/v1/analyze",
            "rawPath": "/api/v1/analyze",
            "headers": {"content-type": "application/json", "x-request-id": "error-test-req"},
            "requestContext": {
                "http": {
                    "method": "POST",
                    "path": "/api/v1/analyze",
                    "protocol": "HTTP/1.1",
                    "sourceIp": "127.0.0.1",
                }
            },
            "body": json.dumps(
                {"eventType": "OrderPlaced", "currentVersion": 1, "proposedVersion": 99}
            ),
            "isBase64Encoded": False,
        }
        response = handler(event, self.mock_context)
        assert response["statusCode"] == 404
        body = json.loads(response["body"])
        assert "error" in body
        assert body["error"]["code"] in ("UNSUPPORTED_EVENT_VERSION", "CONTRACT_NOT_FOUND")
        assert "99" in body["error"]["message"]
        assert body["error"]["requestId"] == "error-test-req"

    def test_structured_error_invalid_request_body(self):
        # Sending identical current and proposed versions triggers InvalidAnalysisRequestError
        event = {
            "version": "2.0",
            "routeKey": "POST /api/v1/analyze",
            "rawPath": "/api/v1/analyze",
            "headers": {"content-type": "application/json", "x-request-id": "same-ver-req"},
            "requestContext": {
                "http": {
                    "method": "POST",
                    "path": "/api/v1/analyze",
                    "protocol": "HTTP/1.1",
                    "sourceIp": "127.0.0.1",
                }
            },
            "body": json.dumps(
                {"eventType": "OrderPlaced", "currentVersion": 1, "proposedVersion": 1}
            ),
            "isBase64Encoded": False,
        }
        response = handler(event, self.mock_context)
        assert response["statusCode"] == 400
        body = json.loads(response["body"])
        assert "error" in body
        assert body["error"]["code"] == "INVALID_ANALYSIS_REQUEST"
        assert body["error"]["requestId"] == "same-ver-req"
