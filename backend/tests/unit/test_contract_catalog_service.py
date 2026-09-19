"""Unit tests for ContractCatalogService."""

import pytest

from eventgate.application.services.contract_catalog_service import (
    ContractCatalogService,
)
from eventgate.config.settings import get_contracts_dir
from eventgate.domain.errors import ContractNotFoundError, InvalidAnalysisRequestError
from eventgate.infrastructure.repositories.consumer_contract_repository import (
    JsonConsumerContractRepository,
)
from eventgate.infrastructure.repositories.event_contract_repository import (
    JsonEventContractRepository,
)


@pytest.fixture
def catalog_service():
    contracts_dir = get_contracts_dir()
    event_repo = JsonEventContractRepository(contracts_dir)
    consumer_repo = JsonConsumerContractRepository(contracts_dir)
    return ContractCatalogService(event_repo=event_repo, consumer_repo=consumer_repo)


def test_get_event_catalog(catalog_service):
    catalog = catalog_service.get_event_catalog()
    assert len(catalog) >= 3

    event_types = [item.event_type for item in catalog]
    assert "OrderPlaced" in event_types
    assert "PaymentCompleted" in event_types
    assert "UserCreated" in event_types

    order_placed = next(item for item in catalog if item.event_type == "OrderPlaced")
    assert order_placed.version_count == 4
    assert order_placed.latest_version == 4
    assert order_placed.consumer_count == 3


def test_get_event_detail_success(catalog_service):
    detail = catalog_service.get_event_detail("OrderPlaced")
    assert detail.event_type == "OrderPlaced"
    assert detail.version_count == 4
    assert detail.latest_version == 4
    assert len(detail.contracts) == 4
    assert len(detail.consumers) == 3

    consumer_ids = [c.consumer_id for c in detail.consumers]
    assert "billing-service" in consumer_ids
    assert "inventory-service" in consumer_ids
    assert "analytics-service" in consumer_ids


def test_get_event_detail_not_found(catalog_service):
    with pytest.raises(ContractNotFoundError):
        catalog_service.get_event_detail("NonExistentEvent")


def test_get_event_detail_empty_input(catalog_service):
    with pytest.raises(InvalidAnalysisRequestError):
        catalog_service.get_event_detail("")


def test_get_consumer_catalog(catalog_service):
    consumers = catalog_service.get_consumer_catalog()
    assert len(consumers) >= 5

    consumer_ids = [c.consumer_id for c in consumers]
    assert "billing-service" in consumer_ids
    assert "inventory-service" in consumer_ids
    assert "analytics-service" in consumer_ids
    assert "fraud-detection-service" in consumer_ids
    assert "notification-service" in consumer_ids


def test_get_consumer_detail_success(catalog_service):
    consumer = catalog_service.get_consumer_detail("inventory-service")
    assert consumer.consumer_id == "inventory-service"
    assert consumer.event_type == "OrderPlaced"
    assert "shippingMethod" in consumer.expected_fields
    assert consumer.expected_fields["shippingMethod"].type == "string"


def test_get_consumer_detail_not_found(catalog_service):
    with pytest.raises(ContractNotFoundError):
        catalog_service.get_consumer_detail("unknown-consumer")


def test_get_consumer_detail_empty_input(catalog_service):
    with pytest.raises(InvalidAnalysisRequestError):
        catalog_service.get_consumer_detail("   ")
