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
      │   (contracts/ JSON)   │                       │   (EventContracts)    │
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

EventGate includes a comprehensive unit, integration, and conformance test suite executing 279 tests across all compatibility rules, policies, catalog endpoints, history persistence, CLI commands, and CI scripts without cloud connectivity.

### Run Backend Tests & Coverage
```powershell
cd C:\primex-eventgate\backend
..\.venv\Scripts\pytest.exe --cov=eventgate --cov-report=term-missing
```

**Results:**
* **279 passed** in ~4.8s
* **91.54% code coverage** across all domain, application, and infrastructure layers.

### Run Linter
```powershell
..\.venv\Scripts\ruff.exe check backend scripts
# Result: All checks passed!
```

---

## 5. Local Execution Path C: Frontend Developer Console

The frontend control console runs locally on `http://localhost:5173` connecting either to a local backend API or the live AWS backend.

### Setup and Start
```powershell
cd C:\primex-eventgate\frontend

# Install dependencies
npm install

# Run unit and integration tests (114 tests across 25 test files)
npm test -- --run

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

## 6. Local Execution Path D: Developer CLI (`eventgate`)

The EventGate CLI allows engineers to evaluate contracts directly from their terminal using the identical domain core:

```powershell
# Safe change
eventgate check --event OrderPlaced --current 1 --proposed 2 --env production
# Exit code: 0 (ALLOW)

# Breaking change
eventgate check --event OrderPlaced --current 1 --proposed 3 --env production
# Exit code: 1 (BLOCK)

# Risky change (with --fail-on-review)
eventgate check --event OrderPlaced --current 1 --proposed 4 --env production --fail-on-review
# Exit code: 1 (treated as block)

# Catalog & History
eventgate catalog --events
eventgate catalog --consumers
eventgate history --limit 5
```

---

## 7. Local Execution Path E: CI Contract Diff Runner

To test pull request contract validation locally:

```powershell
# Inspects contracts/ and evaluates changes against repository base versions
python scripts/ci_contract_diff.py contracts/events/order-placed/v3-breaking.json
# Exit code: 1 (BLOCK)
```

---

## 8. Local Abstractions & Infrastructure Mapping

| Component | Local Implementation (Build It) | Cloud Implementation (Ship It) |
| :--- | :--- | :--- |
| **Event Contracts** | `contracts/events/**/*.json` | DynamoDB `primex-eventgate-dev-event-contracts` |
| **Consumer Contracts**| `contracts/consumers/*.json` | DynamoDB `primex-eventgate-dev-consumer-contracts` |
| **Release History** | `contracts/history/reviews.json` | DynamoDB `primex-eventgate-dev-release-history` |
| **Event Publisher** | `LocalEventPublisher` (in-memory list) | `EventBridgePublisher` (`events:PutEvents`) |
| **Execution Engine** | `CompatibilityEngine` (Python 3.14) | `CompatibilityEngine` (Python 3.14 on Lambda) |
| **Policy Engine** | `StandardPolicyEngine` / `CedarPolicyEngine` | `StandardPolicyEngine` / `CedarPolicyEngine` |
| **Catalog Metadata** | Filesystem discovery (Zero scans) | DynamoDB indexed items (`PK=METADATA#CATALOG`) |
| **API Framework** | FastAPI (ASGI) | FastAPI via Mangum on Lambda |

---

## 9. Honest Local Limitations

1. **Broker Parity:** The local publisher records emitted events to an in-memory test list rather than maintaining a full EventBridge daemon or LocalStack container. This ensures zero heavy Docker dependencies for standard test execution.
2. **Contract Persistence:** Local execution loads JSON contracts directly from disk and writes audit history to `contracts/history/reviews.json`. It does not perform DynamoDB replication or transactional rollbacks.
3. **Consumer Verification:** In local mode, consumer impacts are calculated deterministically via rules. Consumer Lambdas are executed in CloudWatch during live cloud deployment, not locally spawned.

