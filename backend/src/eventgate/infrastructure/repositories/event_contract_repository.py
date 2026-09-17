"""JSON-based event contract repository for local development.

Reads event contracts from the filesystem:
  contracts/events/{event-type-slug}/v{version}.json

The slug is derived from the event type by lowercasing and replacing spaces
with hyphens (e.g. "OrderPlaced" → "order-placed"). Version files may also
use descriptive names like "v2-safe.json" — the version inside the JSON is
authoritative.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from eventgate.domain.enums import SUPPORTED_FIELD_TYPES
from eventgate.domain.errors import (
    ContractNotFoundError,
    InvalidContractError,
    UnsupportedEventVersionError,
)
from eventgate.domain.models import EventContract, EventField

logger = logging.getLogger(__name__)


def _slugify(event_type: str) -> str:
    """Convert an event type name to a directory slug.

    Examples:
        OrderPlaced → order-placed
        UserSignedUp → user-signed-up
    """
    result: list[str] = []
    for i, char in enumerate(event_type):
        if char.isupper() and i > 0:
            result.append("-")
        result.append(char.lower())
    return "".join(result)


def _parse_event_contract(data: dict, source: str) -> EventContract:
    """Parse and validate a raw JSON dict into an EventContract."""
    event_type = data.get("eventType")
    if not event_type or not isinstance(event_type, str):
        raise InvalidContractError(f"Missing or invalid 'eventType' in {source}.")

    version = data.get("version")
    if not isinstance(version, int) or version < 1:
        raise InvalidContractError(f"Missing or invalid 'version' in {source}.")

    raw_fields = data.get("fields")
    if not isinstance(raw_fields, dict):
        raise InvalidContractError(f"Missing or invalid 'fields' in {source}.")

    fields: dict[str, EventField] = {}
    for name, spec in raw_fields.items():
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

        fields[name] = EventField(name=name, type=field_type, required=required)

    return EventContract(event_type=event_type, version=version, fields=fields)


class JsonEventContractRepository:
    """Loads event contracts from local JSON fixture files."""

    def __init__(self, contracts_dir: Path):
        self._contracts_dir = contracts_dir

    def get_event_contract(self, event_type: str, version: int) -> EventContract:
        """Load a specific event contract version.

        Searches for files matching v{version}*.json in the event type directory.
        """
        slug = _slugify(event_type)
        event_dir = self._contracts_dir / "events" / slug

        if not event_dir.is_dir():
            raise ContractNotFoundError(f"No contracts found for event type '{event_type}'.")

        # Look for files that start with "v{version}" (e.g. v1.json, v2-safe.json).
        prefix = f"v{version}"
        candidates = sorted(p for p in event_dir.glob(f"{prefix}*.json") if p.is_file())

        if not candidates:
            raise UnsupportedEventVersionError(event_type, version)

        # Use the first matching file (there should be exactly one per version).
        contract_path = candidates[0]
        return self._load_contract(contract_path, event_type, version)

    def list_event_contracts(self, event_type: str) -> list[EventContract]:
        """Load all versions of an event contract, sorted by version number."""
        slug = _slugify(event_type)
        event_dir = self._contracts_dir / "events" / slug

        if not event_dir.is_dir():
            raise ContractNotFoundError(f"No contracts found for event type '{event_type}'.")

        contracts: list[EventContract] = []
        for path in sorted(event_dir.glob("v*.json")):
            if path.is_file():
                try:
                    data = json.loads(path.read_text(encoding="utf-8"))
                    contract = _parse_event_contract(data, source=path.name)
                    contracts.append(contract)
                except (json.JSONDecodeError, InvalidContractError) as exc:
                    logger.warning("Skipping invalid contract %s: %s", path.name, exc)

        if not contracts:
            raise ContractNotFoundError(f"No valid contracts found for event type '{event_type}'.")

        contracts.sort(key=lambda c: c.version)
        return contracts

    def _load_contract(
        self, path: Path, expected_type: str, expected_version: int
    ) -> EventContract:
        """Read, parse, and validate a single contract file."""
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise InvalidContractError(f"Malformed JSON in {path.name}: {exc}") from exc

        contract = _parse_event_contract(data, source=path.name)

        if contract.event_type != expected_type:
            raise InvalidContractError(
                f"Contract in {path.name} has eventType '{contract.event_type}' "
                f"but expected '{expected_type}'."
            )

        if contract.version != expected_version:
            raise InvalidContractError(
                f"Contract in {path.name} has version {contract.version} "
                f"but expected {expected_version}."
            )

        return contract
