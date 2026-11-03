# Testing

`python scripts/check.py` runs everything CI runs: lint, type checks, both unit and integration suites with coverage, the production build, the backend HTTP end-to-end suite and the Playwright suite. Run it from the project's virtual environment. `--skip-e2e` leaves out the two end-to-end suites (no Docker or browser needed); `--only backend|frontend|backend-e2e|e2e` runs one group.

The default `pytest` and `npm test` runs are offline: no network, no AWS, no Docker.

## Suites

| Suite | Command | CI job | Needs |
| --- | --- | --- | --- |
| Backend unit and integration (pytest) | `pytest --cov=eventgate` | `backend` (Python 3.12 and 3.14) | Nothing |
| Frontend unit and component (Vitest, Testing Library, jsdom) | `cd frontend && npm run test:coverage` | `frontend` | Nothing |
| Backend HTTP end-to-end (pytest `-m e2e`) | `python scripts/run_backend_e2e.py` | `backend-e2e` | Docker (DynamoDB Local) |
| Browser end-to-end and accessibility (Playwright, axe) | `cd frontend && npm run test:e2e` | `e2e` | Chromium (`npx playwright install chromium` once) |
| Load (Locust) | see [Manual checks](#manual-checks) | none | Nothing |

### Backend unit and integration

`backend/tests/unit` and `backend/tests/integration`. Covers the compatibility rules and change detection, both policy engines (standard and Cedar, cell by cell), the application services, payload validation, report rendering, the JSON and in-memory history stores (atomic writes, corrupt files, caching), the JSON contract repositories (malformed, mismatched and duplicate files), the DynamoDB and EventBridge adapters against moto with tables built from `template.yaml`, the Lambda handler through Mangum, the CLI, the PR contract-diff script and static checks on `template.yaml`.

Every API route is exercised through FastAPI's `TestClient`, including validation errors, the error envelope, request IDs and input limits:

| Endpoint | Tests |
| --- | --- |
| `GET /health` | `integration/test_api_contract.py`, `integration/test_analysis_api.py` |
| `GET /api/v1/contracts/events`, `/events/{eventType}` | `integration/test_contracts_api.py`, `integration/test_api_contract.py`, `integration/test_aws_adapters_moto.py` |
| `GET /api/v1/contracts/consumers`, `/consumers/{consumerId}` | `integration/test_contracts_api.py`, `integration/test_aws_adapters_moto.py` |
| `POST /api/v1/analyze` | `integration/test_analysis_api.py`, `integration/test_api_contract.py`, `integration/test_lambda_handler.py` |
| `POST /api/v1/events/publish` | `integration/test_publish_api.py`, `integration/test_e2e_platform_flows.py`, `integration/test_api_contract.py` |
| `GET /api/v1/history`, `/history/{recordId}`, `/history/{recordId}/report` | `integration/test_history_api.py`, `integration/test_api_contract.py` |
| `GET /api/v1/policies`, `/api/v1/config/runtime` | `unit/test_policies_routes.py`, `integration/test_aws_adapters_moto.py` |

The API has no authentication, so there are no auth tests.

### Frontend unit and component

`frontend/src/test`. Components, hooks, the API client and its Zod response validation, rendered with the API client mocked (`src/test/fixtures.ts`). Covers the pages' empty and error states and their retries, the Review workflow (analyze, publish, confirmation, publish failures by status), the command palette and keyboard shortcuts, report export and its failures, filters, the dependency topology and its fallback, dialogs, toasts and routing.

### Backend HTTP end-to-end

`backend/tests/e2e`, marked `e2e` and excluded from the default `pytest` run. Starts the API as a uvicorn process and talks to it over HTTP. Each test runs twice: on local JSON storage, and on DynamoDB Local with the three tables created from `template.yaml`'s key schemas and seeded by `scripts/seed_dynamodb.py`. Covers:

- health, request IDs and the CORS preflight a browser sends;
- the seeded catalog;
- a safe change analyzed, published, found in history and exported as Markdown and JSON;
- a breaking change blocked (409) and a risky change held for review in production but published in development;
- error responses: invalid payload (422), equal versions (400), unknown version, event, record and route (404), wrong method (405), unknown environment, out-of-range limit and malformed JSON (422);
- twelve concurrent analyses all recorded; history filtering, limit and newest-first order;
- history surviving a server restart;
- a publish whose event bus is unreachable: a third server uses the EventBridge publisher with every AWS endpoint on a closed local port, and the test checks the 503 and the recorded failure.

`python scripts/run_backend_e2e.py` starts `amazon/dynamodb-local:3.1.0` on a free port, runs the suite and removes the container; extra arguments go to pytest. `--no-docker` runs the local-storage half only (the DynamoDB half is then skipped). Dummy AWS credentials and an empty AWS config keep every call local.

### Browser end-to-end and accessibility

`frontend/e2e`. Playwright starts the real backend (uvicorn, local storage, in-memory publisher, a throwaway history file), a second backend whose event bus is unreachable, and the Vite dev server, then runs every test on desktop Chromium (1280x800) and a Pixel 7 profile. Every test fails if the page logs a console error or throws; a test that provokes an HTTP error allows that one message.

- Every page loads its heading without console errors.
- Review: safe change published after the production confirmation and found in History; blocked and review decisions; development warnings; payload rejected with guidance (422); invalid JSON disables analysis; report download; keyboard shortcuts and the command palette.
- Contracts to Review, consumer to event, History inspect and JSON download, a Developer tools assertion, Policies and Settings read from the API.
- Validation: Developer tools refuses equal versions; contract, consumer and history filters show their empty states and clear.
- Errors: an unreachable API on History; a failed analysis with retry; a publish rejected by the unreachable event bus, shown as "Event bus unavailable" with HTTP 503 and listed in History as "Publish failed".
- axe (WCAG 2.1 A and AA) on every page, after a blocked analysis and with a dialog open.

Two things here are simulated and are not real failures: the "unreachable API" and "failed analysis" tests abort the browser's request with `page.route`. The 503 test is real: the console's requests are redirected to the second backend, which returns the 503 itself.

## Latest results

2026-11-02, commit ec4e744 (branch `test-docs-audit`), Windows 11, Python 3.14.7, Node 26.8.2, `python scripts/check.py`:

| Suite | Passed | Failed | Skipped | Coverage |
| --- | --- | --- | --- | --- |
| Backend unit and integration | 424 | 0 | 0 | 99.84% of statements (1855, 3 missed); gate 85% |
| Frontend unit and component | 168 | 0 | 0 | lines 96.90%, statements 95.95%, functions 94.31%, branches 92.14%; gates 80/80/75/70 |
| Backend HTTP end-to-end | 45 | 0 | 0 | 22 on local storage, 22 on DynamoDB Local, 1 event bus outage |
| Browser end-to-end and axe | 59 | 0 | 3 | 31 tests on desktop, 28 on mobile; the report downloads and keyboard shortcuts run on desktop only |

ruff, ruff format, mypy, oxlint, tsc and the production build passed in the same run.

Earlier result, kept for comparison (main at 1ac10a6, same day): backend 362 passed, 96.28% of statements; frontend 154 passed, lines 93.45%, statements 92.74%, functions 89.66%, branches 91.19%; browser 37 passed, 3 skipped; no backend HTTP suite.

## Reports

`scripts/check.py` writes JUnit XML to `reports/` (`backend-junit.xml`, `frontend-junit.xml`, `backend-e2e-junit.xml`) and coverage to `reports/backend-coverage.xml` and `frontend/coverage/` (HTML and `cobertura-coverage.xml`). In CI, Playwright also writes `reports/playwright-junit.xml` and an HTML report in `frontend/playwright-report/`. Each CI job uploads these as artifacts (`backend-reports-py3.12`, `backend-reports-py3.14`, `frontend-reports`, `backend-e2e-reports`, `playwright-reports`), also when it fails. All of these paths are gitignored.

## Manual checks

These need a deployed stack, real AWS services or a person. Run the AWS ones against your own dev stack only, never a shared deployment.

1. **Deployed API.** After `sam deploy` and `python scripts/seed_dynamodb.py --region ap-south-1`, run `python scripts/aws_smoke_test.py <ApiUrl>`. Expect `/health` ok and the three sample analyses ALLOW, BLOCK and REVIEW. Writes three history records.
2. **EventBridge delivery to consumers.** `python scripts/aws_enforcement_smoke_test.py <ApiUrl> --stack-name primex-eventgate-dev --region ap-south-1`. Publishes one real event; expect the ALLOWed event in all three consumer Lambdas' CloudWatch logs, 409 and no delivery for the blocked and held changes, and 422 for the invalid payload.
3. **API Gateway throttling (20 req/s, burst 40).** Send a burst of health checks, for example `seq 1 200 | xargs -P 50 -I{} curl -s -o /dev/null -w "%{http_code}\n" <ApiUrl>/health | sort | uniq -c`. Expect some `429` responses. Reads only.
4. **Cedar on Lambda.** In the Lambda console, add `EVENTGATE_POLICY_ENGINE=cedar` to the API function's environment variables (keep the others). `GET <ApiUrl>/api/v1/policies` should return `"activeEngine": "cedar"` and `"cedarPolicyAvailable": true`, and `python scripts/aws_smoke_test.py <ApiUrl>` should still pass. Remove the variable afterwards.
5. **Amplify hosting.** `curl -sI <AmplifyUrl> | grep -iE "x-frame-options|x-content-type-options|referrer-policy"` should show the three headers from `customHttp.yml`. Open the console, analyze the safe sample and check that it appears in History.
6. **Mobile performance.** `cd frontend && npm run build && npx vite preview --port 4173`, then run Lighthouse (Chrome DevTools, Mobile, Performance) on `http://localhost:4173/#/history`. The last recorded History LCP was 0.8 s (commit cf7e290).
7. **Load.** Start `uvicorn eventgate.main:app --port 8000` and run `locust -f perf/locustfile.py --host http://127.0.0.1:8000 --headless -u 20 -r 5 -t 60s`. Compare with the figures in [decisions.md](decisions.md#10-tuned-values) (26.6 req/s, p95 310 ms, 0 errors at commit 026c35d).

## Not covered by automated tests

- Real AWS behaviour: EventBridge delivery and the consumer Lambdas (their handler is unit-tested), IAM permissions, the deployed API Gateway routes, CORS and throttling, CloudWatch logs and Amplify hosting. See manual checks 1 to 5.
- The Cedar engine inside the Lambda package (the engine itself is unit-tested).
- Performance of the deployed API; the Locust figures are for local JSON storage.
- Browsers other than Chromium, and screen readers beyond the axe rules.
- The console's 400 "Publish request rejected" and 409 "Publication prevented" messages are covered by component tests only; normal use of the console cannot produce them.
