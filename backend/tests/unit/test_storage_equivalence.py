"""Cloud / Local Storage Equivalence Tests.

Verifies Section 40 & 105 of the EventGate specification:
Given identical canonical contract data:
Local JSON repository and DynamoDB repository MUST produce equivalent:
- Decision
- Severity
- Summary
- Findings (ruleId, consumerId, field, status, message)
- ChangeSet

Tested across all 3 golden scenarios:
- Scenario A: OrderPlaced v1 -> v2 (ALLOW / LOW)
- Scenario B: OrderPlaced v1 -> v3 (BLOCK / HIGH)
- Scenario C: OrderPlaced v1 -> v4 (REVIEW / MEDIUM)
"""

import json
from decimal import Decimal
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from eventgate.application.services.event_analysis_service import EventAnalysisService
from eventgate.domain.compatibility import CompatibilityEngine
from eventgate.domain.enums import Decision, Severity
from eventgate.infrastructure.repositories.consumer_contract_repository import (
    JsonConsumerContractRepository,
)
from eventgate.infrastructure.repositories.dynamo_consumer_contract_repository import (
    DynamoConsumerContractRepository,
)
from eventgate.infrastructure.repositories.dynamo_event_contract_repository import (
    DynamoEventContractRepository,
)
from eventgate.infrastructure.repositories.event_contract_repository import (
    JsonEventContractRepository,
)

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
_CONTRACTS_DIR = _PROJECT_ROOT / "contracts"


class InMemoryDynamoDBResource:
    """In-memory mock DynamoDB resource that accurately mirrors DynamoDB behavior."""

    def __init__(self):
        self._event_items: dict[tuple[str, int], dict] = {}
        self._consumer_items: dict[str, dict] = {}

    def seed_from_contracts_dir(self, contracts_dir: Path):
        # Load event contracts
        for f in (contracts_dir / "events").rglob("*.json"):
            with open(f, encoding="utf-8") as fp:
                data = json.load(fp)
            version = data["version"]
            event_type = data["eventType"]
            item = {
                "eventType": event_type,
                "version": Decimal(str(version)),
                "fields": data["fields"],
            }
            self._event_items[(event_type, version)] = item

        # Load consumer contracts
        for f in (contracts_dir / "consumers").rglob("*.json"):
            with open(f, encoding="utf-8") as fp:
                data = json.load(fp)
            consumer_id = data["consumerId"]
            item = {
                "consumerId": consumer_id,
                "eventType": data["eventType"],
                "expectedFields": data["expectedFields"],
            }
            self._consumer_items[consumer_id] = item

    def Table(self, table_name: str):
        mock_table = MagicMock()
        if "event" in table_name:
            mock_table.get_item.side_effect = self._event_get_item
            mock_table.query.side_effect = self._event_query
        else:
            mock_table.get_item.side_effect = self._consumer_get_item
            mock_table.query.side_effect = self._consumer_query
        return mock_table

    def _event_get_item(self, Key):
        event_type = Key["eventType"]
        version = int(Key["version"])
        item = self._event_items.get((event_type, version))
        return {"Item": item} if item else {}

    def _event_query(self, KeyConditionExpression=None, Limit=None):
        # Return all items matching eventType
        items = [item for (et, _), item in self._event_items.items() if et == "OrderPlaced"]
        if Limit:
            items = items[:Limit]
        return {"Items": items}

    def _consumer_get_item(self, Key):
        consumer_id = Key["consumerId"]
        item = self._consumer_items.get(consumer_id)
        return {"Item": item} if item else {}

    def _consumer_query(self, IndexName=None, KeyConditionExpression=None):
        # Query GSI EventTypeIndex
        items = [
            item for item in self._consumer_items.values() if item.get("eventType") == "OrderPlaced"
        ]
        return {"Items": items}


class TestStorageEquivalence:
    @pytest.fixture(autouse=True)
    def setup_services(self):
        engine = CompatibilityEngine()

        # 1. Local JSON service
        json_event_repo = JsonEventContractRepository(_CONTRACTS_DIR)
        json_consumer_repo = JsonConsumerContractRepository(_CONTRACTS_DIR)
        self.local_service = EventAnalysisService(json_event_repo, json_consumer_repo, engine)

        # 2. DynamoDB service with identical seeded data
        in_memory_dynamo = InMemoryDynamoDBResource()
        in_memory_dynamo.seed_from_contracts_dir(_CONTRACTS_DIR)
        dynamo_event_repo = DynamoEventContractRepository(
            table_name="event-contracts", dynamodb_resource=in_memory_dynamo
        )
        dynamo_consumer_repo = DynamoConsumerContractRepository(
            table_name="consumer-contracts", dynamodb_resource=in_memory_dynamo
        )
        self.dynamo_service = EventAnalysisService(dynamo_event_repo, dynamo_consumer_repo, engine)

    def _assert_equivalence(self, local_result, dynamo_result):
        """Assert complete deterministic equivalence between storage modes."""
        assert local_result.decision == dynamo_result.decision
        assert local_result.severity == dynamo_result.severity
        assert local_result.summary == dynamo_result.summary
        assert local_result.event_type == dynamo_result.event_type
        assert local_result.current_version == dynamo_result.current_version
        assert local_result.proposed_version == dynamo_result.proposed_version

        # Compare ChangeSet
        assert local_result.change_set == dynamo_result.change_set

        # Compare Findings
        assert len(local_result.findings) == len(dynamo_result.findings)
        for lf, df in zip(local_result.findings, dynamo_result.findings, strict=True):
            assert lf == df

    def test_equivalence_scenario_a_safe_v1_to_v2(self):
        local_res = self.local_service.analyze("OrderPlaced", 1, 2)
        dynamo_res = self.dynamo_service.analyze("OrderPlaced", 1, 2)

        assert local_res.decision == Decision.ALLOW
        assert local_res.severity == Severity.LOW
        self._assert_equivalence(local_res, dynamo_res)

    def test_equivalence_scenario_b_breaking_v1_to_v3(self):
        local_res = self.local_service.analyze("OrderPlaced", 1, 3)
        dynamo_res = self.dynamo_service.analyze("OrderPlaced", 1, 3)

        assert local_res.decision == Decision.BLOCK
        assert local_res.severity == Severity.HIGH
        self._assert_equivalence(local_res, dynamo_res)

    def test_equivalence_scenario_c_risk_v1_to_v4(self):
        local_res = self.local_service.analyze("OrderPlaced", 1, 4)
        dynamo_res = self.dynamo_service.analyze("OrderPlaced", 1, 4)

        assert local_res.decision == Decision.REVIEW
        assert local_res.severity == Severity.MEDIUM
        self._assert_equivalence(local_res, dynamo_res)
