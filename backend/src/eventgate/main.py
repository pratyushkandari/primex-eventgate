"""EventGate FastAPI application."""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from eventgate.api.errors import eventgate_error_handler, unhandled_error_handler
from eventgate.api.routes import analysis, contracts, health, history, publish
from eventgate.config.settings import SERVICE_NAME, SERVICE_VERSION
from eventgate.domain.errors import EventGateError

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="EventGate",
    summary="Consumer-aware safety gate for event-driven systems",
    description=(
        "EventGate evaluates a proposed event contract against the contracts "
        "registered by downstream consumers, identifies structural changes, "
        "and returns per-consumer compatibility findings with an overall "
        "ALLOW / REVIEW / BLOCK decision."
    ),
    version=SERVICE_VERSION,
)

# CORS — permissive for local development; future phases will restrict.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Error handlers.
app.add_exception_handler(EventGateError, eventgate_error_handler)  # type: ignore[arg-type]
app.add_exception_handler(Exception, unhandled_error_handler)  # type: ignore[arg-type]

# Routes.
app.include_router(health.router, tags=["Health"])
app.include_router(contracts.router)
app.include_router(analysis.router, tags=["Analysis"])
app.include_router(publish.router, tags=["Publish"])
app.include_router(history.router, tags=["History"])

logger.info("EventGate %s started — service=%s", SERVICE_VERSION, SERVICE_NAME)
