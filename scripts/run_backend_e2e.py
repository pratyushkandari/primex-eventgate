"""Run the backend end-to-end tests (pytest -m e2e) against DynamoDB Local.

Starts amazon/dynamodb-local in Docker on a free port, points the e2e suite at
it with EVENTGATE_E2E_DYNAMODB_URL, runs the suite and removes the container.
Extra arguments go to pytest.

    python scripts/run_backend_e2e.py
    python scripts/run_backend_e2e.py --junitxml=reports/backend-e2e.xml
    python scripts/run_backend_e2e.py --no-docker   # local storage mode only

Uses the current Python interpreter, so run it from the project's virtual
environment. Nothing here talks to AWS: the suite uses dummy credentials.
"""

from __future__ import annotations

import os
import shutil
import socket
import subprocess
import sys
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMAGE = "amazon/dynamodb-local:3.1.0"
STARTUP_TIMEOUT_S = 60


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _wait_for_dynamodb(endpoint: str) -> None:
    import boto3
    from botocore.exceptions import BotoCoreError, ClientError

    client = boto3.client(
        "dynamodb",
        endpoint_url=endpoint,
        region_name="ap-south-1",
        aws_access_key_id="e2e",
        aws_secret_access_key="e2e",
    )
    deadline = time.monotonic() + STARTUP_TIMEOUT_S
    while time.monotonic() < deadline:
        try:
            client.list_tables()
            return
        except (BotoCoreError, ClientError):
            time.sleep(0.5)
    raise RuntimeError(f"DynamoDB Local did not answer at {endpoint} in {STARTUP_TIMEOUT_S}s")


def _pytest(extra: list[str], env: dict[str, str]) -> int:
    cmd = [sys.executable, "-m", "pytest", "-m", "e2e", "backend/tests/e2e", *extra]
    return subprocess.call(cmd, cwd=ROOT, env=env)


def main() -> int:
    args = sys.argv[1:]
    env = dict(os.environ)
    if "--no-docker" in args:
        args.remove("--no-docker")
        env.pop("EVENTGATE_E2E_DYNAMODB_URL", None)
        return _pytest(args, env)

    docker = shutil.which("docker")
    if not docker:
        print("docker not found; install Docker or pass --no-docker", file=sys.stderr)
        return 2

    port = _free_port()
    name = f"eventgate-e2e-dynamodb-{uuid.uuid4().hex[:8]}"
    subprocess.run(
        [docker, "run", "--rm", "-d", "--name", name, "-p", f"127.0.0.1:{port}:8000", IMAGE],
        check=True,
        stdout=subprocess.DEVNULL,
    )
    try:
        endpoint = f"http://127.0.0.1:{port}"
        _wait_for_dynamodb(endpoint)
        env["EVENTGATE_E2E_DYNAMODB_URL"] = endpoint
        return _pytest(args, env)
    finally:
        subprocess.run([docker, "rm", "-f", name], stdout=subprocess.DEVNULL, check=False)


if __name__ == "__main__":
    sys.exit(main())
