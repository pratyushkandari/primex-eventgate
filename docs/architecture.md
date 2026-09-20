# EventGate Platform Architecture Specification

## 1. Architectural Philosophy

EventGate is designed according to **Clean Architecture / Ports & Adapters (Hexagonal)** principles:

1. **Pure Domain Core:** The domain layer contains zero third-party dependencies. It does not import FastAPI, Pydantic, AWS SDKs, or database drivers.
2. **Ports as Abstract Interfaces:** Persistence, cloud publishing, and policy evaluation are abstracted behind interface contracts (`IEventContractRepository`, `IConsumerContractRepository`, `IReleaseReviewRepository`, `IEventPublisher`, `IPolicyEngine`).
3. **Decoupled Architectural Decision Model:**
   * **Compatibility Analysis:** Deterministically evaluates the technical impact on consumers: `(CurrentContract, ProposedContract, ConsumerContract) -> list[Finding]`. Produces `SAFE | RISK | BREAK` and `LOW | MEDIUM | HIGH` severity.
   * **Release Policy:** Evaluates the technical compatibility outcome within an operational environment context (`production`, `staging`, `development`). Produces `ALLOW | REVIEW | BLOCK`.
4. **Deterministic State & Zero Fake Telemetry:** Given identical inputs, EventGate will always output identical findings and policy decisions. Initial audit history is empty (`reviews.json = []`), and settings reflect actual runtime configuration.
5. **Boundary Isolation:** Pydantic is utilized strictly at the API presentation boundary for HTTP schema validation and serialization.

---

## 2. Layered Component Architecture

```text
               +----------------------------------+
               |   HTTP Client / CLI / CI / Web   |
               +----------------------------------+
                                |  (HTTP / Command)
                                v
               +----------------------------------+
               |            API Layer             |
               | - FastAPI Routers (analyze,      |
               |   publish, catalog, history,     |
               |   policies, config)              |
               | - Pydantic Request/Response DTOs |
               | - Structured Error Middleware    |
               +----------------------------------+
                                |
                                v
               +----------------------------------+
               |        Application Layer         |
               | - EventAnalysisService           |
               | - GatedEventPublishService       |
               | - ContractCatalogService         |
               | - ReleaseHistoryService          |
               | - ReportExportService            |
               +----------------------------------+
                     /          |           \
                    /           |            \
                   v            v             v
    +--------------------+ +-------------+ +--------------------+
    | Infrastructure     | | Policy      | | Domain Layer       |
    | (Adapters)         | | Engines     | | (Pure Core)        |
    | - JsonEventRepo    | | - Standard  | | - Frozen Entities  |
    | - JsonConsumerRepo | |   Policy    | | - Compatibility    |
    | - JsonReviewRepo   | | - Cedar     | |   Engine (EVT001-8)|
    | - DynamoDB Repos   | |   Policy    | | - Policy Matrix    |
    | - EventBridge /    | |   Engine    | | - Correlation      |
    |   Local Publisher  | |             | |   Entities         |
    +--------------------+ +-------------+ +--------------------+
```

---

## 3. End-to-End Request & Release Correlation Flow

A single release workflow produces a single correlated audit record.

```text
[Client / CLI / Web]
   │
   ├─► 1. POST /api/v1/analyze { eventType, currentVersion, proposedVersion, environment="production" }
   │
[API Router (eventgate.api.routes.analysis)]
   │
   ├─► 2. Validates JSON payload using Pydantic DTO (AnalysisRequestSchema)
   ├─► 3. Extracts or generates correlation analysisId (UUID)
   ├─► 4. Calls EventAnalysisService.analyze(event_type, current, proposed, environment, request_id, analysis_id)
   │
[Application Service (eventgate.application.services.event_analysis_service)]
   │
   ├─► 5. Loads current and proposed contracts from IEventContractRepository
   ├─► 6. Loads downstream consumers from IConsumerContractRepository
   ├─► 7. Computes schema diff ChangeSet (added, removed, typeChanges, requirednessChanges)
   ├─► 8. CompatibilityEngine.evaluate(...) -> deterministic findings (SAFE | RISK | BREAK)
   ├─► 9. IPolicyEngine.evaluate_release(compatibility_result, severity, environment) -> PolicyEvaluationResult
   ├─► 10. Persists initial ReleaseRecord in IReleaseReviewRepository:
   │          record_id = analysis_id
   │          status = EVALUATED, published = false
   │
[Client / CLI / Web]
   │
   ├─► 11. POST /api/v1/events/publish { eventType, currentVersion, proposedVersion, environment, payload, analysisId }
   │
[Application Service (eventgate.application.services.gated_publish_service)]
   │
   ├─► 12. Validates payload against proposed version contract (HTTP 422 if invalid)
   ├─► 13. Evaluates compatibility & policy (ALLOW | REVIEW | BLOCK)
   ├─► 14. If ALLOW:
   │          Calls IEventPublisher.publish(...) -> returns eventId and eventBridgeEventId
   │          Updates existing ReleaseRecord(record_id=analysisId):
   │             published = true, event_id = ..., event_bridge_event_id = ..., published_at = ...
   │       If BLOCK or REVIEW:
   │          Prevents publication (PutEvents NOT called)
   │          Updates existing ReleaseRecord(record_id=analysisId):
   │             attempted_publish = true, published = false, reason = ...
   │          Returns HTTP 409 Conflict with violation diagnosis
```

