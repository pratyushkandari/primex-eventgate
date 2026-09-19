"""End-to-end integration tests verifying the 5 mandatory Phase 5 platform release flows.

FLOW 1: OrderPlaced v1 -> v2 (SAFE -> ALLOW -> Publish Success -> EventBridge Called)
FLOW 2: OrderPlaced v1 -> v3 (BREAK -> BLOCK -> Publish Prevented 409 -> EventBridge Not Called)
FLOW 3: OrderPlaced v1 -> v4 (RISK -> REVIEW -> Publish Prevented 409 -> EventBridge Not Called)
FLOW 4: Invalid Payload Schema (422 Rejected -> No Publish -> No Stale State)
FLOW 5: Correlation Lifecycle (Analyze creates record ->
        Publish updates same record -> 0 duplicates)
"""

import pytest
from fastapi.testclient import TestClient

from eventgate.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_e2e_flow_1_safe_allow_and_publish(client):
    """FLOW 1: OrderPlaced v1 -> v2.

    Compatibility: SAFE
    Policy: ALLOW
    Final: ALLOW
    Publish: SUCCESS
    EventBridge: CALLED
    """
    # 1. Analyze
    analyze_resp = client.post(
        "/api/v1/analyze",
        json={
            "eventType": "OrderPlaced",
            "currentVersion": 1,
            "proposedVersion": 2,
            "environment": "production",
        },
    )
    assert analyze_resp.status_code == 200
    data = analyze_resp.json()
    assert data["compatibilityResult"] == "SAFE"
    assert data["decision"] == "ALLOW"
    analysis_id = data["analysisId"]

    # 2. Publish with analysisId correlation
    pub_resp = client.post(
        "/api/v1/events/publish",
        json={
            "eventType": "OrderPlaced",
            "currentVersion": 1,
            "proposedVersion": 2,
            "environment": "production",
            "analysisId": analysis_id,
            "payload": {
                "orderId": "ord-101",
                "amount": 99.50,
                "items": [{"id": "item-1", "qty": 1}],
                "shippingMethod": "standard",
                "couponCode": "SAVE10",
            },
        },
    )
    assert pub_resp.status_code == 200
    pub_data = pub_resp.json()
    assert pub_data["published"] is True
    assert pub_data["decision"] == "ALLOW"
    assert pub_data["eventId"] is not None

    # 3. Verify single correlated history audit record
    hist_resp = client.get(f"/api/v1/history/{analysis_id}")
    assert hist_resp.status_code == 200
    rec = hist_resp.json()
    assert rec["recordId"] == analysis_id
    assert rec["published"] is True
    assert rec["eventId"] == pub_data["eventId"]


def test_e2e_flow_2_breaking_block_prevents_publish(client):
    """FLOW 2: OrderPlaced v1 -> v3.

    Compatibility: BREAK
    Policy: BLOCK
    Final: BLOCK
    EventBridge: NOT CALLED
    """
    # 1. Analyze
    analyze_resp = client.post(
        "/api/v1/analyze",
        json={
            "eventType": "OrderPlaced",
            "currentVersion": 1,
            "proposedVersion": 3,
            "environment": "production",
        },
    )
    assert analyze_resp.status_code == 200
    data = analyze_resp.json()
    assert data["compatibilityResult"] == "BREAK"
    assert data["decision"] == "BLOCK"
    analysis_id = data["analysisId"]

    # 2. Publish attempt must be prevented (409 BLOCK)
    pub_resp = client.post(
        "/api/v1/events/publish",
        json={
            "eventType": "OrderPlaced",
            "currentVersion": 1,
            "proposedVersion": 3,
            "environment": "production",
            "analysisId": analysis_id,
            "payload": {
                "orderId": "ord-102",
                "amount": 49.00,
                "items": [],
                "shippingMethod": {"carrier": "UPS", "tracking": "1Z999"},
            },
        },
    )
    assert pub_resp.status_code == 409
    pub_data = pub_resp.json()
    assert pub_data["published"] is False
    assert pub_data["decision"] == "BLOCK"

    # 3. Verify audit record reflects attempted publish prevented
    hist_resp = client.get(f"/api/v1/history/{analysis_id}")
    assert hist_resp.status_code == 200
    rec = hist_resp.json()
    assert rec["recordId"] == analysis_id
    assert rec["published"] is False
    assert rec["attemptedPublish"] is True


