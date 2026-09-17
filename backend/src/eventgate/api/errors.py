"""API error handling — maps domain errors to stable HTTP responses.

Error format:
{
    "error": {
        "code": "CONTRACT_NOT_FOUND",
        "message": "OrderPlaced version 99 was not found.",
        "requestId": "uuid"
    }
}
"""

from __future__ import annotations

import logging
import uuid

from fastapi import Request
from fastapi.responses import JSONResponse

from eventgate.domain.errors import (
    ContractNotFoundError,
    EventGateError,
    InvalidAnalysisRequestError,
    InvalidContractError,
    UnsupportedEventTypeError,
    UnsupportedEventVersionError,
)

logger = logging.getLogger(__name__)

# Domain error → HTTP status code mapping.
_ERROR_STATUS_MAP: dict[type, int] = {
    ContractNotFoundError: 404,
    UnsupportedEventTypeError: 404,
    UnsupportedEventVersionError: 404,
    InvalidContractError: 400,
    InvalidAnalysisRequestError: 400,
}


def _get_request_id(request: Request) -> str:
    """Extract request ID from state or generate one."""
    return getattr(request.state, "request_id", str(uuid.uuid4()))


def _error_response(code: str, message: str, request_id: str, status: int) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        headers={"X-Request-ID": request_id},
        content={
            "error": {
                "code": code,
                "message": message,
                "requestId": request_id,
            }
        },
    )


async def eventgate_error_handler(request: Request, exc: EventGateError) -> JSONResponse:
    """Handle known EventGate domain/application errors."""
    request_id = _get_request_id(request)
    status_code = _ERROR_STATUS_MAP.get(type(exc), 500)

    if status_code >= 500:
        logger.error(
            "Unexpected EventGate error: code=%s message=%s request_id=%s",
            exc.code,
            exc.message,
            request_id,
        )

    return _error_response(exc.code, exc.message, request_id, status_code)


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all for unexpected exceptions — never leak internals."""
    request_id = _get_request_id(request)
    logger.exception("Unhandled exception: request_id=%s", request_id)

    return _error_response(
        "INTERNAL_ERROR",
        "An unexpected error occurred.",
        request_id,
        500,
    )