---

## 4. Layer Responsibilities

### Presentation Layer (`eventgate.api`)
- Exposes ASGI endpoints using FastAPI.
- Validates request payloads and maps domain exceptions to stable structured error response envelopes.
- Injects dependencies via `eventgate.api.dependencies`.
- Exposes:
  - `/health`: Service health probe.
  - `/api/v1/analyze`: Advisory compatibility analysis.
  - `/api/v1/events/publish`: Gated publication.
  - `/api/v1/contracts/events` & `/api/v1/contracts/consumers`: Contract and consumer catalog.
  - `/api/v1/history`, `/api/v1/history/{record_id}`, & `/api/v1/history/{record_id}/report`: Persistent audit trail & reports.
  - `/api/v1/policies`: Active policy engine status, 3x3 matrix, and Cedar source.
  - `/api/v1/config/runtime`: Authoritative runtime configuration.

### Application Layer (`eventgate.application`)
- `EventAnalysisService`: Coordinates contract retrieval, change set diffing, compatibility evaluation, policy evaluation, and initial audit record creation.
- `GatedEventPublishService`: Validates event payload syntax/schema, enforces release policy, calls the event publisher on `ALLOW`, and updates the correlated release record.
- `ContractCatalogService`: Serves event catalog summaries, version details, consumer catalogs, and consumer drill-downs.
- `ReleaseHistoryService`: Manages audit trail persistence and retrieval.
- `ReportExportService`: Formats release records into deterministic Markdown and JSON compliance reports.

### Domain Layer (`eventgate.domain`)
- Plain frozen Python dataclasses (`EventContract`, `ConsumerContract`, `ChangeSet`, `Finding`, `AnalysisResult`, `ReleaseRecord`, `PolicyEvaluationResult`).
- Compatibility matrix and rule evaluation (`CompatibilityEngine`, rules `EVT001` through `EVT008`).
- Decoupled release policy abstraction (`IPolicyEngine`).
- Authoritative environment release policy matrix (`production`, `staging`, `development`).

### Infrastructure Layer (`eventgate.infrastructure`)
- Repository interfaces and implementations:
  - `IEventContractRepository`: Local JSON & DynamoDB implementations (`list_event_types`, `get_event_versions`, `get_contract`).
  - `IConsumerContractRepository`: Local JSON & DynamoDB implementations (`list_all_consumers`, `get_consumers_for_event`, `get_consumer`).
  - `IReleaseReviewRepository`: In-memory implementation (`InMemoryReleaseReviewRepository` for isolated, zero-side-effect test and local CLI verification), local JSON (`JsonReleaseReviewRepository`, targeting `contracts/history/reviews.json` or custom path via `EVENTGATE_HISTORY_FILE`), and DynamoDB (`DynamoReleaseReviewRepository` targeting `primex-eventgate-${Environment}-release-history`).
- Cloud & Local Publishers:
  - `EventBridgePublisher`: AWS SDK `boto3` calls to `events:PutEvents`.
  - `LocalEventPublisher`: In-memory thread-safe event sink for zero-credential local execution.
- Policy Engines:
  - `StandardPolicyEngine`: Pure deterministic implementation of the release policy matrix.
  - `CedarPolicyEngine`: Evaluates Amazon Cedar policy files (`contracts/policies/release_policy.cedar`); raises explicit `ConfigurationError` on misconfiguration without silent fallbacks.

---

## 5. DynamoDB Zero-Scan Access Patterns

To guarantee predictable latency and cost efficiency, EventGate executes **zero DynamoDB table scans** across all catalog and history operations:

### Event Contracts Table (`primex-eventgate-dev-event-contracts`)
| Access Pattern | Operation | Key Condition |
| :--- | :--- | :--- |
| **Get Event Contract** | `GetItem` | `PK = eventType`, `SK = version` |
| **Get All Versions of Event**| `Query` | `PK = eventType` |
| **List All Event Types** | `GetItem` | `PK = METADATA#CATALOG`, `SK = EVENTS` |

### Consumer Contracts Table (`primex-eventgate-dev-consumer-contracts`)
| Access Pattern | Operation | Key Condition |
| :--- | :--- | :--- |
| **Get Consumer by ID** | `GetItem` | `PK = consumerId` |
| **Get Consumers for Event**| `Query` (on `EventTypeIndex`) | `GSI PK = eventType` |
| **List All Consumers** | `GetItem` | `PK = METADATA#CATALOG`, `SK = CONSUMERS` |

### Release History Table (`primex-eventgate-${Environment}-release-history`)
| Access Pattern | Operation | Key Condition |
| :--- | :--- | :--- |
| **Save / Update Review** | `PutItem` | `PK = recordId` |
| **Get Review by ID** | `GetItem` | `PK = recordId` |
| **List Reviews by Event** | `Query` (on `EventTypeIndex`) | `GSI PK = eventType`, `SK <= timestamp` |

