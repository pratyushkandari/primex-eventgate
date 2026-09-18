# PrimeX EventGate — Build It Track: Local Execution & Parity Guide

## 1. Overview & Architecture Parity

The **Build It** track evaluates technical execution, developer ergonomics, portability, and clean local reproducibility. PrimeX EventGate was designed from the beginning around **dependency inversion**: the exact same core domain logic powers both the live AWS cloud deployment and local developer execution.

```text
               ┌────────────────────────────────────────────────────────┐
               │         SAME CORE ENGINE (Deterministic Core)          │
               │  • CompatibilityEngine                                 │
               │  • Rules EVT001 through EVT008                         │
               │  • DecisionPolicy (ALLOW / BLOCK / REVIEW)             │
               │  • PayloadValidator (JSON Schema / field types)        │
               └──────────────────────────┬─────────────────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
      ┌───────────────────────┐                       ┌───────────────────────┐
      │   LOCAL MODE          │                       │   PRODUCTION MODE     │
      │   (Build It Track)    │                       │   (Ship It Track)     │
      ├───────────────────────┤                       ├───────────────────────┤
      │ • Local Filesystem    │                       │ • Amazon DynamoDB     │
      │   (contracts/ YAML)   │                       │   (EventContracts)    │
      │ • LocalEventPublisher │                       │ • Amazon EventBridge  │
      │   (In-memory sink)    │                       │   (primex-eventgate-  │
      │ • SAM Local / FastAPI │                       │    dev-bus)           │
      │ • Zero AWS Account    │                       │ • API Gateway +       │
      │ • Zero AWS Credentials│                       │   Lambda (ap-south-1) │
      └───────────────────────┘                       └───────────────────────┘
```

---

## 2. Zero-Credential Local Prerequisites

No AWS account, IAM user, or cloud credentials are required to run, test, and verify EventGate locally.

* **Python:** 3.14+ (or 3.12+)
* **Node.js:** 20+
* **Package Managers:** `pip`, `npm`
* **Optional (for SAM Local container emulation):** AWS SAM CLI 1.166+, Docker 24+

---

## 3. Local Execution Path A: Direct Python Domain Runner

The fastest way to verify EventGate's deterministic decision engine locally is through `scripts/local_demo.py`. It initializes the domain repositories from `contracts/` and runs all golden scenarios using `LocalEventPublisher`.

### Running the Local Demo
```powershell
# From the repository root (with virtual environment active):
.\.venv\Scripts\python.exe scripts\local_demo.py
```

### Expected Output & Scenario Verification

#### Scenario A: Safe Change (v1 $\to$ v2)
* **Change:** Adds optional `metadata` object.
* **Aggregate Decision:** `ALLOW` (Severity: `LOW`)
* **Impact:** `billing-service` (SAFE), `inventory-service` (SAFE), `analytics-service` (SAFE).
* **Publisher Behavior:** Event is accepted by `LocalEventPublisher` and recorded in the local publication sink.

#### Scenario B: Breaking Change (v1 $\to$ v3)
* **Change:** `shippingMethod` changed from `string` to `object`.
* **Aggregate Decision:** `BLOCK` (Severity: `HIGH`)
* **Impact:** `inventory-service` (BREAK — rule `EVT001_FIELD_TYPE_CHANGED`).
* **Publisher Behavior:** Publication is prevented before broker ingress. Publication sink remains empty.

#### Scenario C: Risky Removal (v1 $\to$ v4)
* **Change:** Optional `couponCode` removed from contract.
* **Aggregate Decision:** `REVIEW` (Severity: `MEDIUM`)
* **Impact:** `analytics-service` (RISK — rule `EVT006_OPTIONAL_FIELD_REMOVED`).
* **Publisher Behavior:** Publication is prevented pending review. Publication sink remains empty.

---

## 4. Local Execution Path B: Backend FastAPI & Pytest Suite

EventGate includes a comprehensive unit and integration test suite executing 190 tests across all compatibility rules and API endpoints without cloud connectivity.

### Run Backend Tests & Coverage
```powershell
cd C:\primex-eventgate\backend
..\.venv\Scripts\pytest.exe --cov=eventgate --cov-report=term-missing
```

**Results:**
* **190 passed** in ~5.5s
* **94.08% code coverage** across all domain, application, and infrastructure layers.

### Run Linter
```powershell
..\.venv\Scripts\ruff.exe check .
# Result: All checks passed!
```

---

## 5. Local Execution Path C: Frontend Developer Console

The frontend control console can run locally on `http://localhost:5173` connecting either to a local backend API or the live AWS backend.

### Setup and Start
```powershell
cd C:\primex-eventgate\frontend

# Install dependencies
npm install

# Run unit and integration tests (57 tests)
npm test

# Run linter
npm run lint

# Build production bundle
npm run build

# Start local development server
npm run dev
```

### Environment Variable Override
To point the local frontend to a local backend instance, set in `frontend/.env.local`:
```bash
VITE_EVENTGATE_API_URL=http://127.0.0.1:8000
VITE_AWS_REGION=local
```

---

## 6. Local Execution Path D: AWS SAM Local API

For full containerized parity mimicking AWS API Gateway and Lambda execution:

```powershell
# Build SAM artifacts
sam build

# Start local HTTP API emulating API Gateway on port 3001
sam local start-api --port 3001
```

Then send test requests without AWS credentials:
```powershell
# Health check
curl http://localhost:3001/health

# Advisory compatibility check
curl -X POST http://localhost:3001/api/v1/analyze `
  -H "Content-Type: application/json" `
  -d '{"eventType": "OrderPlaced", "currentVersion": 1, "proposedVersion": 2}'
```

---

## 7. Local Abstractions & Infrastructure Mapping

| Component | Local Implementation (Build It) | Cloud Implementation (Ship It) |
| :--- | :--- | :--- |
| **Event Contracts** | `contracts/events/*.yaml` | DynamoDB `primex-eventgate-dev-event-contracts` |
| **Consumer Contracts**| `contracts/consumers/*.yaml` | DynamoDB `primex-eventgate-dev-consumer-contracts` |
| **Event Publisher** | `LocalEventPublisher` (in-memory list) | `EventBridgePublisher` (`events:PutEvents`) |
| **Execution Engine** | `CompatibilityEngine` (Python 3.14) | `CompatibilityEngine` (Python 3.14 on Lambda) |
| **Rules Evaluated** | `EVT001` through `EVT008` (identical) | `EVT001` through `EVT008` (identical) |
| **API Framework** | FastAPI (ASGI) | FastAPI via Mangum on Lambda |

---

## 8. Honest Local Limitations

1. **Broker Parity:** The local publisher records emitted events to an in-memory test list rather than maintaining a full EventBridge daemon or LocalStack container. This ensures zero heavy Docker dependencies for standard test execution.
2. **Contract Persistence:** Local execution loads YAML contracts directly from disk. It does not perform DynamoDB replication or transactional rollbacks.
3. **Consumer Verification:** In local mode, consumer impacts are calculated deterministically via rules. Consumer Lambdas are executed in CloudWatch during live cloud deployment, not locally spawned.