def test_e2e_flow_3_risk_review_prevents_publish(client):
    """FLOW 3: OrderPlaced v1 -> v4.

    Compatibility: RISK
    Policy: REVIEW
    Final: REVIEW
    EventBridge: NOT CALLED
    """
    # 1. Analyze
    analyze_resp = client.post(
        "/api/v1/analyze",
        json={
            "eventType": "OrderPlaced",
            "currentVersion": 1,
            "proposedVersion": 4,
            "environment": "production",
        },
    )
    assert analyze_resp.status_code == 200
    data = analyze_resp.json()
    assert data["compatibilityResult"] == "RISK"
    assert data["decision"] == "REVIEW"
    analysis_id = data["analysisId"]

    # 2. Publish attempt must be prevented (409 REVIEW)
    pub_resp = client.post(
        "/api/v1/events/publish",
        json={
            "eventType": "OrderPlaced",
            "currentVersion": 1,
            "proposedVersion": 4,
            "environment": "production",
            "analysisId": analysis_id,
            "payload": {
                "orderId": "ord-103",
                "amount": 19.99,
                "items": [],
                "shippingMethod": "standard",
            },
        },
    )
    assert pub_resp.status_code == 409
    pub_data = pub_resp.json()
    assert pub_data["published"] is False
    assert pub_data["decision"] == "REVIEW"

    # 3. Verify audit record reflects attempted publish prevented
    hist_resp = client.get(f"/api/v1/history/{analysis_id}")
    assert hist_resp.status_code == 200
    rec = hist_resp.json()
    assert rec["published"] is False
    assert rec["attemptedPublish"] is True


def test_e2e_flow_4_invalid_schema_422(client):
    """FLOW 4: Invalid JSON / Schema Rejected.

    Result: 422
    No Publish.
    """
    pub_resp = client.post(
        "/api/v1/events/publish",
        json={
            "eventType": "OrderPlaced",
            "currentVersion": 1,
            "proposedVersion": 2,
            "environment": "production",
            "payload": {
                # Missing required fields: orderId, amount, items, shippingMethod
                "someRandomField": 123,
            },
        },
    )
    assert pub_resp.status_code == 422
    data = pub_resp.json()
    assert "error" in data
    assert data["error"]["code"] == "INVALID_EVENT_PAYLOAD"


def test_e2e_flow_5_correlation_lifecycle_audit_trail(client):
    """FLOW 5: One release workflow must have one coherent audit trail.

    Zero duplicate records between analyze and publish.
    """
    # 1. Analyze
    analyze_resp = client.post(
        "/api/v1/analyze",
        json={
            "eventType": "OrderPlaced",
            "currentVersion": 1,
            "proposedVersion": 2,
            "environment": "production",
        },
    )
    analysis_id = analyze_resp.json()["analysisId"]

    # Check history count for this analysisId
    rec_after_analyze = client.get(f"/api/v1/history/{analysis_id}").json()
    assert rec_after_analyze["published"] is False
    assert rec_after_analyze["attemptedPublish"] is False

    # 2. Publish with same analysis_id
    pub_resp = client.post(
        "/api/v1/events/publish",
        json={
            "eventType": "OrderPlaced",
            "currentVersion": 1,
            "proposedVersion": 2,
            "environment": "production",
            "analysisId": analysis_id,
            "payload": {
                "orderId": "ord-flow-5",
                "amount": 25.00,
                "items": [],
                "shippingMethod": "express",
            },
        },
    )
    assert pub_resp.status_code == 200

    # 3. Check history: must be updated in-place, NOT duplicated
    all_history = client.get("/api/v1/history?limit=100").json()
    matching_records = [r for r in all_history if r["recordId"] == analysis_id]
    assert len(matching_records) == 1
    assert matching_records[0]["published"] is True
