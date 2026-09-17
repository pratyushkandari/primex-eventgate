"""Deterministic payload validator for EventGate.

Validates an event payload dictionary against a proposed EventContract schema:
- Ensures payload is a valid dictionary/object.
- Validates required fields are present.
- Validates top-level field types against SUPPORTED_FIELD_TYPES.
- Enforces strict type distinction: booleans do not match integers or numbers.
- Allows unknown extra fields (open-world policy).

Limitations:
- Validates top-level fields only; does not perform deep recursive schema validation.
- Does not implement full JSON Schema specification.
"""

from __future__ import annotations

from typing import Any

from eventgate.domain.errors import InvalidEventPayloadError
from eventgate.domain.models import EventContract


def check_field_type(value: Any, expected_type: str) -> bool:
    """Check if a Python value matches an expected EventGate field type string.

    Carefully ensures booleans are NOT treated as integers or numbers,
    respecting Python's inheritance where isinstance(True, int) is True.
    """
    if value is None:
        return expected_type == "null"
    if expected_type == "null":
        return value is None
    if expected_type == "boolean":
        return isinstance(value, bool)
    if expected_type == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected_type == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if expected_type == "string":
        return isinstance(value, str)
    if expected_type == "object":
        return isinstance(value, dict)
    if expected_type == "array":
        return isinstance(value, list)
    return False


def validate_event_payload(payload: Any, contract: EventContract) -> None:
    """Validate that payload conforms to the declared fields of the event contract.

    Raises:
        InvalidEventPayloadError: If the payload is not an object, is missing a
            required field, or contains a field whose type does not match.
    """
    if not isinstance(payload, dict):
        raise InvalidEventPayloadError("Event payload must be a JSON object (dictionary).")

    for field_name, field_spec in contract.fields.items():
        if field_spec.required and field_name not in payload:
            raise InvalidEventPayloadError(f"Missing required field: '{field_name}'.")

        if field_name in payload:
            val = payload[field_name]
            if not check_field_type(val, field_spec.type):
                val_type = "boolean" if isinstance(val, bool) else type(val).__name__
                raise InvalidEventPayloadError(
                    f"Field '{field_name}' must be of type '{field_spec.type}', got '{val_type}'."
                )
