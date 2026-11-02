"""Runtime configuration read from environment variables.

Every variable is optional; the defaults run the whole stack locally with JSON
contracts, a JSON history file and an in-memory publisher. Values are read on
each call so tests can change them with monkeypatch (then call
``eventgate.api.dependencies.clear_caches``). See .env.example for the list.
"""

from __future__ import annotations

import os
from pathlib import Path

from eventgate import __version__

# backend/src/eventgate/config/settings.py -> repository root is four levels up.
_PROJECT_ROOT = Path(__file__).resolve().parents[4]

SERVICE_NAME = "eventgate"
SERVICE_VERSION = __version__

DEFAULT_AWS_REGION = "ap-south-1"

STORAGE_BACKEND_LOCAL = "local"
STORAGE_BACKEND_DYNAMODB = "dynamodb"

PUBLISHER_BACKEND_LOCAL = "local"
PUBLISHER_BACKEND_EVENTBRIDGE = "eventbridge"


def _choice(name: str, default: str, allowed: tuple[str, ...]) -> str:
    value = os.environ.get(name, default).strip().lower()
    return value if value in allowed else default


def get_contracts_dir() -> Path:
    """Directory holding contracts/events and contracts/consumers (local storage)."""
    override = os.environ.get("EVENTGATE_CONTRACTS_DIR")
    return Path(override) if override else _PROJECT_ROOT / "contracts"


def get_history_file() -> Path:
    """JSON file for release history in local storage mode (gitignored by default)."""
    override = os.environ.get("EVENTGATE_HISTORY_FILE")
    return Path(override) if override else _PROJECT_ROOT / ".eventgate" / "history.json"


def get_storage_backend() -> str:
    """'local' (JSON files) or 'dynamodb'; anything else falls back to 'local'."""
    return _choice(
        "EVENTGATE_STORAGE_BACKEND",
        STORAGE_BACKEND_LOCAL,
        (STORAGE_BACKEND_LOCAL, STORAGE_BACKEND_DYNAMODB),
    )


def get_event_publisher_backend() -> str:
    """'local' (in-memory) or 'eventbridge'; anything else falls back to 'local'."""
    return _choice(
        "EVENTGATE_EVENT_PUBLISHER",
        PUBLISHER_BACKEND_LOCAL,
        (PUBLISHER_BACKEND_LOCAL, PUBLISHER_BACKEND_EVENTBRIDGE),
    )


def get_event_contracts_table_name() -> str:
    return os.environ.get("EVENT_CONTRACTS_TABLE_NAME", "primex-eventgate-dev-event-contracts")


def get_consumer_contracts_table_name() -> str:
    return os.environ.get(
        "CONSUMER_CONTRACTS_TABLE_NAME", "primex-eventgate-dev-consumer-contracts"
    )


def get_release_history_table_name() -> str:
    return os.environ.get("RELEASE_HISTORY_TABLE_NAME", "primex-eventgate-dev-release-history")


def get_eventbridge_bus_name() -> str:
    return os.environ.get("EVENTBRIDGE_BUS_NAME", "primex-eventgate-dev-bus")


def get_aws_region() -> str:
    """AWS region; Lambda sets AWS_REGION itself."""
    return (
        os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or DEFAULT_AWS_REGION
    )
