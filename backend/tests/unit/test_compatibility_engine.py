"""Tests for the CompatibilityEngine — consumer-specific evaluation."""

from eventgate.domain.compatibility import (
    RULE_CONSUMER_REQUIRED_FIELD_MISSING,
    RULE_CONSUMER_UNAFFECTED,
    RULE_FIELD_TYPE_CHANGED,
    RULE_OPTIONAL_FIELD_ADDED,
    RULE_OPTIONAL_FIELD_REMOVED,
    CompatibilityEngine,
)
from eventgate.domain.enums import CompatibilityStatus, Severity
from tests.conftest import (
    make_consumer_contract,
    make_consumer_field,
    make_event_contract,
    make_event_field,
)


class TestCompatibilityEngine:
    def setup_method(self):
        self.engine = CompatibilityEngine()

    def test_consumer_safe_no_changes(self):
        current = make_event_contract()
        consumer = make_consumer_contract()
        findings = self.engine.evaluate(current, current, consumer)
        assert all(f.status == CompatibilityStatus.SAFE for f in findings)

    def test_consumer_break_type_change(self):
        current = make_event_contract(fields={"amount": make_event_field("amount", "number")})
        proposed = make_event_contract(
            version=2,
            fields={"amount": make_event_field("amount", "string")},
        )
        consumer = make_consumer_contract(
            consumer_id="billing-service",
            expected_fields={"amount": make_consumer_field("amount", "number")},
        )

        findings = self.engine.evaluate(current, proposed, consumer)
        assert any(f.status == CompatibilityStatus.BREAK for f in findings)
        break_f = [f for f in findings if f.status == CompatibilityStatus.BREAK][0]
        assert break_f.consumer_id == "billing-service"
        assert break_f.rule_id == RULE_FIELD_TYPE_CHANGED
        assert break_f.field == "amount"
        assert break_f.expected_type == "number"
        assert break_f.proposed_type == "string"
        assert break_f.severity == Severity.HIGH

    def test_consumer_risk_optional_removed(self):
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
            consumer_id="analytics-service",
            expected_fields={
                "orderId": make_consumer_field("orderId", "string"),
                "couponCode": make_consumer_field("couponCode", "string", required=False),
            },
        )

        findings = self.engine.evaluate(current, proposed, consumer)
        risk_findings = [f for f in findings if f.status == CompatibilityStatus.RISK]
        assert len(risk_findings) == 1
        assert risk_findings[0].rule_id == RULE_OPTIONAL_FIELD_REMOVED
        assert risk_findings[0].severity == Severity.MEDIUM

    def test_reason_is_deterministic(self):
        """Same inputs must produce the same reason text."""
        current = make_event_contract(fields={"amount": make_event_field("amount", "number")})
        proposed = make_event_contract(
            version=2,
            fields={"amount": make_event_field("amount", "string")},
        )
        consumer = make_consumer_contract(
            consumer_id="test-svc",
            expected_fields={"amount": make_consumer_field("amount", "number")},
        )

        findings_1 = self.engine.evaluate(current, proposed, consumer)
        findings_2 = self.engine.evaluate(current, proposed, consumer)

        assert findings_1[0].reason == findings_2[0].reason

    def test_multiple_findings_for_multiple_issues(self):
        """Multiple changes on consumer-relevant fields → multiple findings."""
        current = make_event_contract(
            fields={
                "a": make_event_field("a", "number"),
                "b": make_event_field("b", "string"),
            }
        )
        proposed = make_event_contract(
            version=2,
            fields={
                "a": make_event_field("a", "string"),  # type change
                # b removed
            },
        )
        consumer = make_consumer_contract(
            expected_fields={
                "a": make_consumer_field("a", "number"),
                "b": make_consumer_field("b", "string"),
            }
        )

        findings = self.engine.evaluate(current, proposed, consumer)
        non_safe = [f for f in findings if f.status != CompatibilityStatus.SAFE]
        assert len(non_safe) == 2
        fields_affected = {f.field for f in non_safe}
        assert fields_affected == {"a", "b"}

    def test_finding_deduplication(self):
        """A removed required field should produce one finding, not two."""
        current = make_event_contract(fields={"x": make_event_field("x", "string")})
        proposed = make_event_contract(version=2, fields={})
        consumer = make_consumer_contract(expected_fields={"x": make_consumer_field("x", "string")})

        findings = self.engine.evaluate(current, proposed, consumer)
        x_findings = [f for f in findings if f.field == "x"]
        assert len(x_findings) == 1
        assert x_findings[0].rule_id == RULE_CONSUMER_REQUIRED_FIELD_MISSING

    def test_rule_precedence_type_change_over_requiredness(self):
        """When a field has both type change and requiredness change, EVT001 takes precedence."""
        current = make_event_contract(
            fields={"amount": make_event_field("amount", "number", required=True)}
        )
        proposed = make_event_contract(
            version=2,
            fields={"amount": make_event_field("amount", "string", required=False)},
        )
        consumer = make_consumer_contract(
            consumer_id="billing-service",
            expected_fields={"amount": make_consumer_field("amount", "number", required=True)},
        )

        findings = self.engine.evaluate(current, proposed, consumer)
        amount_findings = [f for f in findings if f.field == "amount"]
        assert len(amount_findings) == 1
        assert amount_findings[0].rule_id == RULE_FIELD_TYPE_CHANGED
        assert amount_findings[0].status == CompatibilityStatus.BREAK

    def test_safe_rule_optional_field_added_vs_unaffected(self):
        """EVT005 is used when optional field added; EVT008 when changes are outside scope."""
        current = make_event_contract(fields={"orderId": make_event_field("orderId", "string")})
        # Case 1: Optional field added → EVT005
        proposed_add_opt = make_event_contract(
            version=2,
            fields={
                "orderId": make_event_field("orderId", "string"),
                "notes": make_event_field("notes", "string", required=False),
            },
        )
        consumer = make_consumer_contract(
            consumer_id="billing-service",
            expected_fields={"orderId": make_consumer_field("orderId", "string")},
        )
        findings_opt = self.engine.evaluate(current, proposed_add_opt, consumer)
        assert len(findings_opt) == 1
        assert findings_opt[0].status == CompatibilityStatus.SAFE
        assert findings_opt[0].rule_id == RULE_OPTIONAL_FIELD_ADDED

        # Case 2: Unrelated field modified/removed → EVT008
        current_with_two = make_event_contract(
            fields={
                "orderId": make_event_field("orderId", "string"),
                "shipping": make_event_field("shipping", "string"),
            }
        )
        proposed_shipping_changed = make_event_contract(
            version=2,
            fields={
                "orderId": make_event_field("orderId", "string"),
                "shipping": make_event_field("shipping", "object"),
            },
        )
        findings_unaffected = self.engine.evaluate(
            current_with_two, proposed_shipping_changed, consumer
        )
        assert len(findings_unaffected) == 1
        assert findings_unaffected[0].status == CompatibilityStatus.SAFE
        assert findings_unaffected[0].rule_id == RULE_CONSUMER_UNAFFECTED
