"""Tests for requiredness change handling."""

from eventgate.domain.compatibility import CompatibilityEngine
from eventgate.domain.enums import CompatibilityStatus
from tests.conftest import (
    make_consumer_contract,
    make_consumer_field,
    make_event_contract,
    make_event_field,
)


class TestRequiredness:
    def setup_method(self):
        self.engine = CompatibilityEngine()

    def test_required_stays_required(self):
        current = make_event_contract(fields={"x": make_event_field("x", "string", required=True)})
        proposed = make_event_contract(
            version=2,
            fields={"x": make_event_field("x", "string", required=True)},
        )
        consumer = make_consumer_contract(
            expected_fields={"x": make_consumer_field("x", "string", required=True)}
        )

        findings = self.engine.evaluate(current, proposed, consumer)
        assert all(f.status == CompatibilityStatus.SAFE for f in findings)

    def test_optional_stays_optional(self):
        current = make_event_contract(fields={"x": make_event_field("x", "string", required=False)})
        proposed = make_event_contract(
            version=2,
            fields={"x": make_event_field("x", "string", required=False)},
        )
        consumer = make_consumer_contract(
            expected_fields={"x": make_consumer_field("x", "string", required=False)}
        )

        findings = self.engine.evaluate(current, proposed, consumer)
        assert all(f.status == CompatibilityStatus.SAFE for f in findings)

    def test_required_to_optional_breaks_consumer(self):
        """required → optional on a field the consumer uses → BREAK."""
        current = make_event_contract(fields={"x": make_event_field("x", "string", required=True)})
        proposed = make_event_contract(
            version=2,
            fields={"x": make_event_field("x", "string", required=False)},
        )
        consumer = make_consumer_contract(
            expected_fields={"x": make_consumer_field("x", "string", required=True)}
        )

        findings = self.engine.evaluate(current, proposed, consumer)
        break_findings = [f for f in findings if f.status == CompatibilityStatus.BREAK]
        assert len(break_findings) == 1
        assert break_findings[0].field == "x"
        assert "REQUIREDNESS" in break_findings[0].rule_id

    def test_optional_to_required_breaks_consumer(self):
        """optional → required on a field the consumer uses → BREAK."""
        current = make_event_contract(fields={"x": make_event_field("x", "string", required=False)})
        proposed = make_event_contract(
            version=2,
            fields={"x": make_event_field("x", "string", required=True)},
        )
        consumer = make_consumer_contract(
            expected_fields={"x": make_consumer_field("x", "string", required=False)}
        )

        findings = self.engine.evaluate(current, proposed, consumer)
        break_findings = [f for f in findings if f.status == CompatibilityStatus.BREAK]
        assert len(break_findings) == 1
        assert break_findings[0].field == "x"

    def test_requiredness_change_ignored_for_unrelated_consumer(self):
        """Consumer doesn't declare the field → change doesn't affect them."""
        current = make_event_contract(
            fields={
                "x": make_event_field("x", "string", required=True),
                "y": make_event_field("y", "number"),
            }
        )
        proposed = make_event_contract(
            version=2,
            fields={
                "x": make_event_field("x", "string", required=False),
                "y": make_event_field("y", "number"),
            },
        )
        # Consumer only cares about y.
        consumer = make_consumer_contract(expected_fields={"y": make_consumer_field("y", "number")})

        findings = self.engine.evaluate(current, proposed, consumer)
        assert all(f.status == CompatibilityStatus.SAFE for f in findings)
