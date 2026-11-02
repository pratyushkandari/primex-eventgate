"""Maps exceptions to the API's single error envelope.

Every error response, including unknown routes and request validation
failures, has this shape and echoes the request ID header:

    {"error": {"code": "CONTRACT_NOT_FOUND",
               "message": "No contracts found for event type 'Foo'.",
               "requestId": "..."}}

Validation errors add a "details" list with one entry per invalid field.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from eventgate.api.request_id import get_request_id
from eventgate.domain.errors import (
    ConfigurationError,
    ContractNotFoundError,
    EventGateError,
    EventPublishFailedError,
    InvalidAnalysisRequestError,
    InvalidContractError,
    InvalidEventPayloadError,
    ReleaseRecordNotFoundError,
    UnsupportedEventVersionError,
)

logger = logging.getLogger(__name__)

_ERROR_STATUS_MAP: dict[type, int] = {
    ContractNotFoundError: 404,
    ReleaseRecordNotFoundError: 404,
    UnsupportedEventVersionError: 404,
    InvalidContractError: 400,
    InvalidAnalysisRequestError: 400,
    InvalidEventPayloadError: 422,
    EventPublishFailedError: 503,
    ConfigurationError: 500,
}

_HTTP_ERROR_CODES: dict[int, str] = {
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
}


def _error_response(
    request: Request,
    code: str,
    message: str,
    status: int,
    details: list[dict[str, Any]] | None = None,
) -> JSONResponse:
    request_id = get_request_id(request)
    body: dict[str, Any] = {"code": code, "message": message, "requestId": request_id}
    if details:
        body["details"] = details
    return JSONResponse(
        status_code=status,
        headers={"X-Request-ID": request_id},
        content={"error": body},
    )


async def eventgate_error_handler(request: Request, exc: EventGateError) -> JSONResponse:
    """Handle known EventGate domain/application errors."""
    status_code = _ERROR_STATUS_MAP.get(type(exc), 500)
    if status_code >= 500:
        logger.error(
            "EventGate error: code=%s message=%s request_id=%s",
            exc.code,
            exc.message,
            get_request_id(request),
        )
    return _error_response(request, exc.code, exc.message, status_code)


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Report malformed bodies and invalid fields as VALIDATION_ERROR (422)."""
    details = [
        {
            "field": ".".join(str(part) for part in err.get("loc", ()) if part != "body"),
            "message": err.get("msg", "Invalid value"),
        }
        for err in exc.errors()
    ]
    summary = "; ".join(f"{d['field'] or 'body'}: {d['message']}" for d in details)
    return _error_response(request, "VALIDATION_ERROR", f"Invalid request. {summary}", 422, details)


async def http_error_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Wrap framework HTTP errors (unknown route, wrong method) in the envelope."""
    code = _HTTP_ERROR_CODES.get(exc.status_code, f"HTTP_{exc.status_code}")
    message = exc.detail if isinstance(exc.detail, str) else "Request failed."
    if exc.status_code == 404:
        message = f"No route matches {request.method} {request.url.path}."
    return _error_response(request, code, message, exc.status_code)


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all for unexpected exceptions; never leaks internals to the client."""
    logger.exception("Unhandled exception: request_id=%s", get_request_id(request))
    return _error_response(request, "INTERNAL_ERROR", "An unexpected error occurred.", 500)
