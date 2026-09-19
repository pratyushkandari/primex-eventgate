"""Shared test fixtures for EventGate tests."""

from __future__ import annotations

from pathlib import Path

import pytest

from eventgate.domain.compatibility import CompatibilityEngine
from eventgate.domain.models import (
    ConsumerContract,
    ConsumerField,
    EventContract,
    EventField,
)
from eventgate.infrastructure.repositories.consumer_contract_repository import (
    JsonConsumerContractRepository,
)
from eventgate.infrastructure.repositories.event_contract_repository import (
    JsonEventContractRepository,
)

# Project root — pyproject.toml lives here.
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
CONTRACTS_DIR = PROJECT_ROOT / "contracts"


# ---------------------------------------------------------------------------
# Domain fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def engine():
    return CompatibilityEngine()


def make_event_field(name: str, type_: str, required: bool = True) -> EventField:
    return EventField(name=name, type=type_, required=required)


def make_event_contract(
    event_type: str = "OrderPlaced",
    version: int = 1,
    fields: dict[str, EventField] | None = None,
) -> EventContract:
    if fields is None:
        fields = {
            "orderId": make_event_field("orderId", "string"),
            "amount": make_event_field("amount", "number"),
        }
    return EventContract(event_type=event_type, version=version, fields=fields)


def make_consumer_field(name: str, type_: str, required: bool = True) -> ConsumerField:
    return ConsumerField(name=name, type=type_, required=required)


def make_consumer_contract(
    consumer_id: str = "test-consumer",
    event_type: str = "OrderPlaced",
    expected_fields: dict[str, ConsumerField] | None = None,
) -> ConsumerContract:
    if expected_fields is None:
        expected_fields = {
            "orderId": make_consumer_field("orderId", "string"),
            "amount": make_consumer_field("amount", "number"),
        }
    return ConsumerContract(
        consumer_id=consumer_id,
        event_type=event_type,
        expected_fields=expected_fields,
    )


# ---------------------------------------------------------------------------
# V1 baseline contract
# ---------------------------------------------------------------------------


@pytest.fixture
def v1_contract() -> EventContract:
    return EventContract(
        event_type="OrderPlaced",
        version=1,
        fields={
            "orderId": make_event_field("orderId", "string"),
            "amount": make_event_field("amount", "number"),
            "items": make_event_field("items", "array"),
            "shippingMethod": make_event_field("shippingMethod", "string"),
            "couponCode": make_event_field("couponCode", "string", required=False),
        },
    )


# ---------------------------------------------------------------------------
# Consumer contracts matching the demo fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def billing_consumer() -> ConsumerContract:
    return ConsumerContract(
        consumer_id="billing-service",
        event_type="OrderPlaced",
        expected_fields={
            "orderId": make_consumer_field("orderId", "string"),
            "amount": make_consumer_field("amount", "number"),
            "currency": make_consumer_field("currency", "string", required=False),
        },
    )


@pytest.fixture
def inventory_consumer() -> ConsumerContract:
    return ConsumerContract(
        consumer_id="inventory-service",
        event_type="OrderPlaced",
        expected_fields={
            "orderId": make_consumer_field("orderId", "string"),
            "items": make_consumer_field("items", "array"),
            "shippingMethod": make_consumer_field("shippingMethod", "string"),
        },
    )


@pytest.fixture
def analytics_consumer() -> ConsumerContract:
    return ConsumerContract(
        consumer_id="analytics-service",
        event_type="OrderPlaced",
        expected_fields={
            "orderId": make_consumer_field("orderId", "string"),
            "amount": make_consumer_field("amount", "number"),
            "couponCode": make_consumer_field("couponCode", "string", required=False),
        },
    )


# ---------------------------------------------------------------------------
# Repository fixtures (using real contract files)
# ---------------------------------------------------------------------------


@pytest.fixture
def event_repo() -> JsonEventContractRepository:
    return JsonEventContractRepository(CONTRACTS_DIR)


@pytest.fixture
def consumer_repo() -> JsonConsumerContractRepository:
    return JsonConsumerContractRepository(CONTRACTS_DIR)


# ---------------------------------------------------------------------------
# History Isolation Fixture
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def isolate_history_for_tests(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Ensure all tests run with an isolated temporary history repository."""
    from eventgate.api.dependencies import get_history_repo

    test_history_file = tmp_path / "reviews.json"
    test_history_file.write_text("[]", encoding="utf-8")
    monkeypatch.setenv("EVENTGATE_HISTORY_FILE", str(test_history_file))
    get_history_repo.cache_clear()
    yield test_history_file
    get_history_repo.cache_clear()
