"""Contracts catalog endpoints:

GET /api/v1/contracts/events
GET /api/v1/contracts/events/{eventType}
GET /api/v1/contracts/consumers
GET /api/v1/contracts/consumers/{consumerId}
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field

from eventgate.api.dependencies import get_catalog_service, get_request_id
from eventgate.application.services.contract_catalog_service import ContractCatalogService

router = APIRouter(prefix="/api/v1/contracts", tags=["contracts"])


# ---------------------------------------------------------------------------
# Response Models (camelCase for frontend)
# ---------------------------------------------------------------------------


class EventCatalogSummaryResponse(BaseModel):
    model_config = {"populate_by_name": True}

    event_type: str = Field(..., alias="eventType")
    version_count: int = Field(..., alias="versionCount")
    versions: list[int]
    latest_version: int = Field(..., alias="latestVersion")
    consumer_count: int = Field(..., alias="consumerCount")


class EventFieldResponse(BaseModel):
    name: str
    type: str
    required: bool


class EventContractVersionResponse(BaseModel):
    model_config = {"populate_by_name": True}

    event_type: str = Field(..., alias="eventType")
    version: int
    fields: dict[str, EventFieldResponse]


class ConsumerFieldResponse(BaseModel):
    name: str
    type: str
    required: bool


class SubscribedConsumerResponse(BaseModel):
    model_config = {"populate_by_name": True}

    consumer_id: str = Field(..., alias="consumerId")
    event_type: str = Field(..., alias="eventType")
    expected_fields: dict[str, ConsumerFieldResponse] = Field(..., alias="expectedFields")


class EventDetailResponse(BaseModel):
    model_config = {"populate_by_name": True}

    event_type: str = Field(..., alias="eventType")
    version_count: int = Field(..., alias="versionCount")
    versions: list[int]
    latest_version: int = Field(..., alias="latestVersion")
    contracts: list[EventContractVersionResponse]
    consumers: list[SubscribedConsumerResponse]


class ConsumerSummaryResponse(BaseModel):
    model_config = {"populate_by_name": True}

    consumer_id: str = Field(..., alias="consumerId")
    event_type: str = Field(..., alias="eventType")
    expected_fields_count: int = Field(..., alias="expectedFieldsCount")


class ConsumerDetailResponse(BaseModel):
    model_config = {"populate_by_name": True}

    consumer_id: str = Field(..., alias="consumerId")
    event_type: str = Field(..., alias="eventType")
    expected_fields: dict[str, ConsumerFieldResponse] = Field(..., alias="expectedFields")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get(
    "/events",
    response_model=list[EventCatalogSummaryResponse],
    response_model_by_alias=True,
    summary="List event catalog",
    description="Returns all registered event types with versions and consumer counts.",
)
def list_event_catalog(
    response: Response,
    service: ContractCatalogService = Depends(get_catalog_service),
    request_id: str = Depends(get_request_id),
) -> list[EventCatalogSummaryResponse]:
    response.headers["X-Request-ID"] = request_id
    catalog = service.get_event_catalog()
    return [
        EventCatalogSummaryResponse(
            event_type=item.event_type,
            version_count=item.version_count,
            versions=item.versions,
            latest_version=item.latest_version,
            consumer_count=item.consumer_count,
        )
        for item in catalog
    ]


@router.get(
    "/events/{event_type}",
    response_model=EventDetailResponse,
    response_model_by_alias=True,
    summary="Get event contract detail",
    description="Returns all version schemas and subscribed consumers for an event type.",
)
def get_event_detail(
    event_type: str,
    response: Response,
    service: ContractCatalogService = Depends(get_catalog_service),
    request_id: str = Depends(get_request_id),
) -> EventDetailResponse:
    response.headers["X-Request-ID"] = request_id
    detail = service.get_event_detail(event_type)
    return EventDetailResponse(
        event_type=detail.event_type,
        version_count=detail.version_count,
        versions=detail.versions,
        latest_version=detail.latest_version,
        contracts=[
            EventContractVersionResponse(
                event_type=c.event_type,
                version=c.version,
                fields={
                    fname: EventFieldResponse(
                        name=fspec.name,
                        type=fspec.type,
                        required=fspec.required,
                    )
                    for fname, fspec in c.fields.items()
                },
            )
            for c in detail.contracts
        ],
        consumers=[
            SubscribedConsumerResponse(
                consumer_id=cons.consumer_id,
                event_type=cons.event_type,
                expected_fields={
                    fname: ConsumerFieldResponse(
                        name=fspec.name,
                        type=fspec.type,
                        required=fspec.required,
                    )
                    for fname, fspec in cons.expected_fields.items()
                },
            )
            for cons in detail.consumers
        ],
    )


@router.get(
    "/consumers",
    response_model=list[ConsumerSummaryResponse],
    response_model_by_alias=True,
    summary="List consumer catalog",
    description="Returns all registered downstream consumers with subscription metadata.",
)
def list_consumer_catalog(
    response: Response,
    service: ContractCatalogService = Depends(get_catalog_service),
    request_id: str = Depends(get_request_id),
) -> list[ConsumerSummaryResponse]:
    response.headers["X-Request-ID"] = request_id
    consumers = service.get_consumer_catalog()
    return [
        ConsumerSummaryResponse(
            consumer_id=c.consumer_id,
            event_type=c.event_type,
            expected_fields_count=c.expected_fields_count,
        )
        for c in consumers
    ]


@router.get(
    "/consumers/{consumer_id}",
    response_model=ConsumerDetailResponse,
    response_model_by_alias=True,
    summary="Get consumer contract detail",
    description="Returns expected fields and types for a specific downstream consumer.",
)
def get_consumer_detail(
    consumer_id: str,
    response: Response,
    service: ContractCatalogService = Depends(get_catalog_service),
    request_id: str = Depends(get_request_id),
) -> ConsumerDetailResponse:
    response.headers["X-Request-ID"] = request_id
    consumer = service.get_consumer_detail(consumer_id)
    return ConsumerDetailResponse(
        consumer_id=consumer.consumer_id,
        event_type=consumer.event_type,
        expected_fields={
            fname: ConsumerFieldResponse(
                name=fspec.name,
                type=fspec.type,
                required=fspec.required,
            )
            for fname, fspec in consumer.expected_fields.items()
        },
    )
