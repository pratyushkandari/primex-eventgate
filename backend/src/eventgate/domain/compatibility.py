"""Deterministic compatibility engine — the core of EventGate.

Evaluates a proposed event contract against a consumer contract to produce
consumer-specific findings. Framework-independent, filesystem-independent,
network-independent, AI-independent.

CONSUMER SCOPING POLICY:
A change only produces a consumer-specific finding when the consumer's
contract is relevant to that field. Consumers that do not declare or
depend on the changed field remain SAFE.

FINDING DEDUPLICATION POLICY:
For a single consumer + field, produce one primary finding. Consumer-specific
rules (e.g. EVT003) take precedence over event-level change rules.

OPTIONAL FIELD ADDITION POLICY:
A newly added optional event field is SAFE for a consumer only when the
consumer has no expectation for that field. If the consumer declares the
field, evaluate the proposed type against the consumer contract.
"""

from __future__ import annotations

from eventgate.domain.changes import compute_change_set
from eventgate.domain.enums import CompatibilityStatus, Severity
from eventgate.domain.models import (
    ChangeSet,
    ConsumerContract,
    EventContract,
    Finding,
)

# ---------------------------------------------------------------------------
# Type compatibility matrix
# ---------------------------------------------------------------------------

# Pairs where (from_type, to_type) is considered compatible.
# integer → number is explicitly allowed and documented.
_COMPATIBLE_TYPE_PAIRS: set[tuple[str, str]] = {
    ("string", "string"),
    ("number", "number"),
    ("integer", "integer"),
    ("boolean", "boolean"),
    ("object", "object"),
    ("array", "array"),
    ("null", "null"),
    ("integer", "number"),  # widening: integer is a subset of number
}


def is_type_compatible(from_type: str, to_type: str) -> bool:
    """Check whether a type transition is compatible.

    Returns True only for explicitly listed safe transitions.
    Unknown or unlisted transitions are treated as incompatible.
    """
    return (from_type, to_type) in _COMPATIBLE_TYPE_PAIRS


# ---------------------------------------------------------------------------
# Rule identifiers
# ---------------------------------------------------------------------------

RULE_FIELD_TYPE_CHANGED = "EVT001_FIELD_TYPE_CHANGED"
RULE_REQUIRED_FIELD_REMOVED = "EVT002_REQUIRED_FIELD_REMOVED"
RULE_CONSUMER_REQUIRED_FIELD_MISSING = "EVT003_CONSUMER_REQUIRED_FIELD_MISSING"
RULE_REQUIREDNESS_CHANGED = "EVT004_REQUIREDNESS_CHANGED"
RULE_OPTIONAL_FIELD_ADDED = "EVT005_OPTIONAL_FIELD_ADDED"
RULE_OPTIONAL_FIELD_REMOVED = "EVT006_OPTIONAL_FIELD_REMOVED"
RULE_UNSUPPORTED_CHANGE = "EVT007_UNSUPPORTED_CHANGE"
RULE_CONSUMER_UNAFFECTED = "EVT008_CONSUMER_UNAFFECTED"

# Explicit deterministic rule precedence when multiple rules apply to the same field.
# Lower integer indicates higher priority.
RULE_PRECEDENCE: dict[str, int] = {
    RULE_FIELD_TYPE_CHANGED: 1,  # Incompatible type is fatal
    RULE_CONSUMER_REQUIRED_FIELD_MISSING: 2,  # Consumer explicitly required missing field
    RULE_REQUIRED_FIELD_REMOVED: 3,  # Producer removed a required field
    RULE_REQUIREDNESS_CHANGED: 4,  # Requiredness changed
    RULE_UNSUPPORTED_CHANGE: 5,  # Unsupported schema change
    RULE_OPTIONAL_FIELD_REMOVED: 6,  # Optional field removed (RISK)
    RULE_OPTIONAL_FIELD_ADDED: 7,  # Optional field added (SAFE)
    RULE_CONSUMER_UNAFFECTED: 8,  # Unaffected by changes (SAFE)
}


