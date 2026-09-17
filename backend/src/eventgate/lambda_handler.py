"""AWS Lambda ASGI adapter for EventGate.

Integrates the existing FastAPI application with AWS Lambda using Mangum.
Routes requests received via API Gateway HTTP API to the application.
Contains no business logic.
"""

from __future__ import annotations

from mangum import Mangum

from eventgate.main import app

# Create the Lambda handler entrypoint.
# lifespan="off" avoids asyncio lifespan overhead in short-lived Lambda executions.
handler = Mangum(app, lifespan="off")
