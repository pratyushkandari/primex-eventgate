"""API-level regressions: error envelope, request IDs, environment validation,
and publish/analysis correlation in the audit trail."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from eventgate.api.dependencies import get_event_publisher
from eventgate.domain.errors import EventPublishFailedError
from eventgate.main import app

SAFE_PAYLOAD = {
    "orderId": "ord-1",
    "amount": 10.5,
    "items": ["sku-1"],
    "shippingMethod": "standard",
}


@pytest.fixture
def client() -> TestClient:
    return TestClient(app, raise_server_exceptions=False)


def _analyze(client: TestClient, proposed: int, environment: str = "production") -> str:
    resp = client.post(
        "/api/v1/analyze",
        json={
            "eventType": "OrderPlaced",
            "currentVersion": 1,
            "proposedVersion": proposed,
            "environment": environment,
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["analysisId"]


class TestErrorEnvelope:
    def test_unknown_route_uses_envelope_with_request_id(self, client: TestClient):
        resp = client.get("/api/v1/does-not-exist", headers={"X-Request-ID": "req-abc"})
        assert resp.status_code == 404
        error = resp.json()["error"]
        assert error["code"] == "NOT_FOUND"
        assert error["requestId"] == "req-abc"
        assert resp.headers["X-Request-ID"] == "req-abc"

    def test_wrong_method_is_405_envelope(self, client: TestClient):
        resp = client.get("/api/v1/analyze")
        assert resp.status_code == 405
        assert resp.json()["error"]["code"] == "METHOD_NOT_ALLOWED"

    def test_malformed_json_body_is_validation_error(self, client: TestClient):
        resp = client.post(
            "/api/v1/analyze", content="{bad", headers={"Content-Type": "application/json"}
        )
        assert resp.status_code == 422
        assert resp.json()["error"]["code"] == "VALIDATION_ERROR"

    def test_missing_fields_are_listed(self, client: TestClient):
        resp = client.post("/api/v1/analyze", json={"eventType": "OrderPlaced"})
        assert resp.status_code == 422
        error = resp.json()["error"]
        fields = {d["field"] for d in error["details"]}
        assert {"currentVersion", "proposedVersion"} <= fields
        assert "currentVersion" in error["message"]

    def test_unhandled_exception_is_500_without_internals(self, client: TestClient):
        class ExplodingPublisher:
            def publish(self, *args, **kwargs):
                raise RuntimeError("secret internal detail")

        app.dependency_overrides[get_event_publisher] = lambda: ExplodingPublisher()
        try:
            resp = client.post(
                "/api/v1/events/publish",
                json={
                    "eventType": "OrderPlaced",
                    "currentVersion": 1,
                    "proposedVersion": 2,
                    "payload": SAFE_PAYLOAD,
                },
            )
        finally:
            app.dependency_overrides.clear()
        assert resp.status_code == 500
        assert resp.json()["error"]["code"] == "INTERNAL_ERROR"
        assert "secret" not in resp.text
        assert resp.json()["error"]["requestId"]

    def test_success_responses_echo_request_id(self, client: TestClient):
        for path in ("/health", "/api/v1/policies", "/api/v1/contracts/events"):
            resp = client.get(path, headers={"X-Request-ID": "trace-7"})
            assert resp.headers["X-Request-ID"] == "trace-7", path

    def test_unsafe_request_id_is_replaced(self, client: TestClient):
        resp = client.get("/health", headers={"X-Request-ID": "<script>"})
        assert resp.headers["X-Request-ID"] == "script"


class TestEnvironmentValidation:
    def test_unknown_environment_is_rejected(self, client: TestClient):
        resp = client.post(
            "/api/v1/analyze",
            json={
                "eventType": "OrderPlaced",
                "currentVersion": 1,
                "proposedVersion": 4,
                "environment": "Prod",
            },
        )
        assert resp.status_code == 422
        assert resp.json()["error"]["code"] == "VALIDATION_ERROR"

    def test_environment_is_case_normalized_everywhere(self, client: TestClient):
        analysis_id = _analyze(client, 4, environment="  STAGING ")
        record = client.get(f"/api/v1/history/{analysis_id}").json()
        assert record["environment"] == "staging"
        assert record["decision"] == "REVIEW"

    def test_history_only_ever_contains_known_environments(self, client: TestClient):
        _analyze(client, 2, environment="Development")
        envs = {r["environment"] for r in client.get("/api/v1/history").json()}
        assert envs <= {"development", "staging", "production"}


class TestPublishCorrelation:
    def test_mismatched_analysis_id_is_rejected_and_record_untouched(self, client: TestClient):
        breaking_id = _analyze(client, 3)

        resp = client.post(
            "/api/v1/events/publish",
            json={
                "eventType": "OrderPlaced",
                "currentVersion": 1,
                "proposedVersion": 2,
                "analysisId": breaking_id,
                "payload": SAFE_PAYLOAD,
            },
        )

        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "INVALID_ANALYSIS_REQUEST"
        record = client.get(f"/api/v1/history/{breaking_id}").json()
        assert record["proposedVersion"] == 3
        assert record["decision"] == "BLOCK"
        assert record["published"] is False
        assert record["attemptedPublish"] is False

    def test_environment_mismatch_is_rejected(self, client: TestClient):
        dev_id = _analyze(client, 4, environment="development")
        resp = client.post(
            "/api/v1/events/publish",
            json={
                "eventType": "OrderPlaced",
                "currentVersion": 1,
                "proposedVersion": 4,
                "environment": "production",
                "analysisId": dev_id,
                "payload": {k: v for k, v in SAFE_PAYLOAD.items()},
            },
        )
        assert resp.status_code == 400

    def test_correlated_publish_updates_the_same_record(self, client: TestClient):
        analysis_id = _analyze(client, 2)
        resp = client.post(
            "/api/v1/events/publish",
            json={
                "eventType": "OrderPlaced",
                "currentVersion": 1,
                "proposedVersion": 2,
                "analysisId": analysis_id,
                "payload": SAFE_PAYLOAD,
            },
        )
        assert resp.status_code == 200
        record = client.get(f"/api/v1/history/{analysis_id}").json()
        assert record["published"] is True
        assert record["eventId"] == resp.json()["eventId"]
        assert record["policyName"] == "StandardReleasePolicy"
        assert len(client.get("/api/v1/history").json()) == 1

    def test_uncorrelated_publish_records_the_real_policy(self, client: TestClient):
        resp = client.post(
            "/api/v1/events/publish",
            json={
                "eventType": "OrderPlaced",
                "currentVersion": 1,
                "proposedVersion": 3,
                "payload": {**SAFE_PAYLOAD, "shippingMethod": {"carrier": "x"}},
            },
        )
        assert resp.status_code == 409
        record = client.get("/api/v1/history").json()[0]
        assert record["decision"] == "BLOCK"
        assert record["attemptedPublish"] is True
        assert "blocks breaking changes" in record["policyReason"]
        assert record["affectedConsumers"] == ["inventory-service"]

    def test_failed_transport_is_recorded_and_returns_503(self, client: TestClient):
        class FailingPublisher:
            def publish(self, *args, **kwargs):
                raise EventPublishFailedError("EventBridge is unreachable")

        analysis_id = _analyze(client, 2)
        app.dependency_overrides[get_event_publisher] = lambda: FailingPublisher()
        try:
            resp = client.post(
                "/api/v1/events/publish",
                json={
                    "eventType": "OrderPlaced",
                    "currentVersion": 1,
                    "proposedVersion": 2,
                    "analysisId": analysis_id,
                    "payload": SAFE_PAYLOAD,
                },
            )
        finally:
            app.dependency_overrides.clear()

        assert resp.status_code == 503
        assert resp.json()["error"]["code"] == "EVENT_PUBLISH_FAILED"
        record = client.get(f"/api/v1/history/{analysis_id}").json()
        assert record["attemptedPublish"] is True
        assert record["published"] is False
        assert "EventBridge is unreachable" in record["error"]


class TestReports:
    def test_report_timestamp_is_record_time_not_server_start(self, client: TestClient):
        first = client.get(f"/api/v1/history/{_analyze(client, 2)}").json()["timestamp"]
        second = client.get(f"/api/v1/history/{_analyze(client, 3)}").json()["timestamp"]
        assert first != second


class TestInputLimits:
    @pytest.mark.parametrize("limit, status", [(0, 422), (1, 200), (200, 200), (201, 422)])
    def test_history_limit_bounds(self, client: TestClient, limit: int, status: int):
        resp = client.get("/api/v1/history", params={"limit": limit})
        assert resp.status_code == status
        if status == 422:
            assert resp.json()["error"]["details"][0]["field"] == "query.limit"

    def test_history_limit_caps_the_result(self, client: TestClient):
        for proposed in (2, 3, 4):
            _analyze(client, proposed)
        assert len(client.get("/api/v1/history", params={"limit": 2}).json()) == 2

    def test_history_event_filter_ignores_surrounding_whitespace(self, client: TestClient):
        _analyze(client, 2)
        resp = client.get("/api/v1/history", params={"eventType": "  OrderPlaced  "})
        assert [r["eventType"] for r in resp.json()] == ["OrderPlaced"]

    def test_long_request_id_is_truncated_to_128_characters(self, client: TestClient):
        resp = client.get("/health", headers={"X-Request-ID": "a" * 300})
        assert resp.headers["X-Request-ID"] == "a" * 128

    def test_empty_event_type_is_a_validation_error(self, client: TestClient):
        resp = client.post(
            "/api/v1/analyze", json={"eventType": "", "currentVersion": 1, "proposedVersion": 2}
        )
        assert resp.status_code == 422
        assert resp.json()["error"]["details"][0]["field"] == "eventType"

    def test_blank_event_type_is_rejected_by_the_service(self, client: TestClient):
        resp = client.post(
            "/api/v1/analyze", json={"eventType": "   ", "currentVersion": 1, "proposedVersion": 2}
        )
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "INVALID_ANALYSIS_REQUEST"

    @pytest.mark.parametrize("field", ["currentVersion", "proposedVersion"])
    def test_versions_below_one_are_rejected(self, client: TestClient, field: str):
        body = {"eventType": "OrderPlaced", "currentVersion": 1, "proposedVersion": 2, field: 0}
        resp = client.post("/api/v1/analyze", json=body)
        assert resp.status_code == 422
        assert resp.json()["error"]["details"][0]["field"] == field

    @pytest.mark.parametrize("payload", [[1, 2], "text", 5, None])
    def test_non_object_payload_is_a_validation_error(self, client: TestClient, payload):
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
        assert resp.json()["error"]["code"] == "VALIDATION_ERROR"

    def test_publish_for_unknown_event_type_is_404(self, client: TestClient):
        resp = client.post(
            "/api/v1/events/publish",
            json={
                "eventType": "NoSuchEvent",
                "currentVersion": 1,
                "proposedVersion": 2,
                "payload": {},
            },
        )
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "CONTRACT_NOT_FOUND"

    def test_publishing_twice_with_one_analysis_keeps_one_record(self, client: TestClient):
        analysis_id = _analyze(client, 2)
        body = {
            "eventType": "OrderPlaced",
            "currentVersion": 1,
            "proposedVersion": 2,
            "analysisId": analysis_id,
            "payload": SAFE_PAYLOAD,
        }
        first = client.post("/api/v1/events/publish", json=body).json()["eventId"]
        second = client.post("/api/v1/events/publish", json=body).json()["eventId"]

        assert first != second
        records = client.get("/api/v1/history").json()
        assert len(records) == 1
        assert records[0]["eventId"] == second


class TestHistoryIsBestEffort:
    def test_analysis_succeeds_when_history_cannot_be_written(self, client: TestClient):
        from eventgate.api.dependencies import get_history_service

        class BrokenHistory:
            def record_evaluation(self, **kwargs):
                raise OSError("disk full")

        app.dependency_overrides[get_history_service] = lambda: BrokenHistory()
        try:
            resp = client.post(
                "/api/v1/analyze",
                json={"eventType": "OrderPlaced", "currentVersion": 1, "proposedVersion": 2},
            )
        finally:
            app.dependency_overrides.clear()
        assert resp.status_code == 200
        assert resp.json()["decision"] == "ALLOW"

    def test_publish_succeeds_when_history_cannot_be_written(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ):
        from eventgate.application.services.release_history_service import ReleaseHistoryService

        def broken(self, **kwargs):
            raise OSError("disk full")

        monkeypatch.setattr(ReleaseHistoryService, "record_publish", broken)
        resp = client.post(
            "/api/v1/events/publish",
            json={
                "eventType": "OrderPlaced",
                "currentVersion": 1,
                "proposedVersion": 2,
                "payload": SAFE_PAYLOAD,
            },
        )
        assert resp.status_code == 200
        assert resp.json()["published"] is True
