"""Health endpoint."""

from fastapi import APIRouter

from eventgate.config.settings import SERVICE_NAME, SERVICE_VERSION

router = APIRouter()


@router.get(
    "/health",
    summary="Health check",
    description="Returns the service status. Phase 1 has no external dependencies.",
)
async def health():
    return {
        "status": "ok",
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
    }
