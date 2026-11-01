"""FastAPI application: routes, middleware and error handlers.

Runs unchanged under uvicorn locally and under Mangum on AWS Lambda
(see lambda_handler.py). Adapters are chosen from environment variables in
eventgate.api.dependencies.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from eventgate.api.errors import (
    eventgate_error_handler,
    http_error_handler,
    unhandled_error_handler,
    validation_error_handler,
)
from eventgate.api.request_id import request_id_middleware
from eventgate.api.routes import analysis, contracts, health, history, policies, publish
from eventgate.config.settings import SERVICE_NAME, SERVICE_VERSION
from eventgate.domain.errors import EventGateError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="EventGate",
    summary="Consumer-aware release gate for event contracts",
    description=(
        "Evaluates a proposed event contract version against the contracts of the "
        "consumers that read it, returns per-consumer findings and an ALLOW / REVIEW / "
        "BLOCK decision for the target environment, and publishes events only on ALLOW."
    ),
    version=SERVICE_VERSION,
)

# The API is read by a browser console hosted on another origin and has no
# cookies or auth headers to protect, so any origin may call it. API Gateway
# applies the same CORS policy in front of Lambda.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)
app.middleware("http")(request_id_middleware)

app.add_exception_handler(EventGateError, eventgate_error_handler)  # type: ignore[arg-type]
app.add_exception_handler(RequestValidationError, validation_error_handler)  # type: ignore[arg-type]
app.add_exception_handler(StarletteHTTPException, http_error_handler)  # type: ignore[arg-type]
app.add_exception_handler(Exception, unhandled_error_handler)

app.include_router(health.router, tags=["Health"])
app.include_router(contracts.router)
app.include_router(analysis.router, tags=["Analysis"])
app.include_router(publish.router, tags=["Publish"])
app.include_router(history.router, tags=["History"])
app.include_router(policies.router)

logger.info("EventGate %s started - service=%s", SERVICE_VERSION, SERVICE_NAME)
