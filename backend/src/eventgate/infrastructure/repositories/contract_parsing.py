"""Parse raw contract documents (JSON files or DynamoDB items) into domain models.

Both storage backends store the same document shape:

    event:    {"eventType": str, "version": int, "fields": {name: {"type", "required"}}}
    consumer: {"consumerId": str, "eventType": str, "expectedFields": {name: {...}}}

DynamoDB returns numbers as Decimal, so versions may arrive as Decimal.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from eventgate.domain.enums import SUPPORTED_FIELD_TYPES
from eventgate.domain.errors import InvalidContractError
from eventgate.domain.models import ConsumerContract, ConsumerField, EventContract, EventField


def _require_str(data: dict[str, Any], key: str, source: str) -> str:
    value = data.get(key)
    if not value or not isinstance(value, str):
        raise InvalidContractError(f"Missing or invalid '{key}' in {source}.")
    return value


def _parse_version(raw: Any, source: str) -> int:
    if isinstance(raw, bool) or not isinstance(raw, int | Decimal):
        raise InvalidContractError(f"Missing or invalid 'version' in {source}.")
    if raw != int(raw) or int(raw) < 1:
        raise InvalidContractError(f"Version must be a positive integer in {source}.")
    return int(raw)


def _parse_field_specs(raw: Any, key: str, source: str) -> dict[str, tuple[str, bool]]:
    if not isinstance(raw, dict):
        raise InvalidContractError(f"Missing or invalid '{key}' in {source}.")
    specs: dict[str, tuple[str, bool]] = {}
    for name, spec in raw.items():
        if not isinstance(spec, dict):
            raise InvalidContractError(f"Invalid field spec for '{name}' in {source}.")
        field_type = spec.get("type")
        if field_type not in SUPPORTED_FIELD_TYPES:
            raise InvalidContractError(
                f"Unsupported type '{field_type}' for field '{name}' in {source}."
            )
        required = spec.get("required")
        if not isinstance(required, bool):
            raise InvalidContractError(
                f"Missing or invalid 'required' for field '{name}' in {source}."
            )
        specs[name] = (field_type, required)
    return specs


def parse_event_contract(data: dict[str, Any], source: str) -> EventContract:
    """Build an EventContract; raises InvalidContractError naming the source on bad input."""
    event_type = _require_str(data, "eventType", source)
    version = _parse_version(data.get("version"), source)
    specs = _parse_field_specs(data.get("fields"), "fields", source)
    fields = {name: EventField(name=name, type=t, required=r) for name, (t, r) in specs.items()}
    return EventContract(event_type=event_type, version=version, fields=fields)


def parse_consumer_contract(data: dict[str, Any], source: str) -> ConsumerContract:
    """Build a ConsumerContract; raises InvalidContractError naming the source on bad input."""
    consumer_id = _require_str(data, "consumerId", source)
    event_type = _require_str(data, "eventType", source)
    specs = _parse_field_specs(data.get("expectedFields"), "expectedFields", source)
    expected = {
        name: ConsumerField(name=name, type=t, required=r) for name, (t, r) in specs.items()
    }
    return ConsumerContract(
        consumer_id=consumer_id, event_type=event_type, expected_fields=expected
    )
