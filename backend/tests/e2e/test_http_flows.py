"""Release flows over real HTTP against a running uvicorn process.

Each test runs once per storage mode (see conftest.py). History is shared by
every test in the module, so tests look up their own records instead of
assuming an empty store.
"""

from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import httpx
import pytest

from tests.e2e.conftest import ApiServer

pytestmark = pytest.mark.e2e

ORDER_V2 = {
    "orderId": "ord-20261102-0001",
    "amount": 149.99,
    "items": [{"sku": "SKU-RED-M", "qty": 2}, {"sku": "SKU-BLU-L", "qty": 1}],
    "shippingMethod": "express",
    "couponCode": "AUTUMN10",
    "metadata": {"channel": "web"},
}
ORDER_V4 = {k: ORDER_V2[k] for k in ("orderId", "amount", "items", "shippingMethod")}


def _change(event_type: str, current: int, proposed: int, environment: str) -> dict[str, Any]:
    return {
        "eventType": event_type,
        "currentVersion": current,
        "proposedVersion": proposed,
        "environment": environment,
    }


def _analyze(api: httpx.Client, *args: Any) -> dict[str, Any]:
    resp = api.post("/api/v1/analyze", json=_change(*args))
    assert resp.status_code == 200, resp.text
    return resp.json()


def _error_code(resp: httpx.Response) -> str:
    return resp.json()["error"]["code"]


