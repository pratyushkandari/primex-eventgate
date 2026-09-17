"""Tests for contract model validation."""

import pytest

from eventgate.domain.errors import InvalidContractError
from eventgate.domain.models import (
    ConsumerContract,
    ConsumerField,
    EventContract,
    EventField,
)
from tests.conftest import (
    make_consumer_contract,
    make_event_contract,
)

# ---------------------------------------------------------------------------
# EventField
# ---------------------------------------------------------------------------


class TestEventField:
    def test_valid_field(self):
        f = EventField(name="orderId", type="string", required=True)
        assert f.name == "orderId"
        assert f.type == "string"
        assert f.required is True

    def test_empty_name_raises(self):
        with pytest.raises(InvalidContractError, match="field name must not be empty"):
            EventField(name="", type="string", required=True)

    def test_unsupported_type_raises(self):
        with pytest.raises(InvalidContractError, match="Unsupported field type"):
            EventField(name="x", type="datetime", required=True)

    @pytest.mark.parametrize(
        "type_", ["string", "number", "integer", "boolean", "object", "array", "null"]
    )
    def test_all_supported_types(self, type_):
        f = EventField(name="test", type=type_, required=False)
        assert f.type == type_


# ---------------------------------------------------------------------------
# EventContract
# ---------------------------------------------------------------------------


class TestEventContract:
    def test_valid_contract(self):
        c = make_event_contract()
        assert c.event_type == "OrderPlaced"
        assert c.version == 1
        assert "orderId" in c.fields

    def test_empty_event_type_raises(self):
        with pytest.raises(InvalidContractError, match="Event type must not be empty"):
            EventContract(event_type="", version=1, fields={})

    def test_zero_version_raises(self):
        with pytest.raises(InvalidContractError, match="positive integer"):
            EventContract(event_type="Test", version=0, fields={})

    def test_negative_version_raises(self):
        with pytest.raises(InvalidContractError, match="positive integer"):
            EventContract(event_type="Test", version=-1, fields={})


# ---------------------------------------------------------------------------
# ConsumerField
# ---------------------------------------------------------------------------


class TestConsumerField:
    def test_valid_field(self):
        f = ConsumerField(name="amount", type="number", required=True)
        assert f.name == "amount"

    def test_empty_name_raises(self):
        with pytest.raises(InvalidContractError, match="field name must not be empty"):
            ConsumerField(name="", type="string", required=True)

    def test_unsupported_type_raises(self):
        with pytest.raises(InvalidContractError, match="Unsupported field type"):
            ConsumerField(name="x", type="bigint", required=False)


# ---------------------------------------------------------------------------
# ConsumerContract
# ---------------------------------------------------------------------------


class TestConsumerContract:
    def test_valid_contract(self):
        c = make_consumer_contract(consumer_id="billing-service")
        assert c.consumer_id == "billing-service"
        assert c.event_type == "OrderPlaced"

    def test_empty_consumer_id_raises(self):
        with pytest.raises(InvalidContractError, match="Consumer ID must not be empty"):
            ConsumerContract(
                consumer_id="",
                event_type="OrderPlaced",
                expected_fields={},
            )

    def test_empty_event_type_raises(self):
        with pytest.raises(InvalidContractError, match="Consumer event type must not be empty"):
            ConsumerContract(
                consumer_id="test",
                event_type="",
                expected_fields={},
            )
