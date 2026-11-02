# Architecture

EventGate is one Python package (`backend/src/eventgate`) behind two entry points, the FastAPI app and the `eventgate` CLI, plus a React console in `frontend/`. The package follows a ports-and-adapters layout so the same code runs locally on JSON files and on AWS with DynamoDB and EventBridge.

## Layers

| Layer | Package | Responsibility |
| --- | --- | --- |
| Domain | `eventgate.domain` | Contract models, diffing (`changes.py`), per-consumer rules (`compatibility.py`), verdict aggregation (`decision.py`), release policy (`policy.py`), payload validation, history records and report rendering. No I/O except reading the packaged Cedar file. |
| Application | `eventgate.application` | Use cases: `EventAnalysisService`, `EventPublishService`, `ReleaseHistoryService`, `ContractCatalogService`. Ports (`ports/`) define the repository and publisher interfaces they depend on. |
| Infrastructure | `eventgate.infrastructure` | Adapters: JSON and DynamoDB repositories, the local in-memory publisher and the EventBridge publisher, and shared contract parsing. |
| API | `eventgate.api`, `eventgate.main` | FastAPI routes, request ID middleware, error envelope, and `dependencies.py`, which builds adapters from environment variables. |
| CLI | `eventgate.cli` | `check`, `test`, `catalog`, `history` commands over the same services. |

`lambda_handler.py` wraps the FastAPI app with Mangum for API Gateway HTTP API (payload format 2.0).

## Data flow

### Analyze (`POST /api/v1/analyze`)

1. `EventAnalysisService.analyze` validates the input (non-empty event type, positive and different versions, a known environment).
2. It loads both contract versions and every consumer subscribed to the event type.
3. `compute_change_set` lists added, removed, retyped and requiredness-changed fields.
4. `CompatibilityEngine.evaluate` produces findings per consumer. Only fields the consumer declares can produce RISK or BREAK; when several rules hit the same field, the one with the lowest precedence number wins. A consumer with no relevant change gets one SAFE finding (EVT005 if optional fields were added, otherwise EVT008).
5. `aggregate_decision` turns the findings into SAFE/RISK/BREAK with LOW/MEDIUM/HIGH severity. No findings (no consumers) is RISK/MEDIUM.
6. The policy engine maps verdict and environment to ALLOW, REVIEW or BLOCK, with a reason and any warnings.
7. The route records the result as a release record whose `record_id` is the analysis ID (best effort: a history failure is logged and the analysis is still returned).

### Publish (`POST /api/v1/events/publish`)

1. The payload is validated against the proposed contract: required fields present, top-level JSON types match (booleans are never accepted as numbers). Failure is HTTP 422.
2. If the request carries an `analysisId`, the stored record must describe the same event, versions and environment; otherwise HTTP 400 and nothing is published.
3. The analysis runs again, so the decision enforced is the one at publish time.
4. On ALLOW the publisher sends the event; otherwise the response is HTTP 409 with `published: false`.
5. The attempt is written to history, on the analysis record when one was given. A transport failure is recorded with its error before the API returns HTTP 503.

## Compatibility rules

| Precedence | Rule | Result | Fires when, for a consumer |
| --- | --- | --- | --- |
| 1 | `EVT001_FIELD_TYPE_CHANGED` | BREAK | a declared field's proposed type is not one the consumer accepts (only exact matches and `integer` for a `number` field are accepted) |
| 2 | `EVT003_CONSUMER_REQUIRED_FIELD_MISSING` | BREAK | a field the consumer requires is not in the proposed contract |
| 3 | `EVT004_REQUIREDNESS_CHANGED` | BREAK | a declared field changes between required and optional, in either direction |
| 4 | `EVT006_OPTIONAL_FIELD_REMOVED` | RISK | a field the consumer declares as optional is removed |
| 5 | `EVT005_OPTIONAL_FIELD_ADDED` | SAFE | no relevant change, and optional fields were added |
| 6 | `EVT008_CONSUMER_UNAFFECTED` | SAFE | no relevant change |

EVT004 treats optional → required as BREAK even though it guarantees more to readers: the rule flags any change in a declared field's contract for an explicit decision rather than guessing which direction is safe.

## Release policy

| Environment | SAFE (LOW) | RISK (MEDIUM) | BREAK (HIGH) |
| --- | --- | --- | --- |
| production | ALLOW | REVIEW | BLOCK |
| staging | ALLOW | REVIEW | BLOCK |
| development | ALLOW | ALLOW with a warning | BLOCK |

