"""Tests for field-level compatibility evaluation."""

from eventgate.domain.compatibility import CompatibilityEngine
from eventgate.domain.enums import CompatibilityStatus
from tests.conftest import (
    make_consumer_contract,
    make_consumer_field,
    make_event_contract,
    make_event_field,
)


class TestFieldCompatibility:
    def setup_method(self):
        self.engine = CompatibilityEngine()

    def test_compatible_field_unchanged(self):
        """Field with same type in both versions → SAFE."""
        current = make_event_contract(fields={"orderId": make_event_field("orderId", "string")})
        proposed = make_event_contract(
            version=2,
            fields={"orderId": make_event_field("orderId", "string")},
        )
        consumer = make_consumer_contract(
            expected_fields={"orderId": make_consumer_field("orderId", "string")}
        )

        findings = self.engine.evaluate(current, proposed, consumer)
        assert all(f.status == CompatibilityStatus.SAFE for f in findings)

    def test_incompatible_type_change(self):
        """number → string on a consumer-required field → BREAK."""
        current = make_event_contract(fields={"amount": make_event_field("amount", "number")})
        proposed = make_event_contract(
            version=2,
            fields={"amount": make_event_field("amount", "string")},
        )
        consumer = make_consumer_contract(
            expected_fields={"amount": make_consumer_field("amount", "number")}
        )

        findings = self.engine.evaluate(current, proposed, consumer)
        break_findings = [f for f in findings if f.status == CompatibilityStatus.BREAK]
        assert len(break_findings) == 1
        assert break_findings[0].field == "amount"
        assert break_findings[0].expected_type == "number"
        assert break_findings[0].proposed_type == "string"

    def test_missing_required_consumer_field(self):
        """Consumer requires a field that was removed → BREAK."""
        current = make_event_contract(
            fields={
                "orderId": make_event_field("orderId", "string"),
                "items": make_event_field("items", "array"),
            }
        )
        proposed = make_event_contract(
            version=2,
            fields={"orderId": make_event_field("orderId", "string")},
        )
        consumer = make_consumer_contract(
            expected_fields={
                "orderId": make_consumer_field("orderId", "string"),
                "items": make_consumer_field("items", "array"),
            }
        )

        findings = self.engine.evaluate(current, proposed, consumer)
        break_findings = [f for f in findings if f.status == CompatibilityStatus.BREAK]
        assert len(break_findings) == 1
        assert break_findings[0].field == "items"

    def test_optional_field_added_consumer_unaware(self):
        """New optional field, consumer doesn't know about it → SAFE."""
        current = make_event_contract(fields={"orderId": make_event_field("orderId", "string")})
        proposed = make_event_contract(
            version=2,
            fields={
                "orderId": make_event_field("orderId", "string"),
                "metadata": make_event_field("metadata", "object", required=False),
            },
        )
        consumer = make_consumer_contract(
            expected_fields={"orderId": make_consumer_field("orderId", "string")}
        )

        findings = self.engine.evaluate(current, proposed, consumer)
        assert all(f.status == CompatibilityStatus.SAFE for f in findings)

    def test_optional_field_added_consumer_expects_different_type(self):
        """New field, but consumer expects a different type → BREAK."""
        current = make_event_contract(fields={"orderId": make_event_field("orderId", "string")})
        proposed = make_event_contract(
            version=2,
            fields={
                "orderId": make_event_field("orderId", "string"),
                "currency": make_event_field("currency", "number", required=False),
            },
        )
        consumer = make_consumer_contract(
            expected_fields={
                "orderId": make_consumer_field("orderId", "string"),
                "currency": make_consumer_field("currency", "string", required=False),
            }
        )

        findings = self.engine.evaluate(current, proposed, consumer)
        break_findings = [f for f in findings if f.status == CompatibilityStatus.BREAK]
        assert len(break_findings) == 1
        assert break_findings[0].field == "currency"

    def test_optional_field_removed_consumer_knows(self):
        """Consumer knows about an optional field that was removed → RISK."""
        current = make_event_contract(
            fields={
                "orderId": make_event_field("orderId", "string"),
                "couponCode": make_event_field("couponCode", "string", required=False),
            }
        )
        proposed = make_event_contract(
            version=2,
            fields={"orderId": make_event_field("orderId", "string")},
        )
        consumer = make_consumer_contract(
            expected_fields={
                "orderId": make_consumer_field("orderId", "string"),
                "couponCode": make_consumer_field("couponCode", "string", required=False),
            }
        )

        findings = self.engine.evaluate(current, proposed, consumer)
        risk_findings = [f for f in findings if f.status == CompatibilityStatus.RISK]
        assert len(risk_findings) == 1
        assert risk_findings[0].field == "couponCode"

    def test_optional_field_removed_consumer_unaware(self):
        """Removed optional field, consumer doesn't know about it → SAFE."""
        current = make_event_contract(
            fields={
                "orderId": make_event_field("orderId", "string"),
                "extra": make_event_field("extra", "string", required=False),
            }
        )
        proposed = make_event_contract(
            version=2,
            fields={"orderId": make_event_field("orderId", "string")},
        )
        consumer = make_consumer_contract(
            expected_fields={"orderId": make_consumer_field("orderId", "string")}
        )

        findings = self.engine.evaluate(current, proposed, consumer)
        assert all(f.status == CompatibilityStatus.SAFE for f in findings)

    def test_consumer_scoping_unrelated_change(self):
        """Change on a field the consumer doesn't care about → SAFE."""
        current = make_event_contract(
            fields={
                "orderId": make_event_field("orderId", "string"),
                "shippingMethod": make_event_field("shippingMethod", "string"),
            }
        )
        proposed = make_event_contract(
            version=2,
            fields={
                "orderId": make_event_field("orderId", "string"),
                "shippingMethod": make_event_field("shippingMethod", "object"),
            },
        )
        # Consumer only cares about orderId.
        consumer = make_consumer_contract(
            expected_fields={"orderId": make_consumer_field("orderId", "string")}
        )

        findings = self.engine.evaluate(current, proposed, consumer)
        assert all(f.status == CompatibilityStatus.SAFE for f in findings)
