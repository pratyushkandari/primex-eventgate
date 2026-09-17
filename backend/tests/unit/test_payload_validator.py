"""Unit tests for deterministic payload validator."""

import pytest

from eventgate.domain.errors import InvalidEventPayloadError
from eventgate.domain.models import EventContract, EventField
from eventgate.domain.payload_validator import check_field_type, validate_event_payload


@pytest.fixture
def sample_contract() -> EventContract:
    return EventContract(
        event_type="OrderPlaced",
        version=1,
        fields={
            "orderId": EventField("orderId", "string", True),
            "amount": EventField("amount", "number", True),
            "itemCount": EventField("itemCount", "integer", True),
            "isExpress": EventField("isExpress", "boolean", True),
            "items": EventField("items", "array", True),
            "customer": EventField("customer", "object", True),
            "notes": EventField("notes", "string", False),
            "nullableField": EventField("nullableField", "null", False),
        },
    )


def test_valid_payload_passes(sample_contract: EventContract) -> None:
    payload = {
        "orderId": "O100",
        "amount": 99.5,
        "itemCount": 3,
        "isExpress": True,
        "items": ["SKU1"],
        "customer": {"name": "Alice"},
        "notes": "Fast delivery",
    }
    # Should not raise
    validate_event_payload(payload, sample_contract)


def test_missing_required_field_raises(sample_contract: EventContract) -> None:
    payload = {
        "amount": 99.5,
        "itemCount": 3,
        "isExpress": True,
        "items": ["SKU1"],
        "customer": {"name": "Alice"},
    }
    with pytest.raises(InvalidEventPayloadError, match="Missing required field: 'orderId'"):
        validate_event_payload(payload, sample_contract)


def test_missing_optional_field_passes(sample_contract: EventContract) -> None:
    payload = {
        "orderId": "O100",
        "amount": 99.5,
        "itemCount": 3,
        "isExpress": False,
        "items": [],
        "customer": {},
    }
    validate_event_payload(payload, sample_contract)


def test_extra_unknown_fields_allowed_open_world(sample_contract: EventContract) -> None:
    payload = {
        "orderId": "O100",
        "amount": 50,
        "itemCount": 1,
        "isExpress": False,
        "items": [],
        "customer": {},
        "extraField1": "allowed",
        "extraField2": 12345,
    }
    validate_event_payload(payload, sample_contract)


def test_non_dict_payload_raises(sample_contract: EventContract) -> None:
    with pytest.raises(InvalidEventPayloadError, match="must be a JSON object"):
        validate_event_payload("not a dict", sample_contract)

    with pytest.raises(InvalidEventPayloadError, match="must be a JSON object"):
        validate_event_payload(["list"], sample_contract)


def test_boolean_is_not_treated_as_integer_or_number() -> None:
    # Python quirk: isinstance(True, int) is True!
    # Our validator must explicitly reject True/False for integer and number fields.
    assert check_field_type(True, "boolean") is True
    assert check_field_type(False, "boolean") is True
    assert check_field_type(True, "integer") is False
    assert check_field_type(False, "integer") is False
    assert check_field_type(True, "number") is False
    assert check_field_type(False, "number") is False


def test_integer_and_number_types() -> None:
    assert check_field_type(42, "integer") is True
    assert check_field_type(42, "number") is True
    assert check_field_type(42.5, "number") is True
    assert check_field_type(42.5, "integer") is False
    assert check_field_type("42", "number") is False


def test_type_mismatch_raises(sample_contract: EventContract) -> None:
    # amount expects number, pass string
    payload = {
        "orderId": "O100",
        "amount": "not-a-number",
        "itemCount": 3,
        "isExpress": True,
        "items": [],
        "customer": {},
    }
    with pytest.raises(
        InvalidEventPayloadError, match="Field 'amount' must be of type 'number', got 'str'"
    ):
        validate_event_payload(payload, sample_contract)


def test_boolean_passed_to_integer_field_raises(sample_contract: EventContract) -> None:
    payload = {
        "orderId": "O100",
        "amount": 100,
        "itemCount": True,  # boolean passed where integer expected!
        "isExpress": True,
        "items": [],
        "customer": {},
    }
    with pytest.raises(
        InvalidEventPayloadError, match="Field 'itemCount' must be of type 'integer', got 'boolean'"
    ):
        validate_event_payload(payload, sample_contract)