`StandardReleasePolicyEngine` implements the matrix in Python and is the default. `CedarReleasePolicyEngine` evaluates `eventgate/policies/release_policy.cedar` with cedarpy: two `forbid` rules (any HIGH; MEDIUM in production or staging) and two `permit` rules (LOW; MEDIUM in development). A Cedar deny maps to BLOCK for HIGH and REVIEW otherwise. Tests check that both engines agree for every cell. `GET /api/v1/policies` derives its matrix from the standard engine, so the published table cannot drift from the enforced one.

## Storage

### Local (default)

- Event contracts: `contracts/events/{kebab-case-event}/v{N}.json` (a suffix such as `v2-safe.json` is allowed; the file's `version` must match).
- Consumer contracts: `contracts/consumers/{consumer-id}.json`, one event type per consumer.
- Release history: one JSON array in `.eventgate/history.json`. A process-wide lock serializes writes, each write goes to a temporary file that replaces the original, the parsed list is cached while the file's mtime and size are unchanged, and a corrupt file raises instead of being overwritten.

### DynamoDB

| Table | Key | Index | Notes |
| --- | --- | --- | --- |
| `…-event-contracts` | `eventType` (S) + `version` (N) | – | `eventType="METADATA#CATALOG", version=0` holds the list of event types |
| `…-consumer-contracts` | `consumerId` (S) | `EventTypeIndex`: `eventType` + `consumerId` | `consumerId="METADATA#CATALOG"` holds the list of consumer IDs and has no `eventType`, so it stays out of the index |
| `…-release-history` | `recordId` (S) | `EventTypeIndex`: `eventType` + `timestamp` | Unfiltered listing queries the index once per event type from the catalog |

Every access is a GetItem or a Query; nothing scans. The catalog items are written by `scripts/seed_dynamodb.py`; if they are missing the API returns empty lists and logs a warning instead of guessing.

## Event bus

On ALLOW, `EventBridgeEventPublisher` calls `PutEvents` on the custom bus with `Source: primex.eventgate`, `DetailType: EventGateEvent` and this detail:

```json
{"eventId": "…", "eventType": "OrderPlaced", "version": 2, "decision": "ALLOW",
 "analysisId": "…", "requestId": "…", "payload": {"orderId": "…"}}
```

The rule `…-order-placed-rule` matches `detail.eventType = OrderPlaced` and targets three demo Lambdas (`consumers/src/consumer_handler.py`) that log the delivery with their `CONSUMER_ID`. A failed entry or missing `EventId` raises `EventPublishFailedError` (HTTP 503). Locally, `LocalEventPublisher` keeps events in memory and returns a `local-eb-…` ID.

## Requests and errors

Middleware assigns every request an ID (the caller's `X-Request-ID` with every character other than letters, digits, `-` and `_` removed and cut to 128 characters; a UUID when no header was sent or nothing is left) and returns it in the `X-Request-ID` header. Domain errors, validation errors, unknown routes and unexpected exceptions all return:

```json
{"error": {"code": "CONTRACT_NOT_FOUND", "message": "…", "requestId": "…"}}
```

| Code | Status |
| --- | --- |
| `VALIDATION_ERROR` (with `details` per field) | 422 |
| `INVALID_EVENT_PAYLOAD` | 422 |
| `INVALID_ANALYSIS_REQUEST`, `INVALID_CONTRACT` | 400 |
| `CONTRACT_NOT_FOUND`, `UNSUPPORTED_EVENT_VERSION`, `RELEASE_RECORD_NOT_FOUND`, `NOT_FOUND` | 404 |
| `METHOD_NOT_ALLOWED` | 405 |
| `EVENT_PUBLISH_FAILED` | 503 |
| `CONFIGURATION_ERROR`, `INTERNAL_ERROR` | 500 |

## Console

The React app (`frontend/src`) is organised by page: `workspace/` (Review), `contracts/`, `history/`, `devtools/`, `policies/`, `settings/`, with shared primitives in `components/ui` and design tokens in `index.css`. Pages are selected by the URL hash (`#/history`). Review state lives in `useReviewSession`, owned by the app shell, so it survives navigation; read-only server state goes through TanStack Query hooks in `services/queries.ts`, and every API response is validated with Zod (`schemas/api.ts`). The dependency graph (`@xyflow/react`) is the only lazily loaded module.
