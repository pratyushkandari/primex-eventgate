"""JSON-based consumer contract repository for local development.

Reads consumer contracts from the filesystem:
  contracts/consumers/{consumer-id}.json
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from eventgate.domain.enums import SUPPORTED_FIELD_TYPES
from eventgate.domain.errors import ContractNotFoundError, InvalidContractError
from eventgate.domain.models import ConsumerContract, ConsumerField

logger = logging.getLogger(__name__)


def _parse_consumer_contract(data: dict, source: str) -> ConsumerContract:
    """Parse and validate a raw JSON dict into a ConsumerContract."""
    consumer_id = data.get("consumerId")
    if not consumer_id or not isinstance(consumer_id, str):
        raise InvalidContractError(f"Missing or invalid 'consumerId' in {source}.")

    event_type = data.get("eventType")
    if not event_type or not isinstance(event_type, str):
        raise InvalidContractError(f"Missing or invalid 'eventType' in {source}.")

    raw_fields = data.get("expectedFields")
    if not isinstance(raw_fields, dict):
        raise InvalidContractError(f"Missing or invalid 'expectedFields' in {source}.")

    expected_fields: dict[str, ConsumerField] = {}
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

        expected_fields[name] = ConsumerField(name=name, type=field_type, required=required)

    return ConsumerContract(
        consumer_id=consumer_id,
        event_type=event_type,
        expected_fields=expected_fields,
    )


class JsonConsumerContractRepository:
    """Loads consumer contracts from local JSON fixture files."""

    def __init__(self, contracts_dir: Path):
        self._contracts_dir = contracts_dir
        self._consumers: dict[str, ConsumerContract] | None = None

    def _load_all(self) -> dict[str, ConsumerContract]:
        """Load and cache all consumer contracts from the consumers directory."""
        if self._consumers is not None:
            return self._consumers

        consumers_dir = self._contracts_dir / "consumers"
        if not consumers_dir.is_dir():
            self._consumers = {}
            return self._consumers

        consumers: dict[str, ConsumerContract] = {}
        for path in sorted(consumers_dir.glob("*.json")):
            if not path.is_file():
                continue
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                contract = _parse_consumer_contract(data, source=path.name)
                if contract.consumer_id in consumers:
                    logger.warning(
                        "Duplicate consumer ID '%s' in %s — skipping.",
                        contract.consumer_id,
                        path.name,
                    )
                    continue
                consumers[contract.consumer_id] = contract
            except (json.JSONDecodeError, InvalidContractError) as exc:
                logger.warning("Skipping invalid consumer contract %s: %s", path.name, exc)

        self._consumers = consumers
        return self._consumers

    def list_consumers(self, event_type: str) -> list[ConsumerContract]:
        """Return all consumers registered for the given event type, sorted by ID."""
        all_consumers = self._load_all()
        matching = [c for c in all_consumers.values() if c.event_type == event_type]
        matching.sort(key=lambda c: c.consumer_id)
        return matching

    def get_consumer(self, consumer_id: str) -> ConsumerContract:
        """Return a specific consumer contract by ID."""
        all_consumers = self._load_all()
        if consumer_id not in all_consumers:
            raise ContractNotFoundError(f"Consumer '{consumer_id}' was not found.")
        return all_consumers[consumer_id]
