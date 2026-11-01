"""GET /health: liveness probe. Does not touch storage or the event bus."""

from fastapi import APIRouter

from eventgate.config.settings import SERVICE_NAME, SERVICE_VERSION

router = APIRouter()


@router.get(
    "/health",
    summary="Health check",
    description="Returns the service name and version. Does not check downstream dependencies.",
)
async def health():
    return {
        "status": "ok",
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
    }
