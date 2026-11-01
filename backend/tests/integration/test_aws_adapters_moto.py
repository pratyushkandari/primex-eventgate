"""The API running on the DynamoDB and EventBridge adapters, against moto's AWS emulation.

Tables mirror template.yaml and are filled by scripts/seed_dynamodb.py, so these
tests cover the seed script, the catalog items, the GSIs and the publisher
together. No real AWS account or credentials are used.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import boto3
import pytest
from fastapi.testclient import TestClient
from moto import mock_aws

from eventgate.api.dependencies import clear_caches
from eventgate.main import app
from scripts.seed_dynamodb import seed_dynamodb

REGION = "ap-south-1"
EVENT_TABLE = "test-event-contracts"
CONSUMER_TABLE = "test-consumer-contracts"
HISTORY_TABLE = "test-release-history"
BUS = "test-bus"
CONTRACTS_DIR = Path(__file__).resolve().parents[3] / "contracts"


def _create_tables(dynamodb) -> None:
    dynamodb.create_table(
        TableName=EVENT_TABLE,
        BillingMode="PAY_PER_REQUEST",
        AttributeDefinitions=[
            {"AttributeName": "eventType", "AttributeType": "S"},
            {"AttributeName": "version", "AttributeType": "N"},
        ],
        KeySchema=[
            {"AttributeName": "eventType", "KeyType": "HASH"},
            {"AttributeName": "version", "KeyType": "RANGE"},
        ],
    )
    for name, pk, sk in (
        (CONSUMER_TABLE, "consumerId", "consumerId"),
        (HISTORY_TABLE, "recordId", "timestamp"),
    ):
        dynamodb.create_table(
            TableName=name,
            BillingMode="PAY_PER_REQUEST",
            AttributeDefinitions=[
                {"AttributeName": pk, "AttributeType": "S"},
                {"AttributeName": "eventType", "AttributeType": "S"},
                *([{"AttributeName": sk, "AttributeType": "S"}] if sk != pk else []),
            ],
            KeySchema=[{"AttributeName": pk, "KeyType": "HASH"}],
            GlobalSecondaryIndexes=[
                {
                    "IndexName": "EventTypeIndex",
                    "KeySchema": [
                        {"AttributeName": "eventType", "KeyType": "HASH"},
                        {"AttributeName": sk, "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                }
            ],
        )


@pytest.fixture
def aws_client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    for key, value in {
        "AWS_ACCESS_KEY_ID": "testing",
        "AWS_SECRET_ACCESS_KEY": "testing",
        "AWS_SESSION_TOKEN": "testing",
        "AWS_REGION": REGION,
        "EVENTGATE_STORAGE_BACKEND": "dynamodb",
        "EVENTGATE_EVENT_PUBLISHER": "eventbridge",
        "EVENT_CONTRACTS_TABLE_NAME": EVENT_TABLE,
        "CONSUMER_CONTRACTS_TABLE_NAME": CONSUMER_TABLE,
        "RELEASE_HISTORY_TABLE_NAME": HISTORY_TABLE,
        "EVENTBRIDGE_BUS_NAME": BUS,
    }.items():
        monkeypatch.setenv(key, value)

    with mock_aws():
        dynamodb = boto3.resource("dynamodb", region_name=REGION)
        _create_tables(dynamodb)
        boto3.client("events", region_name=REGION).create_event_bus(Name=BUS)
        seed_dynamodb(EVENT_TABLE, CONSUMER_TABLE, CONTRACTS_DIR, dynamodb_resource=dynamodb)
        clear_caches()
        yield TestClient(app)
        clear_caches()


def test_catalog_lists_every_seeded_event_type(aws_client: TestClient):
    catalog = aws_client.get("/api/v1/contracts/events").json()
    assert [c["eventType"] for c in catalog] == ["OrderPlaced", "PaymentCompleted", "UserCreated"]
    order = next(c for c in catalog if c["eventType"] == "OrderPlaced")
    assert order["versions"] == [1, 2, 3, 4]
    assert order["consumerCount"] == 3


def test_consumer_catalog_reads_catalog_item(aws_client: TestClient):
    consumers = aws_client.get("/api/v1/contracts/consumers").json()
    assert len(consumers) == 5
    assert "METADATA#CATALOG" not in {c["consumerId"] for c in consumers}


def test_unknown_version_and_event_are_distinct_404s(aws_client: TestClient):
    body = {"eventType": "OrderPlaced", "currentVersion": 1, "proposedVersion": 9}
    resp = aws_client.post("/api/v1/analyze", json=body)
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "UNSUPPORTED_EVENT_VERSION"
    resp = aws_client.post(
        "/api/v1/analyze", json={**body, "eventType": "Nope", "proposedVersion": 2}
    )
    assert resp.json()["error"]["code"] == "CONTRACT_NOT_FOUND"


def test_allowed_event_reaches_eventbridge_and_history(aws_client: TestClient):
    analysis_id = aws_client.post(
        "/api/v1/analyze",
        json={"eventType": "PaymentCompleted", "currentVersion": 1, "proposedVersion": 2},
    ).json()["analysisId"]

    resp = aws_client.post(
        "/api/v1/events/publish",
        json={
            "eventType": "PaymentCompleted",
            "currentVersion": 1,
            "proposedVersion": 2,
            "analysisId": analysis_id,
            "payload": {
                "paymentId": "p1",
                "orderId": "o1",
                "amount": 10,
                "currency": "INR",
                "paymentMethod": "card",
            },
        },
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["published"] is True
    assert body["eventBridgeEventId"] and not body["eventBridgeEventId"].startswith("local-")
    record = aws_client.get(f"/api/v1/history/{analysis_id}").json()
    assert record["published"] is True
    assert record["eventBridgeEventId"] == body["eventBridgeEventId"]


def test_unfiltered_history_spans_all_event_types(aws_client: TestClient):
    for event_type, proposed in (("OrderPlaced", 3), ("UserCreated", 2), ("PaymentCompleted", 2)):
        aws_client.post(
            "/api/v1/analyze",
            json={"eventType": event_type, "currentVersion": 1, "proposedVersion": proposed},
        )

    history = aws_client.get("/api/v1/history").json()

    assert {r["eventType"] for r in history} == {"OrderPlaced", "UserCreated", "PaymentCompleted"}
    timestamps = [r["timestamp"] for r in history]
    assert timestamps == sorted(timestamps, reverse=True)
    filtered = aws_client.get("/api/v1/history", params={"eventType": "UserCreated"}).json()
    assert [r["eventType"] for r in filtered] == ["UserCreated"]


def test_runtime_config_reports_aws_adapters(aws_client: TestClient):
    config = aws_client.get("/api/v1/config/runtime").json()
    assert config["storageBackendType"] == "dynamodb"
    assert config["contractsSource"] == EVENT_TABLE
    assert config["historyStore"] == HISTORY_TABLE
    assert config["eventBridgeBus"] == BUS
