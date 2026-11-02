"""Run the API as a real uvicorn process and talk to it over HTTP.

Two storage modes, each a separate server process:

- ``local``: JSON contracts from contracts/ and a JSON history file in a temp
  directory. Always runs.
- ``dynamodb``: DynamoDB Local (or any DynamoDB-compatible endpoint) given in
  EVENTGATE_E2E_DYNAMODB_URL. Tables are created from the key schemas in
  template.yaml under a unique prefix, seeded with scripts/seed_dynamodb.py and
  deleted afterwards. Skipped when the variable is not set; the runner
  ``python scripts/run_backend_e2e.py`` starts DynamoDB Local in Docker and sets it.

The publisher is always the in-memory one: no EventBridge emulator is used, and
real delivery is a manual check (docs/TESTING.md). Dummy AWS credentials and an
empty AWS config keep every boto3 call on the local endpoint.
"""

from __future__ import annotations

import os
import socket
import subprocess
import sys
import time
import uuid
from collections.abc import Iterator
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx
import pytest
import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[3]
CONTRACTS_DIR = PROJECT_ROOT / "contracts"
TEMPLATE_PATH = PROJECT_ROOT / "template.yaml"
DYNAMODB_URL_ENV = "EVENTGATE_E2E_DYNAMODB_URL"
STARTUP_TIMEOUT_S = 30
REGION = "ap-south-1"

# template.yaml logical ID -> (setting env var, table name suffix)
TABLES = {
    "EventContractsTable": ("EVENT_CONTRACTS_TABLE_NAME", "event-contracts"),
    "ConsumerContractsTable": ("CONSUMER_CONTRACTS_TABLE_NAME", "consumer-contracts"),
    "ReleaseHistoryTable": ("RELEASE_HISTORY_TABLE_NAME", "release-history"),
}


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


@dataclass
class ApiServer:
    """One uvicorn process serving eventgate.main:app with the given environment."""

    mode: str
    env: dict[str, str]
    log_path: Path
    port: int = field(default_factory=_free_port)
    process: subprocess.Popen[bytes] | None = None

    @property
    def base_url(self) -> str:
        return f"http://127.0.0.1:{self.port}"

    def start(self) -> None:
        log = self.log_path.open("ab")
        self.process = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "eventgate.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(self.port),
            ],
            cwd=PROJECT_ROOT,
            env=self.env,
            stdout=log,
            stderr=subprocess.STDOUT,
        )
        deadline = time.monotonic() + STARTUP_TIMEOUT_S
        while time.monotonic() < deadline:
            if self.process.poll() is not None:
                raise RuntimeError(f"API server exited early:\n{self.log()}")
            try:
                if httpx.get(f"{self.base_url}/health", timeout=1).status_code == 200:
                    return
            except httpx.TransportError:
                pass
            time.sleep(0.2)
        self.stop()
        raise RuntimeError(
            f"API server did not answer /health in {STARTUP_TIMEOUT_S}s:\n{self.log()}"
        )

    def stop(self) -> None:
        if self.process and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait()

    def log(self) -> str:
        return self.log_path.read_text(encoding="utf-8", errors="replace")


def _base_env(tmp: Path) -> dict[str, str]:
    env = {
        key: value
        for key, value in os.environ.items()
        if not key.startswith(("AWS_", "EVENTGATE_", "EVENTBRIDGE_"))
        and not key.endswith("_TABLE_NAME")
    }
    src = str(PROJECT_ROOT / "backend" / "src")
    env["PYTHONPATH"] = os.pathsep.join(filter(None, [src, os.environ.get("PYTHONPATH")]))
    env["EVENTGATE_EVENT_PUBLISHER"] = "local"
    env["EVENTGATE_HISTORY_FILE"] = str(tmp / "history.json")
    env["EVENTGATE_CONTRACTS_DIR"] = str(CONTRACTS_DIR)
    # Never reach a real AWS account: no profiles, dummy keys, fixed region.
    env["AWS_CONFIG_FILE"] = str(tmp / "no-aws-config")
    env["AWS_SHARED_CREDENTIALS_FILE"] = str(tmp / "no-aws-credentials")
    env["AWS_ACCESS_KEY_ID"] = "e2e"
    env["AWS_SECRET_ACCESS_KEY"] = "e2e"
    env["AWS_REGION"] = REGION
    return env


