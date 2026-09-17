"""Tests for ChangeSet computation."""

from eventgate.domain.changes import compute_change_set
from tests.conftest import make_event_contract, make_event_field


class TestChangeSet:
    def test_no_changes(self):
        c = make_event_contract()
        cs = compute_change_set(c, c)
        assert cs.added_fields == []
        assert cs.removed_fields == []
        assert cs.type_changes == []
        assert cs.requiredness_changes == []
        assert cs.has_changes is False

    def test_added_field(self):
        current = make_event_contract()
        proposed_fields = dict(current.fields)
        proposed_fields["metadata"] = make_event_field("metadata", "object", required=False)
        proposed = make_event_contract(version=2, fields=proposed_fields)

        cs = compute_change_set(current, proposed)
        assert cs.added_fields == ["metadata"]
        assert cs.removed_fields == []
        assert cs.type_changes == []
        assert cs.has_changes is True

    def test_removed_field(self):
        current = make_event_contract(
            fields={
                "orderId": make_event_field("orderId", "string"),
                "amount": make_event_field("amount", "number"),
                "extra": make_event_field("extra", "string", required=False),
            }
        )
        proposed = make_event_contract(
            version=2,
            fields={
                "orderId": make_event_field("orderId", "string"),
                "amount": make_event_field("amount", "number"),
            },
        )

        cs = compute_change_set(current, proposed)
        assert cs.removed_fields == ["extra"]
        assert cs.added_fields == []

    def test_type_change(self):
        current = make_event_contract(fields={"amount": make_event_field("amount", "number")})
        proposed = make_event_contract(
            version=2,
            fields={"amount": make_event_field("amount", "string")},
        )

        cs = compute_change_set(current, proposed)
        assert len(cs.type_changes) == 1
        assert cs.type_changes[0].field == "amount"
        assert cs.type_changes[0].from_type == "number"
        assert cs.type_changes[0].to_type == "string"

    def test_requiredness_change(self):
        current = make_event_contract(fields={"x": make_event_field("x", "string", required=True)})
        proposed = make_event_contract(
            version=2,
            fields={"x": make_event_field("x", "string", required=False)},
        )

        cs = compute_change_set(current, proposed)
        assert len(cs.requiredness_changes) == 1
        assert cs.requiredness_changes[0].field == "x"
        assert cs.requiredness_changes[0].from_required is True
        assert cs.requiredness_changes[0].to_required is False

    def test_multiple_simultaneous_changes(self):
        current = make_event_contract(
            fields={
                "a": make_event_field("a", "number"),
                "b": make_event_field("b", "string", required=True),
                "c": make_event_field("c", "boolean", required=False),
            }
        )
        proposed = make_event_contract(
            version=2,
            fields={
                "a": make_event_field("a", "string"),  # type change
                "b": make_event_field("b", "string", required=False),  # requiredness change
                "d": make_event_field("d", "object", required=False),  # added
                # c removed
            },
        )

        cs = compute_change_set(current, proposed)
        assert cs.added_fields == ["d"]
        assert cs.removed_fields == ["c"]
        assert len(cs.type_changes) == 1
        assert cs.type_changes[0].field == "a"
        assert len(cs.requiredness_changes) == 1
        assert cs.requiredness_changes[0].field == "b"
        assert cs.has_changes is True

    def test_deterministic_ordering(self):
        """Fields should be sorted alphabetically for determinism."""
        current = make_event_contract(
            fields={
                "z": make_event_field("z", "string"),
                "a": make_event_field("a", "number"),
                "m": make_event_field("m", "boolean"),
            }
        )
        proposed = make_event_contract(
            version=2,
            fields={
                "b": make_event_field("b", "string"),
                "y": make_event_field("y", "number"),
            },
        )

        cs = compute_change_set(current, proposed)
        assert cs.added_fields == ["b", "y"]
        assert cs.removed_fields == ["a", "m", "z"]
