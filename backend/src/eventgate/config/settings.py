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


def get_contracts_dir() -> Path:
    """Return the contracts directory, falling back to the default."""
    import os

    override = os.environ.get("EVENTGATE_CONTRACTS_DIR")
    if override:
        return Path(override)
    return CONTRACTS_DIR
