# EventGate Architecture Specification (Phase 1)

## 1. Architectural Philosophy

EventGate is designed according to **Clean Architecture / Ports & Adapters (Hexagonal)** principles:

1. **Pure Domain Core:** The domain layer contains zero third-party dependencies. It does not import FastAPI, Pydantic, AWS SDKs, or database drivers.
2. **Ports as Abstract Interfaces:** Persistence is abstracted behind interface contracts (`IEventContractRepository`, `IConsumerContractRepository`).
3. **Deterministic State Evaluation:** The rules engine is a pure mathematical function: `(CurrentContract, ProposedContract, ConsumerContract) -> list[Finding]`. Given identical inputs, it will always output identical findings.
4. **Boundary Isolation:** Pydantic is utilized strictly at the API presentation boundary for HTTP schema validation and serialization.

---

## 2. Layered Component Architecture

```text
               +----------------------------------+
               |        HTTP Client / CI/CD       |
               +----------------------------------+
                                |  (HTTP Request)
                                v
               +----------------------------------+
               |            API Layer             |
               | - FastAPI Routers (analysis)     |
               | - Pydantic Request/Response DTOs |
               | - Structured Error Middleware    |
               +----------------------------------+
                                |
                                v
               +----------------------------------+
               |        Application Layer         |
               | - EventAnalysisService           |
               | - Request Orchestration          |
               | - Audit Logging                  |
               +----------------------------------+
                     /                      \
                    /                        \
                   v                          v
   +------------------------------+   +-----------------------------+
   |     Infrastructure Layer     |   |        Domain Layer         |
   | (Adapters / Persistence)     |   | (Pure Python Core)          |
   | - JsonEventContractRepo      |   | - Frozen Dataclass Models   |
   | - JsonConsumerContractRepo   |   | - ChangeSet Differ          |
   | - Local File Persistence     |   | - CompatibilityEngine       |
   | (Phase 2: DynamoDB Repos)    |   | - Aggregate Decision Policy |
   +------------------------------+   +-----------------------------+
```

---

## 3. Detailed Request Flow

When an analysis request is executed via `POST /api/v1/analyze`:

```text
[Client]
   │
   ├─► 1. POST /api/v1/analyze { eventType, currentVersion, proposedVersion }
   │      Headers: X-Request-ID (optional)
   │
[API Router (eventgate.api.routes.analysis)]
   │
   ├─► 2. Validates JSON payload using Pydantic DTO (AnalysisRequestSchema)
   ├─► 3. Extracts or generates correlation requestId
   ├─► 4. Calls EventAnalysisService.analyze(event_type, current, proposed, request_id)
   │
[Application Service (eventgate.application.services.event_analysis_service)]
   │
   ├─► 5. Loads EventContract(version=current) from IEventContractRepository
   ├─► 6. Loads EventContract(version=proposed) from IEventContractRepository
   ├─► 7. Loads list[ConsumerContract] from IConsumerContractRepository
   ├─► 8. Computes ChangeSet via domain.changes.compute_change_set(current, proposed)
   │
   ├─► 9. For each ConsumerContract:
   │         Findings = CompatibilityEngine.evaluate(current, proposed, consumer)
   │
   ├─► 10. Aggregates findings:
   │          (decision, severity) = aggregate_decision(all_findings)
   │          summary = generate_summary(decision, all_findings)
   │
   ├─► 11. Constructs and returns AnalysisResult entity (frozen dataclass)
   │
[API Router]
   │
   └─► 12. Serializes AnalysisResult to camelCase JSON (AnalysisResponseSchema)
           Returns 200 OK
```

---

## 4. Layer Responsibilities

### Presentation Layer (`eventgate.api`)
- Exposes ASGI endpoints using FastAPI.
- Validates request payloads and maps domain exceptions to stable structured error response envelopes.
- Injects dependencies via `eventgate.api.dependencies`.

### Application Layer (`eventgate.application`)
- Contains `EventAnalysisService`.
- Coordinates retrieval of domain entities across repositories.
- Emits structured operational logs for observability.
- Constructs in-memory `AnalysisResult` without persisting to database (local in-memory computation in Phase 1).

### Domain Layer (`eventgate.domain`)
- Plain frozen Python dataclasses (`EventContract`, `ConsumerContract`, `ChangeSet`, `Finding`, `AnalysisResult`).
- Compatibility matrix and rule evaluation (`CompatibilityEngine`).
- Explicit rule precedence and finding deduplication.
- Three-tier aggregate decision policy (`Decision.ALLOW`, `Decision.REVIEW`, `Decision.BLOCK`).

### Infrastructure Layer (`eventgate.infrastructure`)
- Concrete file-based repository adapters (`JsonEventContractRepository`, `JsonConsumerContractRepository`).
- Reads versioned schema definitions from local `contracts/` directory structure.
- Encapsulates filesystem details; completely replaceable by database adapters in subsequent phases.
