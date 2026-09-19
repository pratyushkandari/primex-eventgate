"""Release policy inspection and runtime configuration routes."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from eventgate.config.settings import (
    PUBLISHER_BACKEND_EVENTBRIDGE,
    STORAGE_BACKEND_DYNAMODB,
    get_aws_region,
    get_contracts_dir,
    get_event_publisher_backend,
    get_eventbridge_bus_name,
    get_storage_backend,
)
from eventgate.domain.policy import get_policy_engine_type

router = APIRouter(prefix="/api/v1", tags=["Policies & Configuration"])


class PolicyMatrixRow(BaseModel):
    environment: str
    low: str
    medium: str
    high: str


class PolicyInspectionResponse(BaseModel):
    activeEngine: str = Field(..., description="Active policy provider key ('standard' or 'cedar')")
    engineName: str = Field(..., description="Display title for policy engine")
    description: str = Field(..., description="Explanation of the engine behavior")
    matrix: list[PolicyMatrixRow] = Field(..., description="Authoritative release policy matrix")
    cedarPolicyAvailable: bool = Field(
        ..., description="Whether Cedar policy definition is present"
    )
    cedarPolicyText: str | None = Field(None, description="Cedar policy specification source")


class RuntimeConfigResponse(BaseModel):
    environment: str
    storageBackend: str
    storageBackendType: str
    publisherBackend: str
    publisherBackendType: str
    awsRegion: str
    eventBridgeBus: str
    policyEngine: str
    policyEngineType: str
    contractsDirectory: str


def _load_cedar_policy_text() -> str | None:
    # Search upwards from current file or root
    candidates = [
        Path("policies/release_policy.cedar"),
        Path(__file__).resolve().parent.parent.parent.parent.parent
        / "policies"
        / "release_policy.cedar",
    ]
    for p in candidates:
        if p.exists():
            try:
                return p.read_text(encoding="utf-8")
            except Exception:
                pass
    return None


@router.get(
    "/policies",
    response_model=PolicyInspectionResponse,
    summary="Inspect release policy matrix and active engine definition",
)
def get_policies() -> dict[str, Any]:
    engine_key = get_policy_engine_type()
    engine_name = (
        "Cedar Policy Engine" if engine_key == "cedar" else "Standard Deterministic Engine"
    )
    description = (
        "Formal AWS Cedar policy evaluator executing Cedar language rules."
        if engine_key == "cedar"
        else "Deterministic pure policy engine evaluating the 3x3 environment/severity matrix."
    )
    matrix = [
        {"environment": "production", "low": "ALLOW", "medium": "REVIEW", "high": "BLOCK"},
        {"environment": "staging", "low": "ALLOW", "medium": "REVIEW", "high": "BLOCK"},
        {
            "environment": "development",
            "low": "ALLOW",
            "medium": "ALLOW with warning",
            "high": "BLOCK",
        },
    ]
    cedar_text = _load_cedar_policy_text()

    return {
        "activeEngine": engine_key,
        "engineName": engine_name,
        "description": description,
        "matrix": matrix,
        "cedarPolicyAvailable": cedar_text is not None,
        "cedarPolicyText": cedar_text,
    }


@router.get(
    "/config/runtime",
    response_model=RuntimeConfigResponse,
    summary="Inspect authoritative runtime platform configuration",
)
def get_runtime_configuration() -> dict[str, Any]:
    storage_raw = get_storage_backend()
    storage_display = (
        "Amazon DynamoDB (Single-Table Indexed Access)"
        if storage_raw == STORAGE_BACKEND_DYNAMODB
        else "Local JSON Filesystem (Isolated Local Mode)"
    )

    pub_raw = get_event_publisher_backend()
    pub_display = (
        "Amazon EventBridge (Production Bus Ingestion)"
        if pub_raw == PUBLISHER_BACKEND_EVENTBRIDGE
        else "Local In-Memory Publisher (Zero-Cloud Mode)"
    )

    engine_key = get_policy_engine_type()
    engine_display = (
        "Cedar Policy Engine (cedarpy)"
        if engine_key == "cedar"
        else "Standard Deterministic Engine"
    )

    env_name = os.environ.get("EVENTGATE_ENVIRONMENT", "production")

    return {
        "environment": env_name,
        "storageBackend": storage_display,
        "storageBackendType": storage_raw,
        "publisherBackend": pub_display,
        "publisherBackendType": pub_raw,
        "awsRegion": get_aws_region(),
        "eventBridgeBus": get_eventbridge_bus_name(),
        "policyEngine": engine_display,
        "policyEngineType": engine_key,
        "contractsDirectory": str(get_contracts_dir()),
    }
