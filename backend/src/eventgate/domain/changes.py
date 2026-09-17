"""Event contract diff — computes structural changes between two event versions.

This module answers: "What structurally changed between these two event contracts?"
It does NOT answer: "Does this break a specific consumer?" — that is the
CompatibilityEngine's responsibility.
"""

from __future__ import annotations

from eventgate.domain.models import (
    ChangeSet,
    EventContract,
    RequirednessChange,
    TypeChange,
)


def compute_change_set(current: EventContract, proposed: EventContract) -> ChangeSet:
    """Compute the structural diff between two event contract versions.

    Returns a ChangeSet with added fields, removed fields, type changes,
    and requiredness changes. All lists are sorted for deterministic output.
    """
    current_names = set(current.fields.keys())
    proposed_names = set(proposed.fields.keys())

    added_fields = sorted(proposed_names - current_names)
    removed_fields = sorted(current_names - proposed_names)

    type_changes: list[TypeChange] = []
    requiredness_changes: list[RequirednessChange] = []

    # Only inspect fields that exist in both versions.
    common_fields = sorted(current_names & proposed_names)
    for name in common_fields:
        current_field = current.fields[name]
        proposed_field = proposed.fields[name]

        if current_field.type != proposed_field.type:
            type_changes.append(
                TypeChange(field=name, from_type=current_field.type, to_type=proposed_field.type)
            )

        if current_field.required != proposed_field.required:
            requiredness_changes.append(
                RequirednessChange(
                    field=name,
                    from_required=current_field.required,
                    to_required=proposed_field.required,
                )
            )

    return ChangeSet(
        added_fields=added_fields,
        removed_fields=removed_fields,
        type_changes=type_changes,
        requiredness_changes=requiredness_changes,
    )