def _template_tables() -> dict[str, dict[str, Any]]:
    class CFTagLoader(yaml.SafeLoader):
        pass

    def ignore_tag(loader: yaml.SafeLoader, node: yaml.Node) -> Any:
        if isinstance(node, yaml.ScalarNode):
            return loader.construct_scalar(node)
        if isinstance(node, yaml.SequenceNode):
            return loader.construct_sequence(node)
        if isinstance(node, yaml.MappingNode):
            return loader.construct_mapping(node)
        return None

    for tag in ("!Ref", "!Sub", "!GetAtt", "!Select", "!Split", "!Join"):
        CFTagLoader.add_constructor(tag, ignore_tag)
    with TEMPLATE_PATH.open(encoding="utf-8") as f:
        resources = yaml.load(f, Loader=CFTagLoader)["Resources"]
    return {logical_id: resources[logical_id]["Properties"] for logical_id in TABLES}


def _create_tables(resource: Any, prefix: str) -> dict[str, str]:
    """Create the three tables with template.yaml's keys and indexes; return env var -> name."""
    names: dict[str, str] = {}
    for logical_id, props in _template_tables().items():
        env_var, suffix = TABLES[logical_id]
        name = f"{prefix}-{suffix}"
        kwargs: dict[str, Any] = {
            "TableName": name,
            "BillingMode": props["BillingMode"],
            "AttributeDefinitions": props["AttributeDefinitions"],
            "KeySchema": props["KeySchema"],
        }
        if "GlobalSecondaryIndexes" in props:
            kwargs["GlobalSecondaryIndexes"] = props["GlobalSecondaryIndexes"]
        resource.create_table(**kwargs).wait_until_exists()
        names[env_var] = name
    return names


@pytest.fixture(scope="module", params=["local", "dynamodb"])
def api_server(
    request: pytest.FixtureRequest, tmp_path_factory: pytest.TempPathFactory
) -> Iterator[ApiServer]:
    mode = request.param
    tmp = tmp_path_factory.mktemp(f"e2e-{mode}")
    env = _base_env(tmp)
    env["EVENTGATE_STORAGE_BACKEND"] = mode
    tables: dict[str, str] = {}
    resource = None

    if mode == "dynamodb":
        endpoint = os.environ.get(DYNAMODB_URL_ENV)
        if not endpoint:
            pytest.skip(
                f"{DYNAMODB_URL_ENV} is not set; run scripts/run_backend_e2e.py to start "
                "DynamoDB Local"
            )
        import boto3

        resource = boto3.resource(
            "dynamodb",
            endpoint_url=endpoint,
            region_name=REGION,
            aws_access_key_id="e2e",
            aws_secret_access_key="e2e",
        )
        tables = _create_tables(resource, f"e2e-{uuid.uuid4().hex[:8]}")
        from scripts.seed_dynamodb import seed_dynamodb

        seed_dynamodb(
            tables["EVENT_CONTRACTS_TABLE_NAME"],
            tables["CONSUMER_CONTRACTS_TABLE_NAME"],
            CONTRACTS_DIR,
            dynamodb_resource=resource,
        )
        env.update(tables)
        env["AWS_ENDPOINT_URL_DYNAMODB"] = endpoint

    server = ApiServer(mode=mode, env=env, log_path=tmp / "server.log")
    server.start()
    try:
        yield server
    finally:
        server.stop()
        if resource is not None:
            for name in tables.values():
                resource.Table(name).delete()


@pytest.fixture(scope="module")
def api(api_server: ApiServer) -> Iterator[httpx.Client]:
    with httpx.Client(base_url=api_server.base_url, timeout=15) as client:
        yield client
