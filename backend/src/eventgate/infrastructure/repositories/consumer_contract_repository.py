"""Consumer contracts read from JSON files (local storage backend).

Layout: contracts/consumers/{consumer-id}.json. All files are loaded once and
cached for the life of the repository instance.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from eventgate.domain.errors import ContractNotFoundError, InvalidContractError
from eventgate.domain.models import ConsumerContract
from eventgate.infrastructure.repositories.contract_parsing import parse_consumer_contract

logger = logging.getLogger(__name__)


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
                contract = parse_consumer_contract(data, source=path.name)
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

    def list_all_consumers(self) -> list[ConsumerContract]:
        """Return all registered consumer contracts sorted by consumer ID."""
        all_consumers = self._load_all()
        consumers = list(all_consumers.values())
        consumers.sort(key=lambda c: c.consumer_id)
        return consumers
