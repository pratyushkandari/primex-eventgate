# Design decisions

Short records of the choices that shape EventGate, with what each one costs.

## 1. FastAPI on Lambda through Mangum

**Decision:** one FastAPI application, served by uvicorn locally and by Lambda (Mangum adapter) behind an API Gateway HTTP API in AWS.
**Why:** the same code, validation and OpenAPI schema in both places; no servers to run and no idle cost.
**Cost:** cold starts on the first request after idle time; long-lived connections are not an option.

## 2. Deterministic, consumer-scoped rules

**Decision:** compatibility is a fixed set of structural rules (EVT001–EVT008) evaluated per consumer, only against the fields that consumer declares.
**Why:** a release gate must give the same answer every time and explain it. Scoping to declared fields avoids flagging consumers that never read the changed field.
**Cost:** consumers have to keep their contracts current. The rules compare top-level field names, types and requiredness only. An event with no registered consumers cannot be verified and is held for review.

## 3. Compatibility separate from release policy

**Decision:** the engine produces SAFE/RISK/BREAK with a severity; a policy maps that and the target environment to ALLOW/REVIEW/BLOCK.
**Why:** removing an optional field is the same change everywhere, but teams accept it in development and want a review in production. Keeping the two apart lets the policy change without touching the rules.
**Cost:** two concepts to explain in the API and UI. The Cedar engine has to stay in step with the standard engine; a test checks every cell.

## 4. Ports and adapters

**Decision:** services depend on repository and publisher interfaces, with JSON/in-memory adapters for local use and DynamoDB/EventBridge adapters for AWS, chosen by environment variables.
**Why:** the full stack, the CLI and the tests run with no AWS account; integration tests run the AWS adapters against moto.
**Cost:** two implementations of each port whose behaviour must match (for example, both replace history records by `record_id`).

## 5. DynamoDB with catalog items instead of scans

**Decision:** three on-demand tables accessed only by key or GSI. Listing every event type or consumer reads a `METADATA#CATALOG` item written by the seed script.
**Why:** predictable cost and latency regardless of table size, and least-privilege IAM (no `Scan`).
**Cost:** the catalog items must be kept in sync with the contracts; the seed script does this, and the API returns empty lists rather than guessing when they are missing.

## 6. EventBridge, gated upstream

**Decision:** ALLOWed events go to a custom EventBridge bus; BLOCK and REVIEW stop inside the API with HTTP 409 before `PutEvents`.
**Why:** consumers never see an event the gate rejected, and the bus fans out to any number of consumers without EventGate knowing their endpoints.
**Cost:** the gate only protects events published through it; a producer writing straight to the bus bypasses it.

## 7. One history record per analysis

**Decision:** an analysis is stored under its analysis ID; a publish that carries that ID updates the same record, and is rejected if the ID belongs to a different change.
**Why:** one record answers "what was checked, what was decided, and what was published", which is what an audit needs.
**Cost:** clients must pass the analysis ID to correlate; publishes without one create their own record.

## 8. Infrastructure as a SAM template

**Decision:** every AWS resource, IAM permission and route is declared in `template.yaml`.
**Why:** the stack is reviewable and reproducible with `sam deploy`.
**Cost:** CloudFormation deployments are slower than ad hoc changes, and the stack is AWS-specific.

## 9. No container images

**Decision:** local development uses a Python virtual environment and the Lambda is a zip package; there is no Dockerfile.
**Why:** fewer moving parts for a single-service project; `sam local` covers Lambda emulation when Docker is available.
**Cost:** running outside AWS Lambda (ECS, Kubernetes) would need a container image.
