"""Request ID propagation.

Each request gets an ID: the caller's X-Request-ID header with every character
other than letters, digits, '-' and '_' removed and cut to 128 characters, or a
new UUID when no header was sent or nothing is left. 128 is a decision (see
docs/decisions.md, section 10).
The ID is stored on request.state, echoed in the X-Request-ID response header,
written into analysis results and history records, and logged.
"""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable

from fastapi import Request, Response

_MAX_LENGTH = 128


def _sanitize(raw: str) -> str:
    return "".join(c for c in raw if c.isalnum() or c in "-_")[:_MAX_LENGTH]


def get_request_id(request: Request) -> str:
    """Return the request's ID, assigning one if the middleware has not run yet."""
    existing = getattr(request.state, "request_id", None)
    if existing:
        return existing
    request_id = _sanitize(request.headers.get("X-Request-ID", "")) or str(uuid.uuid4())
    request.state.request_id = request_id
    return request_id


async def request_id_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    request_id = get_request_id(request)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response
