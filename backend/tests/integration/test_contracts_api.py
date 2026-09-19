"""Integration tests for contracts catalog endpoints."""

from fastapi.testclient import TestClient

from eventgate.main import app

client = TestClient(app)


def test_get_events_catalog():
    response = client.get("/api/v1/contracts/events")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 3

    event_names = [e["eventType"] for e in data]
    assert "OrderPlaced" in event_names
    assert "PaymentCompleted" in event_names
    assert "UserCreated" in event_names


def test_get_event_detail():
    response = client.get("/api/v1/contracts/events/OrderPlaced")
    assert response.status_code == 200
    data = response.json()
    assert data["eventType"] == "OrderPlaced"
    assert data["versionCount"] == 4
    assert len(data["contracts"]) == 4
    assert len(data["consumers"]) == 3


def test_get_event_detail_404():
    response = client.get("/api/v1/contracts/events/NonExistent")
    assert response.status_code == 404


def test_get_consumers_catalog():
    response = client.get("/api/v1/contracts/consumers")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 5

    cids = [c["consumerId"] for c in data]
    assert "inventory-service" in cids
    assert "billing-service" in cids
    assert "analytics-service" in cids


def test_get_consumer_detail():
    response = client.get("/api/v1/contracts/consumers/inventory-service")
    assert response.status_code == 200
    data = response.json()
    assert data["consumerId"] == "inventory-service"
    assert data["eventType"] == "OrderPlaced"
    assert "shippingMethod" in data["expectedFields"]


def test_get_consumer_detail_404():
    response = client.get("/api/v1/contracts/consumers/non-existent-consumer")
    assert response.status_code == 404