# ---------------------------------------------------------------------------
# Compatibility engine
# ---------------------------------------------------------------------------


def _consumer_label(consumer_id: str) -> str:
    """Human-readable label for a consumer (e.g. 'billing-service' → 'Billing Service')."""
    return consumer_id.replace("-", " ").title()


def _deduplicate_findings(findings: list[Finding]) -> list[Finding]:
    """Deduplicate findings for the same consumer + field using explicit rule precedence."""
    by_key: dict[tuple[str, str | None], list[Finding]] = {}
    for f in findings:
        by_key.setdefault((f.consumer_id, f.field), []).append(f)

    deduped: list[Finding] = []
    for group in by_key.values():
        if len(group) == 1:
            deduped.append(group[0])
        else:
            best = min(group, key=lambda f: (RULE_PRECEDENCE.get(f.rule_id, 99), f.rule_id))
            deduped.append(best)
    return deduped


class CompatibilityEngine:
    """Evaluates a proposed event contract against consumer contracts.

    Deterministic: given the same inputs, produces equivalent findings.
    """

    def evaluate(
        self,
        current: EventContract,
        proposed: EventContract,
        consumer: ConsumerContract,
    ) -> list[Finding]:
        """Evaluate a consumer against a proposed event change.

        Returns a sorted list of findings for this consumer.
        """
        change_set = compute_change_set(current, proposed)
        raw_findings = self._evaluate_consumer(change_set, proposed, consumer)
        findings = _deduplicate_findings(raw_findings)

        # If the consumer has no relevant findings, it is SAFE.
        if not findings:
            # EVT005 only if an optional field was actually added to the proposed event.
            has_optional_field_added = any(
                not proposed.fields[f].required
                for f in change_set.added_fields
                if f in proposed.fields
            )
            rule_id = (
                RULE_OPTIONAL_FIELD_ADDED if has_optional_field_added else RULE_CONSUMER_UNAFFECTED
            )

            findings = [
                Finding(
                    consumer_id=consumer.consumer_id,
                    status=CompatibilityStatus.SAFE,
                    rule_id=rule_id,
                    field="*",
                    expected_type=None,
                    proposed_type=None,
                    severity=Severity.LOW,
                    reason=(
                        f"{_consumer_label(consumer.consumer_id)} is not affected "
                        f"by the proposed changes."
                    ),
                )
            ]

        # Sort for determinism: by consumer_id, then field, then precedence, then rule_id.
        findings.sort(
            key=lambda f: (
                f.consumer_id,
                f.field or "*",
                RULE_PRECEDENCE.get(f.rule_id, 99),
                f.rule_id,
            )
        )
        return findings

    def _evaluate_consumer(
        self,
        change_set: ChangeSet,
        proposed: EventContract,
        consumer: ConsumerContract,
    ) -> list[Finding]:
        """Produce candidate findings for a single consumer based on the change set."""
        findings: list[Finding] = []

        # 1. Check removed fields that the consumer depends on.
        for field_name in change_set.removed_fields:
            if field_name not in consumer.expected_fields:
                continue
            consumer_field = consumer.expected_fields[field_name]

            if consumer_field.required:
                findings.append(
                    Finding(
                        consumer_id=consumer.consumer_id,
                        status=CompatibilityStatus.BREAK,
                        rule_id=RULE_CONSUMER_REQUIRED_FIELD_MISSING,
                        field=field_name,
                        expected_type=consumer_field.type,
                        proposed_type=None,
                        severity=Severity.HIGH,
                        reason=(
                            f"{_consumer_label(consumer.consumer_id)} requires "
                            f"'{field_name}' ({consumer_field.type}), but it has been "
                            f"removed from the proposed contract."
                        ),
                    )
                )
            else:
                # Consumer knows about this optional field but it was removed → RISK.
                findings.append(
                    Finding(
                        consumer_id=consumer.consumer_id,
                        status=CompatibilityStatus.RISK,
                        rule_id=RULE_OPTIONAL_FIELD_REMOVED,
                        field=field_name,
                        expected_type=consumer_field.type,
                        proposed_type=None,
                        severity=Severity.MEDIUM,
                        reason=(
                            f"{_consumer_label(consumer.consumer_id)} uses optional field "
                            f"'{field_name}' ({consumer_field.type}), but it has been "
                            f"removed from the proposed contract."
                        ),
                    )
                )

        # 2. Check type changes on fields the consumer depends on.
        for tc in change_set.type_changes:
            if tc.field not in consumer.expected_fields:
                continue
            consumer_field = consumer.expected_fields[tc.field]

            if not is_type_compatible(tc.to_type, consumer_field.type):
                findings.append(
                    Finding(
                        consumer_id=consumer.consumer_id,
                        status=CompatibilityStatus.BREAK,
                        rule_id=RULE_FIELD_TYPE_CHANGED,
                        field=tc.field,
                        expected_type=consumer_field.type,
                        proposed_type=tc.to_type,
                        severity=Severity.HIGH,
                        reason=(
                            f"{_consumer_label(consumer.consumer_id)} expects "
                            f"'{tc.field}' to be {consumer_field.type}, but the proposed "
                            f"contract defines it as {tc.to_type}."
                        ),
                    )
                )

        # 3. Check requiredness changes on fields the consumer depends on.
        for rc in change_set.requiredness_changes:
            if rc.field not in consumer.expected_fields:
                continue
            consumer_field = consumer.expected_fields[rc.field]
            findings.append(
                Finding(
                    consumer_id=consumer.consumer_id,
                    status=CompatibilityStatus.BREAK,
                    rule_id=RULE_REQUIREDNESS_CHANGED,
                    field=rc.field,
                    expected_type=consumer_field.type,
                    proposed_type=None,
                    severity=Severity.HIGH,
                    reason=(
                        f"{_consumer_label(consumer.consumer_id)} expects "
                        f"'{rc.field}' to be "
                        f"{'required' if rc.from_required else 'optional'}, but the proposed "
                        f"contract changes it to "
                        f"{'required' if rc.to_required else 'optional'}."
                    ),
                )
            )

        # 4. Check added fields — BREAK only if consumer declares them with a type conflict.
        for field_name in change_set.added_fields:
            if field_name not in consumer.expected_fields:
                continue
            consumer_field = consumer.expected_fields[field_name]
            proposed_field = proposed.fields[field_name]
            if not is_type_compatible(proposed_field.type, consumer_field.type):
                findings.append(
                    Finding(
                        consumer_id=consumer.consumer_id,
                        status=CompatibilityStatus.BREAK,
                        rule_id=RULE_FIELD_TYPE_CHANGED,
                        field=field_name,
                        expected_type=consumer_field.type,
                        proposed_type=proposed_field.type,
                        severity=Severity.HIGH,
                        reason=(
                            f"{_consumer_label(consumer.consumer_id)} expects "
                            f"'{field_name}' to be {consumer_field.type}, but the proposed "
                            f"contract defines it as {proposed_field.type}."
                        ),
                    )
                )

        # 5. Check consumer-required fields that are entirely missing from proposed.
        for field_name, consumer_field in consumer.expected_fields.items():
            if consumer_field.required and field_name not in proposed.fields:
                findings.append(
                    Finding(
                        consumer_id=consumer.consumer_id,
                        status=CompatibilityStatus.BREAK,
                        rule_id=RULE_CONSUMER_REQUIRED_FIELD_MISSING,
                        field=field_name,
                        expected_type=consumer_field.type,
                        proposed_type=None,
                        severity=Severity.HIGH,
                        reason=(
                            f"{_consumer_label(consumer.consumer_id)} requires "
                            f"'{field_name}' ({consumer_field.type}), but it is not present "
                            f"in the proposed contract."
                        ),
                    )
                )

        return findings
