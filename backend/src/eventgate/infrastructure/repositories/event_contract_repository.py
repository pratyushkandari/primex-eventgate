"""Event contracts read from JSON files (local storage backend).

Layout: contracts/events/{event-type-slug}/v{version}.json, where the slug is the
event type in kebab case (OrderPlaced -> order-placed). A file may carry a
description after the version, e.g. v2-safe.json; the version and eventType
inside the file must match the requested event type and version.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path

from eventgate.domain.errors import (
    ContractNotFoundError,
    InvalidContractError,
    UnsupportedEventVersionError,
)
from eventgate.domain.models import EventContract
from eventgate.infrastructure.repositories.contract_parsing import parse_event_contract

logger = logging.getLogger(__name__)


def _slugify(event_type: str) -> str:
    """OrderPlaced -> order-placed."""
    return re.sub(r"(?<!^)(?=[A-Z])", "-", event_type).lower()


def _version_file_pattern(version: int) -> re.Pattern[str]:
    # v1.json or v1-anything.json, but never v10.json.
    return re.compile(rf"^v{version}(-[^.]*)?\.json$")


class JsonEventContractRepository:
    """Loads event contracts from local JSON fixture files."""

    def __init__(self, contracts_dir: Path):
        self._contracts_dir = contracts_dir

    def _event_dir(self, event_type: str) -> Path:
        event_dir = self._contracts_dir / "events" / _slugify(event_type)
        if not event_dir.is_dir():
            raise ContractNotFoundError(f"No contracts found for event type '{event_type}'.")
        return event_dir

    def get_event_contract(self, event_type: str, version: int) -> EventContract:
        """Load one version.

        Raises ContractNotFoundError for an unknown event type,
        UnsupportedEventVersionError for an unknown version, and
        InvalidContractError if the file is malformed or names another event/version.
        """
        event_dir = self._event_dir(event_type)
        pattern = _version_file_pattern(version)
        candidates = sorted(p for p in event_dir.iterdir() if p.is_file() and pattern.match(p.name))
        if not candidates:
            raise UnsupportedEventVersionError(event_type, version)
        if len(candidates) > 1:
            names = ", ".join(p.name for p in candidates)
            raise InvalidContractError(f"Multiple files define {event_type} v{version}: {names}.")
        return self._load_contract(candidates[0], event_type, version)

    def list_event_contracts(self, event_type: str) -> list[EventContract]:
        """Load every valid version, sorted by version; invalid files are skipped with a warning."""
        event_dir = self._event_dir(event_type)
        contracts: list[EventContract] = []
        for path in sorted(event_dir.glob("v*.json")):
            if not path.is_file():
                continue
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                contracts.append(parse_event_contract(data, source=path.name))
            except (json.JSONDecodeError, InvalidContractError) as exc:
                logger.warning("Skipping invalid contract %s: %s", path.name, exc)

        if not contracts:
            raise ContractNotFoundError(f"No valid contracts found for event type '{event_type}'.")
        contracts.sort(key=lambda c: c.version)
        return contracts

    def list_event_types(self) -> list[str]:
        """Return event type names, read from the first parseable file in each directory."""
        events_dir = self._contracts_dir / "events"
        if not events_dir.is_dir():
            return []

        event_types: set[str] = set()
        for directory in sorted(d for d in events_dir.iterdir() if d.is_dir()):
            for path in sorted(directory.glob("v*.json")):
                try:
                    name = json.loads(path.read_text(encoding="utf-8")).get("eventType")
                except (OSError, json.JSONDecodeError):
                    continue
                if isinstance(name, str) and name:
                    event_types.add(name)
                    break
        return sorted(event_types)

    def get_event_versions(self, event_type: str) -> list[int]:
        """Return the available version numbers (empty if the event type is unknown)."""
        try:
            return [c.version for c in self.list_event_contracts(event_type)]
        except ContractNotFoundError:
            return []

    def _load_contract(
        self, path: Path, expected_type: str, expected_version: int
    ) -> EventContract:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise InvalidContractError(f"Malformed JSON in {path.name}: {exc}") from exc

        contract = parse_event_contract(data, source=path.name)
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