class TestServiceBasics:
    def test_health_and_request_id(self, api: httpx.Client):
        resp = api.get("/health", headers={"X-Request-ID": "e2e-trace-1"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
        assert resp.headers["X-Request-ID"] == "e2e-trace-1"
        assert api.get("/health").headers["X-Request-ID"]

    def test_browser_preflight_is_allowed_from_another_origin(self, api: httpx.Client):
        resp = api.options(
            "/api/v1/analyze",
            headers={
                "Origin": "https://console.example.test",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type,x-request-id",
            },
        )
        assert resp.status_code == 200
        assert resp.headers["access-control-allow-origin"] == "*"
        assert "POST" in resp.headers["access-control-allow-methods"]

    def test_runtime_config_reports_the_running_adapters(
        self, api: httpx.Client, api_server: ApiServer
    ):
        config = api.get("/api/v1/config/runtime").json()
        assert config["storageBackendType"] == api_server.mode
        assert config["publisherBackendType"] == "local"
        assert config["eventBridgeBus"] is None
        if api_server.mode == "dynamodb":
            assert config["contractsSource"] == api_server.env["EVENT_CONTRACTS_TABLE_NAME"]
            assert config["historyStore"] == api_server.env["RELEASE_HISTORY_TABLE_NAME"]
        policies = api.get("/api/v1/policies").json()
        assert policies["activeEngine"] == config["policyEngineType"]
        assert {row["environment"] for row in policies["matrix"]} >= {"production", "development"}


class TestCatalog:
    def test_lists_the_seeded_contracts(self, api: httpx.Client):
        events = {e["eventType"]: e for e in api.get("/api/v1/contracts/events").json()}
        assert set(events) == {"OrderPlaced", "PaymentCompleted", "UserCreated"}
        assert events["OrderPlaced"]["versions"] == [1, 2, 3, 4]

        detail = api.get("/api/v1/contracts/events/OrderPlaced").json()
        assert detail["versions"] == [1, 2, 3, 4]
        assert [c["version"] for c in detail["contracts"]] == [1, 2, 3, 4]
        assert {c["consumerId"] for c in detail["consumers"]} >= {
            "billing-service",
            "inventory-service",
        }

        consumers = api.get("/api/v1/contracts/consumers").json()
        assert len(consumers) == 5
        billing = api.get("/api/v1/contracts/consumers/billing-service").json()
        assert billing["eventType"] == "OrderPlaced"
        assert "orderId" in billing["expectedFields"]


class TestReleaseFlows:
    def test_safe_change_is_published_recorded_and_reported(self, api: httpx.Client):
        analysis = _analyze(api, "OrderPlaced", 1, 2, "production")
        assert (analysis["compatibilityResult"], analysis["decision"]) == ("SAFE", "ALLOW")

        resp = api.post(
            "/api/v1/events/publish",
            json={
                **_change("OrderPlaced", 1, 2, "production"),
                "analysisId": analysis["analysisId"],
                "payload": ORDER_V2,
            },
        )
        assert resp.status_code == 200, resp.text
        published = resp.json()
        assert published["published"] is True
        assert published["analysis"]["analysisId"] == analysis["analysisId"]

        record = api.get(f"/api/v1/history/{analysis['analysisId']}").json()
        assert record["published"] is True
        assert record["attemptedPublish"] is True
        assert record["eventId"] == published["eventId"]
        assert record["publishedAt"]

        markdown = api.get(f"/api/v1/history/{record['recordId']}/report").json()
        assert markdown["format"] == "markdown"
        assert "OrderPlaced" in markdown["content"] and "ALLOW" in markdown["content"]
        report = api.get(
            f"/api/v1/history/{record['recordId']}/report", params={"format": "json"}
        ).json()
        assert json.loads(report["content"])["record_id"] == record["recordId"]

    def test_breaking_change_is_blocked_and_not_published(self, api: httpx.Client):
        analysis = _analyze(api, "OrderPlaced", 1, 3, "production")
        assert (analysis["compatibilityResult"], analysis["decision"]) == ("BREAK", "BLOCK")
        assert any(f["status"] == "BREAK" for f in analysis["findings"])

        resp = api.post(
            "/api/v1/events/publish",
            json={
                **_change("OrderPlaced", 1, 3, "production"),
                "analysisId": analysis["analysisId"],
                "payload": {**ORDER_V4, "shippingMethod": {"carrier": "express"}},
            },
        )
        assert resp.status_code == 409
        assert resp.json()["published"] is False

        record = api.get(f"/api/v1/history/{analysis['analysisId']}").json()
        assert (record["published"], record["attemptedPublish"]) == (False, True)
        assert record["affectedConsumers"]

    def test_risky_change_needs_review_in_production_and_passes_in_development(
        self, api: httpx.Client
    ):
        production = api.post(
            "/api/v1/events/publish",
            json={**_change("OrderPlaced", 1, 4, "production"), "payload": ORDER_V4},
        )
        assert production.status_code == 409
        assert production.json()["decision"] == "REVIEW"

        development = api.post(
            "/api/v1/events/publish",
            json={**_change("OrderPlaced", 1, 4, "development"), "payload": ORDER_V4},
        )
        assert development.status_code == 200, development.text
        body = development.json()
        assert (body["decision"], body["published"]) == ("ALLOW", True)
        assert body["analysis"]["warnings"]


class TestFailures:
    @pytest.mark.parametrize(
        ("method", "path", "body", "status", "code"),
        [
            (
                "POST",
                "/api/v1/events/publish",
                {**_change("OrderPlaced", 1, 2, "production"), "payload": {"orderId": 7}},
                422,
                "INVALID_EVENT_PAYLOAD",
            ),
            (
                "POST",
                "/api/v1/analyze",
                _change("OrderPlaced", 2, 2, "production"),
                400,
                "INVALID_ANALYSIS_REQUEST",
            ),
            (
                "POST",
                "/api/v1/analyze",
                _change("OrderPlaced", 1, 9, "production"),
                404,
                "UNSUPPORTED_EVENT_VERSION",
            ),
            (
                "POST",
                "/api/v1/analyze",
                _change("OrderCancelled", 1, 2, "production"),
                404,
                "CONTRACT_NOT_FOUND",
            ),
            (
                "POST",
                "/api/v1/analyze",
                _change("OrderPlaced", 1, 2, "qa"),
                422,
                "VALIDATION_ERROR",
            ),
            ("GET", "/api/v1/history?limit=0", None, 422, "VALIDATION_ERROR"),
            ("GET", "/api/v1/history/no-such-record", None, 404, "RELEASE_RECORD_NOT_FOUND"),
            ("GET", "/api/v1/contracts/consumers/ghost", None, 404, "CONTRACT_NOT_FOUND"),
            ("GET", "/api/v1/nope", None, 404, "NOT_FOUND"),
            ("DELETE", "/api/v1/history", None, 405, "METHOD_NOT_ALLOWED"),
        ],
    )
    def test_error_responses(
        self, api: httpx.Client, method: str, path: str, body: Any, status: int, code: str
    ):
        resp = api.request(method, path, json=body, headers={"X-Request-ID": "e2e-err"})
        assert resp.status_code == status, resp.text
        assert _error_code(resp) == code
        assert resp.json()["error"]["requestId"] == "e2e-err"

    def test_malformed_json_body_is_a_validation_error(self, api: httpx.Client):
        resp = api.post(
            "/api/v1/analyze", content=b"{not json", headers={"Content-Type": "application/json"}
        )
        assert resp.status_code == 422
        assert _error_code(resp) == "VALIDATION_ERROR"

    def test_rejected_payload_leaves_no_published_record(self, api: httpx.Client):
        analysis = _analyze(api, "OrderPlaced", 1, 2, "staging")
        resp = api.post(
            "/api/v1/events/publish",
            json={
                **_change("OrderPlaced", 1, 2, "staging"),
                "analysisId": analysis["analysisId"],
                "payload": {**ORDER_V2, "amount": "149.99"},
            },
        )
        assert resp.status_code == 422
        record = api.get(f"/api/v1/history/{analysis['analysisId']}").json()
        assert record["published"] is False


class TestHistory:
    def test_concurrent_analyses_are_all_recorded(self, api: httpx.Client):
        changes = [("UserCreated", 1, 2, "staging"), ("PaymentCompleted", 1, 2, "staging")] * 6
        with ThreadPoolExecutor(max_workers=6) as pool:
            results = list(pool.map(lambda args: _analyze(api, *args), changes))

        ids = {r["analysisId"] for r in results}
        assert len(ids) == len(changes)
        listed = {r["analysisId"] for r in api.get("/api/v1/history", params={"limit": 200}).json()}
        assert ids <= listed

    def test_filter_limit_and_newest_first(self, api: httpx.Client):
        older = _analyze(api, "UserCreated", 1, 2, "production")
        newer = _analyze(api, "PaymentCompleted", 1, 2, "production")

        everything = api.get("/api/v1/history", params={"limit": 200}).json()
        order = [r["analysisId"] for r in everything]
        assert order.index(newer["analysisId"]) < order.index(older["analysisId"])
        timestamps = [r["timestamp"] for r in everything]
        assert timestamps == sorted(timestamps, reverse=True)

        users = api.get("/api/v1/history", params={"eventType": "UserCreated"}).json()
        assert users and {r["eventType"] for r in users} == {"UserCreated"}
        assert newer["analysisId"] not in {r["analysisId"] for r in users}

        assert len(api.get("/api/v1/history", params={"limit": 1}).json()) == 1

    def test_history_survives_a_server_restart(self, api_server: ApiServer):
        with httpx.Client(base_url=api_server.base_url, timeout=15) as client:
            analysis = _analyze(client, "OrderPlaced", 1, 2, "staging")
        api_server.stop()
        api_server.start()
        with httpx.Client(base_url=api_server.base_url, timeout=15) as client:
            record = client.get(f"/api/v1/history/{analysis['analysisId']}")
        assert record.status_code == 200
        assert record.json()["decision"] == analysis["decision"]


class TestEventBusOutage:
    def test_allowed_publish_fails_with_503_and_is_recorded(self, bus_down_api: httpx.Client):
        analysis = _analyze(bus_down_api, "OrderPlaced", 1, 2, "production")
        resp = bus_down_api.post(
            "/api/v1/events/publish",
            json={
                **_change("OrderPlaced", 1, 2, "production"),
                "analysisId": analysis["analysisId"],
                "payload": ORDER_V2,
            },
        )
        assert resp.status_code == 503, resp.text
        assert _error_code(resp) == "EVENT_PUBLISH_FAILED"

        record = bus_down_api.get(f"/api/v1/history/{analysis['analysisId']}").json()
        assert (record["published"], record["attemptedPublish"]) == (False, True)
        assert record["error"].startswith("Publication failed")
