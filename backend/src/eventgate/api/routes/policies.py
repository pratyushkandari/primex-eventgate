"""Read-only inspection endpoints for the active release policy and runtime adapters."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from eventgate.config.settings import (
    PUBLISHER_BACKEND_EVENTBRIDGE,
    SERVICE_VERSION,
    STORAGE_BACKEND_DYNAMODB,
    get_aws_region,
    get_event_contracts_table_name,
    get_event_publisher_backend,
    get_eventbridge_bus_name,
    get_release_history_table_name,
    get_storage_backend,
)
from eventgate.domain.errors import ConfigurationError
from eventgate.domain.policy import get_policy_engine_type, load_cedar_policy_text, policy_matrix

router = APIRouter(prefix="/api/v1", tags=["Policies & Configuration"])


class PolicyMatrixRow(BaseModel):
    environment: str
    low: str
    medium: str
    high: str


class PolicyInspectionResponse(BaseModel):
    activeEngine: str = Field(..., description="Active policy provider key ('standard' or 'cedar')")
    engineName: str = Field(..., description="Display name of the active engine")
    description: str = Field(..., description="What the active engine evaluates")
    matrix: list[PolicyMatrixRow] = Field(..., description="Decision per environment and severity")
    cedarPolicyAvailable: bool = Field(..., description="Whether the Cedar policy file is readable")
    cedarPolicyText: str | None = Field(None, description="Cedar policy source")


class RuntimeConfigResponse(BaseModel):
    serviceVersion: str
    storageBackend: str
    storageBackendType: str
    contractsSource: str
    historyStore: str
    publisherBackend: str
    publisherBackendType: str
    eventBridgeBus: str | None
    awsRegion: str
    policyEngine: str
    policyEngineType: str


@router.get(
    "/policies",
    response_model=PolicyInspectionResponse,
    summary="Active release policy engine, decision matrix and Cedar source",
)
def get_policies() -> PolicyInspectionResponse:
    engine_key = get_policy_engine_type()
    try:
        cedar_text: str | None = load_cedar_policy_text()
    except ConfigurationError:
        cedar_text = None

    if engine_key == "cedar":
        name, description = "Cedar policy engine", "Evaluates the Cedar policy below with cedarpy."
    else:
        name, description = (
            "Standard policy engine",
            "Applies the environment and severity matrix in Python.",
        )

    return PolicyInspectionResponse(
        activeEngine=engine_key,
        engineName=name,
        description=description,
        matrix=[PolicyMatrixRow(**row) for row in policy_matrix()],
        cedarPolicyAvailable=cedar_text is not None,
        cedarPolicyText=cedar_text,
    )


@router.get(
    "/config/runtime",
    response_model=RuntimeConfigResponse,
    summary="Adapters and settings the running service was started with",
)
def get_runtime_configuration() -> RuntimeConfigResponse:
    storage = get_storage_backend()
    publisher = get_event_publisher_backend()
    engine_key = get_policy_engine_type()
    on_dynamo = storage == STORAGE_BACKEND_DYNAMODB
    on_eventbridge = publisher == PUBLISHER_BACKEND_EVENTBRIDGE

    return RuntimeConfigResponse(
        serviceVersion=SERVICE_VERSION,
        storageBackend="Amazon DynamoDB" if on_dynamo else "Local JSON files",
        storageBackendType=storage,
        contractsSource=get_event_contracts_table_name() if on_dynamo else "contracts/ directory",
        historyStore=get_release_history_table_name() if on_dynamo else "Local JSON file",
        publisherBackend="Amazon EventBridge" if on_eventbridge else "In-memory (local)",
        publisherBackendType=publisher,
        eventBridgeBus=get_eventbridge_bus_name() if on_eventbridge else None,
        awsRegion=get_aws_region(),
        policyEngine="Cedar (cedarpy)" if engine_key == "cedar" else "Standard",
        policyEngineType=engine_key,
    )
