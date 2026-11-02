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

## 10. Tuned values

Limits and timings that recent changes set, with the rule each one follows and where the number came from. The code, `template.yaml` and the other docs state the same values; change them together.

| Value | Set in | Rule | Source |
| --- | --- | --- | --- |
| 20 req/s, burst 40 | `template.yaml` (`DefaultRouteSettings`) | API Gateway default route throttling for the public, unauthenticated API | Decision (commit 90cf929). Not load-tested against API Gateway. |
| History list `limit` 1–200, default 50 | `backend/src/eventgate/api/routes/history.py` | Newest first; out-of-range values return 422 | Decision (commit cf81336). |
| CLI `history --limit` default 20 | `backend/src/eventgate/cli/main.py` | Records printed by `eventgate history` | Decision. |
| Console loads 100 records | `frontend/src/services/api.ts` (`listHistory`) | The History page works on the newest 100 | Decision (commit 6a4a71a). |
| History shows 25 at a time | `frontend/src/components/history/ReleaseHistoryView.tsx` (`PAGE_SIZE`) | First render and each "Show more" add 25 rows | Decision made with the mobile History fix (commit cf7e290). That fix's measured gain (Lighthouse mobile LCP 3.9 s to 0.8 s) came from bundling pages eagerly, not from the page size. |
| Health check every 60 s | `frontend/src/services/queries.ts` (`useHealth`) | Each open console polls `/health` once a minute | Decision (commit 6a4a71a). |
| `X-Request-ID` up to 128 characters | `backend/src/eventgate/api/request_id.py` | Characters other than letters, digits, `-` and `_` are removed, then the ID is cut to 128; a UUID is used when nothing is left | Decision (commit a824cbb). |
| JSON history store: cached parse, compact write | `backend/src/eventgate/infrastructure/repositories/release_review_repository.py` | Parsed records are reused while the file's mtime and size are unchanged; the file is written as one compact string | Locust measurement (commit 026c35d), 20 users for 60 s against local uvicorn: p50 900 to 95 ms, p95 2300 to 310 ms, 12.5 to 26.6 req/s, 0 errors. Applies to local storage only; the deployed API uses DynamoDB. |
| Coverage gates: backend 85% lines; frontend 80% lines and statements, 75% functions, 70% branches | `pyproject.toml`, `frontend/vite.config.ts` | `pytest --cov` and `vitest --coverage` fail below these | Decision (backend: commit 5297203; frontend: commit 7e56d7d, when frontend line coverage was 93%). Current coverage is in [TESTING.md](TESTING.md). |

