"""Unit tests for policy inspection and runtime configuration routes."""

import pytest
from fastapi.testclient import TestClient

from eventgate.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_get_policies_default(client):
    response = client.get("/api/v1/policies")
    assert response.status_code == 200
    data = response.json()
    assert data["activeEngine"] in ("standard", "cedar")
    assert "matrix" in data
    assert len(data["matrix"]) == 3
    envs = {row["environment"] for row in data["matrix"]}
    assert envs == {"production", "staging", "development"}
    assert data["cedarPolicyAvailable"] is True
    assert "PROD_BLOCK_BREAK" in (data["cedarPolicyText"] or "")


def test_get_policies_cedar(client, monkeypatch):
    monkeypatch.setenv("EVENTGATE_POLICY_ENGINE", "cedar")
    response = client.get("/api/v1/policies")
    assert response.status_code == 200
    data = response.json()
    assert data["activeEngine"] == "cedar"
    assert "Cedar" in data["engineName"]


def test_get_runtime_configuration(client):
    response = client.get("/api/v1/config/runtime")
    assert response.status_code == 200
    data = response.json()
    assert "environment" in data
    assert "storageBackend" in data
    assert "storageBackendType" in data
    assert "publisherBackend" in data
    assert "awsRegion" in data
    assert "eventBridgeBus" in data
    assert "policyEngine" in data
    assert "contractsDirectory" in data
