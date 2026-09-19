"""Integration tests for release history and report export endpoints."""

import json

from fastapi.testclient import TestClient

from eventgate.main import app

client = TestClient(app)


def test_list_history_returns_200():
    """History endpoint is responsive and returns a list."""
    response = client.get("/api/v1/history")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_analyze_persists_history_record():
    """POST /api/v1/analyze automatically creates a persistent release review record."""
    body = {
        "eventType": "OrderPlaced",
        "currentVersion": 1,
        "proposedVersion": 2,
        "environment": "production",
    }
    analyze_resp = client.post("/api/v1/analyze", json=body)
    assert analyze_resp.status_code == 200
    analysis_data = analyze_resp.json()
    analysis_id = analysis_data["analysisId"]

    # Verify history lists this record
    history_resp = client.get(f"/api/v1/history/{analysis_id}")
    assert history_resp.status_code == 200
    record = history_resp.json()
    assert record["recordId"] == analysis_id
    assert record["eventType"] == "OrderPlaced"
    assert record["decision"] == "ALLOW"
    assert record["published"] is False
    assert record["attemptedPublish"] is False


def test_export_history_report():
    """GET /api/v1/history/{record_id}/report generates Markdown and JSON reports."""
    # Create an analysis record first
    body = {
        "eventType": "OrderPlaced",
        "currentVersion": 1,
        "proposedVersion": 3,
        "environment": "production",
    }
    analyze_resp = client.post("/api/v1/analyze", json=body)
    assert analyze_resp.status_code == 200
    analysis_id = analyze_resp.json()["analysisId"]

    # Markdown report
    md_resp = client.get(f"/api/v1/history/{analysis_id}/report?format=markdown")
    assert md_resp.status_code == 200
    md_data = md_resp.json()
    assert md_data["format"] == "markdown"
    assert "# EventGate Release Review Report" in md_data["content"]
    assert "OrderPlaced" in md_data["content"]

    # JSON report
    json_resp = client.get(f"/api/v1/history/{analysis_id}/report?format=json")
    assert json_resp.status_code == 200
    json_data = json_resp.json()
    assert json_data["format"] == "json"
    parsed = json.loads(json_data["content"])
    assert parsed["record_id"] == analysis_id


def test_export_active_report_direct():
    """POST /api/v1/reports/export generates reports from in-memory review state."""
    body = {
        "analysisId": "mem-analysis-123",
        "eventType": "PaymentCompleted",
        "currentVersion": 1,
        "proposedVersion": 2,
        "environment": "staging",
        "compatibilityResult": "SAFE",
        "severity": "LOW",
        "policyName": "StandardReleasePolicy",
        "policyReason": "Safe release",
        "decision": "ALLOW",
        "format": "markdown",
    }
    resp = client.post("/api/v1/reports/export", json=body)
    assert resp.status_code == 200
    data = resp.json()
    assert data["format"] == "markdown"
    assert "PaymentCompleted" in data["content"]


def test_publish_updates_correlated_history_record():
    """POST /api/v1/events/publish with analysisId updates the existing review record."""
    # 1. Analyze safe change
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
    analysis_id = analyze_resp.json()["analysisId"]

    # 2. Publish with correlated analysisId
    payload = {
        "orderId": "ord-456",
        "amount": 99.5,
        "items": ["item1"],
        "shippingMethod": "express",
        "notes": "safe note",
    }
    pub_resp = client.post(
        "/api/v1/events/publish",
        json={
            "eventType": "OrderPlaced",
            "currentVersion": 1,
            "proposedVersion": 2,
            "payload": payload,
            "environment": "production",
            "analysisId": analysis_id,
        },
    )
    assert pub_resp.status_code == 200

    # 3. Verify the same record was updated to published=True
    hist_resp = client.get(f"/api/v1/history/{analysis_id}")
    assert hist_resp.status_code == 200
    rec = hist_resp.json()
    assert rec["recordId"] == analysis_id
    assert rec["published"] is True
    assert rec["attemptedPublish"] is True
    assert rec["eventId"] is not None


def test_publish_blocked_records_attempted_publish_in_history():
    """Publishing a breaking change updates history with attemptedPublish=True."""
    # 1. Analyze breaking change
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
    analysis_id = analyze_resp.json()["analysisId"]

    # 2. Attempt publish (fails with 409 Conflict)
    payload = {
        "orderId": "ord-789",
        "amount": 150.0,
        "items": ["itemA"],
        "shippingMethod": {"carrier": "DHL"},  # broken schema
    }
    pub_resp = client.post(
        "/api/v1/events/publish",
        json={
            "eventType": "OrderPlaced",
            "currentVersion": 1,
            "proposedVersion": 3,
            "payload": payload,
            "environment": "production",
            "analysisId": analysis_id,
        },
    )
    assert pub_resp.status_code == 409

    # 3. Check history record
    hist_resp = client.get(f"/api/v1/history/{analysis_id}")
    assert hist_resp.status_code == 200
    rec = hist_resp.json()
    assert rec["recordId"] == analysis_id
    assert rec["published"] is False
    assert rec["attemptedPublish"] is True
    assert rec["error"] is not None


def test_get_history_record_not_found_returns_404():
    """Requesting non-existent record returns HTTP 404 with RELEASE_RECORD_NOT_FOUND."""
    resp = client.get("/api/v1/history/non-existent-record-id-9999")
    assert resp.status_code == 404
    data = resp.json()
    assert data["error"]["code"] == "RELEASE_RECORD_NOT_FOUND"
