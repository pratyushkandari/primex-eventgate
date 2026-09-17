# PrimeX EventGate

**Consumer-Aware Safety Gate for Event-Driven Systems**

EventGate intercepts schema changes in event-driven architectures and deterministically predicts consumer impact before deployment or event publishing. Instead of relying solely on producer schema validation, EventGate evaluates proposed schema transitions against active downstream consumer contracts.

---

## Key Features (Phase 1)

- **Pure Domain Engine**: Pure Python dataclasses with zero framework or database dependencies.
- **Deterministic Consumer Scoping**: Evaluates impact per consumer; changes to fields that a consumer does not depend upon are evaluated as `SAFE`.
- **Three-Tier Aggregate Decision Policy**:
  - `ALLOW` (Low Severity): All active consumers are `SAFE`.
  - `REVIEW` (Medium Severity): One or more consumers experience `RISK` (e.g., removal of optional fields they consume, or zero registered consumers).
  - `BLOCK` (High Severity): One or more consumers experience `BREAK` (e.g., incompatible type changes, missing required fields).
- **Finding Deduplication**: Deterministic one-finding-per-consumer/field policy governed by explicit rule precedence (`EVT001` > `EVT003` > `EVT002` > `EVT004` > `EVT007` > `EVT006` > `EVT005` > `EVT008`).
- **FastAPI HTTP Interface**: Clean camelCase JSON API with stable structured error response envelopes and correlation ID tracking (`X-Request-ID`).
- **File-Based Contract Repositories**: JSON-backed contract repositories for local development, tests, and CI/CD pipelines.

---

## Architecture & Directory Structure

```text
primex-eventgate/
├── backend/
│   ├── src/
│   │   └── eventgate/
│   │       ├── api/                      # Presentation layer (FastAPI routers, DTO schemas)
│   │       │   ├── routes/               # Health and analysis endpoints
│   │       │   ├── dependencies.py       # Dependency injection
│   │       │   └── errors.py             # Stable structured error response handlers
│   │       ├── application/              # Orchestration layer
│   │       │   └── services/             # EventAnalysisService
│   │       ├── domain/                   # Pure business logic (Zero I/O dependencies)
│   │       │   ├── changes.py            # ChangeSet computation
│   │       │   ├── compatibility.py      # Field-level & Consumer-level rules engine
│   │       │   ├── decision.py           # Aggregate decision policy
│   │       │   ├── enums.py              # StrEnum status definitions
│   │       │   ├── errors.py             # Domain exception types
│   │       │   └── models.py             # Pure dataclasses
│   │       ├── infrastructure/           # Persistence & adapters
│   │       │   └── repositories/         # File-based JSON contract stores
│   │       ├── config/                   # Application settings & environment config
│   │       └── main.py                   # FastAPI ASGI entrypoint
│   └── tests/
│       ├── conftest.py                   # Shared fixtures & test builders
│       ├── unit/                         # Unit tests (models, changes, rules, decision, service)
│       └── integration/                  # End-to-end API integration tests
├── contracts/                            # Versioned event and consumer contracts
│   ├── events/order-placed/              # v1, v2-safe, v3-breaking, v4-risk
│   └── consumers/                        # billing, inventory, analytics consumer contracts
└── pyproject.toml                        # Build configuration, Ruff, Pytest & coverage settings
```

---

## Getting Started

### Prerequisites
- Python 3.12+ (or 3.14)
- Virtual environment tool (`venv`)

### Installation
```powershell
# Create and activate virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install in editable mode with development dependencies
pip install -e ".[dev]"
```

### Running Tests and Coverage
```powershell
# Run full test suite with coverage report
pytest --cov=eventgate --cov-report=term-missing
```

### Running Lint and Code Quality Checks
```powershell
# Run Ruff linting and formatting checks
ruff check .
ruff format --check .

# Verify dependency health
pip check
```

### Starting the Local Development Server
```powershell
uvicorn eventgate.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## API Documentation

### 1. Health Check
- **Endpoint**: `GET /health`
- **Response**:
```json
{
  "status": "ok",
  "service": "eventgate",
  "version": "0.1.0"
}
```

### 2. Event Analysis
- **Endpoint**: `POST /api/v1/analyze`
- **Headers**:
  - `Content-Type: application/json`
  - `X-Request-ID` *(optional)*: Correlation identifier
- **Request Body**:
```json
{
  "eventType": "OrderPlaced",
  "currentVersion": 1,
  "proposedVersion": 2
}
```
- **Response Structure (Constructed and Returned in-memory)**:
```json
{
  "analysisId": "197ada2a-5e37-4028-9c08-56af25fed6f4",
  "eventType": "OrderPlaced",
  "currentVersion": 1,
  "proposedVersion": 2,
  "changeSet": {
    "addedFields": ["metadata"],
    "removedFields": [],
    "typeChanges": [],
    "requirednessChanges": []
  },
  "findings": [
    {
      "consumerId": "analytics-service",
      "status": "SAFE",
      "ruleId": "EVT005_OPTIONAL_FIELD_ADDED",
      "field": "*",
      "expectedType": null,
      "proposedType": null,
      "severity": "LOW",
      "reason": "Analytics Service is not affected by the proposed changes."
    }
  ],
  "decision": "ALLOW",
  "severity": "LOW",
  "summary": "All registered consumers are compatible with the proposed event.",
  "timestamp": "2026-09-17T11:20:17.059823Z",
  "requestId": "d48d69ad-12c3-4ab3-b912-2ec55e3b43f3"
}
```

### 3. Structured Error Response Envelope
- **Status Codes**: 400 (Bad Request), 404 (Not Found), 422 (Unprocessable Entity), 500 (Internal Error)
```json
{
  "error": {
    "code": "CONTRACT_NOT_FOUND",
    "message": "No contracts found for event type 'NonExistent'.",
    "requestId": "45497a5a-b8fe-4016-b596-7dec72f6105e"
  }
}
```

---

## Golden Test Scenarios

EventGate ships with three golden regression scenarios tested against the `OrderPlaced` event:

1. **Scenario A (v1 → v2-safe)**:
   - Added optional `metadata` (object) field.
   - Consumers: `billing-service`, `inventory-service`, `analytics-service`.
   - Result: All consumers SAFE via **`EVT005_OPTIONAL_FIELD_ADDED`** → **`ALLOW`** (Severity: `LOW`).
2. **Scenario B (v1 → v3-breaking)**:
   - Modified `shippingMethod` from `string` to complex `object`.
   - Consumer Impact: `inventory-service` expects `string` → **`BREAK`** (**`EVT001_FIELD_TYPE_CHANGED`**).
   - Consumers: `billing-service` and `analytics-service` unaffected → **`SAFE`** (**`EVT008_CONSUMER_UNAFFECTED`**).
   - Result: At least one BREAK → **`BLOCK`** (Severity: `HIGH`).
3. **Scenario C (v1 → v4-risk)**:
   - Removed optional `couponCode` field.
   - Consumer Impact: `analytics-service` consumes `couponCode` → **`RISK`** (**`EVT006_OPTIONAL_FIELD_REMOVED`**).
   - Consumers: `billing-service` and `inventory-service` unaffected → **`SAFE`** (**`EVT008_CONSUMER_UNAFFECTED`**).
   - Result: At least one RISK, zero BREAK → **`REVIEW`** (Severity: `MEDIUM`).

---

## License

This project is licensed under the MIT License - see the [LICENSE](file:///C:/primex-eventgate/LICENSE) file for details.
