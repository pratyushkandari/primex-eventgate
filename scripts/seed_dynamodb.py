"""DynamoDB seed script for EventGate.

Populates DynamoDB tables from the canonical local JSON contract fixtures.
Idempotent: uses put_item to safely overwrite/update existing records.
Does not contain or log AWS credentials.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from decimal import Decimal
from pathlib import Path
from typing import Any

import boto3

# Add backend/src to path if run directly
_REPO_ROOT = Path(__file__).resolve().parent.parent
_BACKEND_SRC = _REPO_ROOT / "backend" / "src"
if str(_BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(_BACKEND_SRC))

from eventgate.domain.enums import SUPPORTED_FIELD_TYPES  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("seed_dynamodb")


def validate_event_contract_data(data: dict[str, Any], filepath: Path) -> dict[str, Any]:
    """Validate raw event contract fixture data before inserting into DynamoDB."""
    event_type = data.get("eventType")
    if not event_type or not isinstance(event_type, str):
        raise ValueError(f"Invalid or missing 'eventType' in {filepath}")

    raw_version = data.get("version")
    if raw_version is None or not isinstance(raw_version, int) or raw_version < 1:
        raise ValueError(f"Invalid or missing 'version' in {filepath}")

    fields = data.get("fields")
    if not isinstance(fields, dict) or not fields:
        raise ValueError(f"Invalid or missing 'fields' dict in {filepath}")

    for name, spec in fields.items():
        if not isinstance(spec, dict):
            raise ValueError(f"Field '{name}' spec must be a dict in {filepath}")
        field_type = spec.get("type")
        if field_type not in SUPPORTED_FIELD_TYPES:
            raise ValueError(f"Unsupported field type '{field_type}' for '{name}' in {filepath}")
        if not isinstance(spec.get("required"), bool):
            raise ValueError(f"Field '{name}' missing boolean 'required' in {filepath}")

    return {
        "eventType": event_type,
        "version": Decimal(str(raw_version)),
        "fields": fields,
    }


def validate_consumer_contract_data(data: dict[str, Any], filepath: Path) -> dict[str, Any]:
    """Validate raw consumer contract fixture data before inserting into DynamoDB."""
    consumer_id = data.get("consumerId")
    if not consumer_id or not isinstance(consumer_id, str):
        raise ValueError(f"Invalid or missing 'consumerId' in {filepath}")

    event_type = data.get("eventType")
    if not event_type or not isinstance(event_type, str):
        raise ValueError(f"Invalid or missing 'eventType' in {filepath}")

    expected_fields = data.get("expectedFields")
    if not isinstance(expected_fields, dict) or not expected_fields:
        raise ValueError(f"Invalid or missing 'expectedFields' dict in {filepath}")

    for name, spec in expected_fields.items():
        if not isinstance(spec, dict):
            raise ValueError(f"Field '{name}' spec must be a dict in {filepath}")
        field_type = spec.get("type")
        if field_type not in SUPPORTED_FIELD_TYPES:
            raise ValueError(f"Unsupported field type '{field_type}' for '{name}' in {filepath}")
        if not isinstance(spec.get("required"), bool):
            raise ValueError(f"Field '{name}' missing boolean 'required' in {filepath}")

    return {
        "consumerId": consumer_id,
        "eventType": event_type,
        "expectedFields": expected_fields,
    }


def seed_dynamodb(
    event_table_name: str,
    consumer_table_name: str,
    contracts_dir: Path,
    dynamodb_resource: Any = None,
    region_name: str | None = None,
) -> dict[str, int]:
    """Seed event and consumer contracts into DynamoDB from JSON files.

    Returns a dict with counts of seeded items:
    {'event_contracts': N, 'consumer_contracts': M}
    """
    if dynamodb_resource is None:
        dynamodb_resource = boto3.resource("dynamodb", region_name=region_name)

    event_table = dynamodb_resource.Table(event_table_name)
    consumer_table = dynamodb_resource.Table(consumer_table_name)

    # 1. Seed Event Contracts
    events_dir = contracts_dir / "events"
    event_files = sorted(events_dir.rglob("*.json")) if events_dir.is_dir() else []
    if not event_files:
        logger.warning("No event contract files found under %s", events_dir)

    events_seeded = 0
    for file_path in event_files:
        try:
            with open(file_path, encoding="utf-8") as f:
                data = json.load(f)
            item = validate_event_contract_data(data, file_path)
            event_table.put_item(Item=item)
            logger.info(
                "Seeded event contract: %s v%s from %s",
                item["eventType"],
                item["version"],
                file_path.name,
            )
            events_seeded += 1
        except Exception as exc:
            logger.error("Failed to seed event contract from %s: %s", file_path, exc)
            raise

    # 2. Seed Consumer Contracts
    consumers_dir = contracts_dir / "consumers"
    consumer_files = sorted(consumers_dir.rglob("*.json")) if consumers_dir.is_dir() else []
    if not consumer_files:
        logger.warning("No consumer contract files found under %s", consumers_dir)

    consumers_seeded = 0
    for file_path in consumer_files:
        try:
            with open(file_path, encoding="utf-8") as f:
                data = json.load(f)
            item = validate_consumer_contract_data(data, file_path)
            consumer_table.put_item(Item=item)
            logger.info(
                "Seeded consumer contract: %s (%s) from %s",
                item["consumerId"],
                item["eventType"],
                file_path.name,
            )
            consumers_seeded += 1
        except Exception as exc:
            logger.error("Failed to seed consumer contract from %s: %s", file_path, exc)
            raise

    logger.info(
        "Seeding complete: %d event contracts, %d consumer contracts seeded successfully.",
        events_seeded,
        consumers_seeded,
    )
    return {
        "event_contracts": events_seeded,
        "consumer_contracts": consumers_seeded,
    }


def main() -> int:
    """CLI entrypoint for DynamoDB seeding."""
    parser = argparse.ArgumentParser(description="Seed EventGate contract fixtures into DynamoDB")
    parser.add_argument(
        "--event-table",
        default=os.environ.get(
            "EVENT_CONTRACTS_TABLE_NAME", "primex-eventgate-dev-event-contracts"
        ),
        help="DynamoDB table name for event contracts",
    )
    parser.add_argument(
        "--consumer-table",
        default=os.environ.get(
            "CONSUMER_CONTRACTS_TABLE_NAME", "primex-eventgate-dev-consumer-contracts"
        ),
        help="DynamoDB table name for consumer contracts",
    )
    parser.add_argument(
        "--region",
        default=os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or "us-east-1",
        help="AWS region name",
    )
    parser.add_argument(
        "--contracts-dir",
        default=str(_REPO_ROOT / "contracts"),
        help="Path to contracts fixtures directory",
    )

    args = parser.parse_args()
    contracts_path = Path(args.contracts_dir)

    logger.info("Starting DynamoDB seed process...")
    logger.info("  Region: %s", args.region)
    logger.info("  Event table: %s", args.event_table)
    logger.info("  Consumer table: %s", args.consumer_table)
    logger.info("  Contracts dir: %s", contracts_path)

    try:
        results = seed_dynamodb(
            event_table_name=args.event_table,
            consumer_table_name=args.consumer_table,
            contracts_dir=contracts_path,
            region_name=args.region,
        )
        logger.info(
            "SUCCESS: Seeded %d event contracts and %d consumer contracts.",
            results["event_contracts"],
            results["consumer_contracts"],
        )
        return 0
    except Exception as exc:
        logger.error("DynamoDB seeding failed: %s", exc)
        return 1


if __name__ == "__main__":
    sys.exit(main())
