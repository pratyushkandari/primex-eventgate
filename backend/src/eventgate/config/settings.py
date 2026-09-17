"""Application settings for EventGate.

Resolves the contracts directory relative to the project root. Does not
hard-code developer-specific paths.
"""

from __future__ import annotations

from pathlib import Path

# Resolve project root: pyproject.toml lives at the repo root, and this
# module lives at backend/src/eventgate/config/settings.py — so the repo
# root is 4 levels up.
_THIS_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _THIS_DIR.parent.parent.parent.parent

SERVICE_NAME = "eventgate"
SERVICE_VERSION = "0.1.0"

# Default contracts directory (can be overridden via environment variable).
CONTRACTS_DIR = _PROJECT_ROOT / "contracts"

STORAGE_BACKEND_LOCAL = "local"
STORAGE_BACKEND_DYNAMODB = "dynamodb"


def get_contracts_dir() -> Path:
    """Return the contracts directory, falling back to the default."""
    import os

    override = os.environ.get("EVENTGATE_CONTRACTS_DIR")
    if override:
        return Path(override)
    return CONTRACTS_DIR


def get_storage_backend() -> str:
    """Return the storage backend ('local' or 'dynamodb'), defaulting to 'local'."""
    import os

    backend = os.environ.get("EVENTGATE_STORAGE_BACKEND", STORAGE_BACKEND_LOCAL).strip().lower()
    if backend not in (STORAGE_BACKEND_LOCAL, STORAGE_BACKEND_DYNAMODB):
        return STORAGE_BACKEND_LOCAL
    return backend


def get_event_contracts_table_name() -> str:
    """Return the DynamoDB table name for event contracts."""
    import os

    return os.environ.get("EVENT_CONTRACTS_TABLE_NAME", "primex-eventgate-dev-event-contracts")


def get_consumer_contracts_table_name() -> str:
    """Return the DynamoDB table name for consumer contracts."""
    import os

    return os.environ.get(
        "CONSUMER_CONTRACTS_TABLE_NAME", "primex-eventgate-dev-consumer-contracts"
    )


def get_aws_region() -> str:
    """Return the configured AWS region, falling back to us-east-1."""
    import os

    return os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or "us-east-1"
