# PrimeX EventGate

**Consumer-Aware Safety Gate for Event-Driven Systems**

EventGate intercepts schema changes in event-driven architectures and deterministically predicts downstream consumer impact before deployment or event publishing. Instead of relying solely on producer schema validation, EventGate evaluates proposed schema transitions against registered downstream consumer contracts.

---

## Evolution: Phase 1 & Phase 2

- **Phase 1 (Foundation + Engine)**: Pure Python deterministic compatibility engine, ChangeSet differ, consumer contract scoping, three-tier decision policy (`ALLOW` / `REVIEW` / `BLOCK`), FastAPI local API, and JSON file-based contract repositories.
- **Phase 2 (Serverless AWS Runtime + DynamoDB Persistence)**: AWS SAM serverless infrastructure, AWS Lambda Python 3.14 runtime with Mangum ASGI adapter, Amazon API Gateway HTTP API, Amazon DynamoDB persistence (`EventContractsTable` & `ConsumerContractsTable`), dual-mode storage selection (`local` vs `dynamodb`), and zero-scan query access patterns.

> [!NOTE]
> **Boundary Notice (Phase 2):**
> Event transport (EventBridge), consumer worker Lambdas, and AI explanation features (Amazon Bedrock) are **future Phase 3 milestones** and are **NOT** implemented in Phase 2.

---

## Architecture & Directory Structure

```text
primex-eventgate/
├── backend/
│   ├── src/
│   │   ├── eventgate/
│   │   │   ├── api/                      # Presentation layer (FastAPI routers, DTO schemas)
│   │   │   │   ├── routes/               # Health and analysis endpoints
│   │   │   │   ├── dependencies.py       # Dual-storage backend dependency injection
│   │   │   │   └── errors.py             # Stable structured error response handlers
│   │   │   ├── application/              # Orchestration layer
│   │   │   │   ├── ports/                # Repository interface ports (IEventContractRepository, etc.)
│   │   │   │   └── services/             # EventAnalysisService
│   │   │   ├── domain/                   # Pure business logic (Zero I/O / Cloud-Agnostic)
│   │   │   │   ├── changes.py            # ChangeSet computation
│   │   │   │   ├── compatibility.py      # Field-level & Consumer-level rules engine
│   │   │   │   ├── decision.py           # Aggregate decision policy
│   │   │   │   ├── enums.py              # StrEnum status definitions
│   │   │   │   ├── errors.py             # Domain exception types
│   │   │   │   └── models.py             # Pure immutable dataclasses
│   │   │   ├── infrastructure/           # Persistence & adapters
│   │   │   │   └── repositories/         # Local JSON and DynamoDB repository adapters
│   │   │   ├── config/                   # Application settings & environment config
│   │   │   ├── lambda_handler.py         # Mangum ASGI adapter for AWS Lambda
│   │   │   └── main.py                   # FastAPI ASGI entrypoint
│   │   └── requirements.txt              # Lambda runtime dependencies for SAM packaging
│   └── tests/
│       ├── conftest.py                   # Shared fixtures & test builders
│       ├── unit/                         # Unit tests (models, rules, DynamoDB repos, equivalence)
│       └── integration/                  # End-to-end API and Lambda handler integration tests
├── contracts/                            # Versioned canonical contract fixtures (Seed source)
│   ├── events/order-placed/              # v1, v2-safe, v3-breaking, v4-risk
│   └── consumers/                        # billing, inventory, analytics consumer contracts
├── docs/                                 # Architecture & deployment specifications
│   ├── architecture.md                   # Phase 1 Clean Architecture guide
│   ├── aws-architecture.md               # Phase 2 AWS Serverless topology & DynamoDB model
│   └── deployment.md                     # Step-by-step AWS deployment & verification guide
├── events/                               # API Gateway HTTP API v2 sample test events
├── scripts/
│   ├── local_demo.py                     # Local demonstration of golden scenarios
│   ├── seed_dynamodb.py                  # Idempotent DynamoDB seeding script
│   └── aws_smoke_test.py                 # Live AWS API Gateway smoke test script
├── template.yaml                         # AWS SAM CloudFormation template
├── samconfig.toml                        # Non-secret SAM deployment configuration
└── pyproject.toml                        # Build configuration, Ruff, Pytest & coverage settings
```

---

## Dual Storage Modes

EventGate supports two interchangeable persistence backends via `EVENTGATE_STORAGE_BACKEND`:

| Mode | Environment Variable | Storage Backend | Description |
|---|---|---|---|
| **Local** | `EVENTGATE_STORAGE_BACKEND=local` | `contracts/*.json` | Reads contracts from local filesystem. Used for zero-cloud local development and fast CI testing. |
| **AWS / Cloud** | `EVENTGATE_STORAGE_BACKEND=dynamodb` | Amazon DynamoDB | Reads contracts from DynamoDB tables using direct `GetItem` and `Query` on GSI index. |

The application service and deterministic compatibility engine are identical across both modes.

---

## DynamoDB Data Model & Access Patterns

- **`EventContractsTable`**:
  - HASH: `eventType` (String)
  - RANGE: `version` (Number)
  - Billing: `PAY_PER_REQUEST`
  - Access: `GetItem(eventType, version)` and `Query(eventType)` (Zero Scans).
- **`ConsumerContractsTable`**:
  - HASH: `consumerId` (String)
  - GSI `EventTypeIndex`: HASH `eventType` (String), RANGE `consumerId` (String)
  - Billing: `PAY_PER_REQUEST`
  - Access: `GetItem(consumerId)` and `Query(EventTypeIndex, eventType)` (Zero Scans).

---

## Getting Started (Local Development)

### 1. Installation
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
```

### 2. Run Tests & Coverage
```powershell
pytest --cov=eventgate --cov-report=term-missing
```

### 3. Code Quality & Format Checks
```powershell
ruff check .
ruff format --check .
pip check
```

### 4. Run the Local Demonstration
```powershell
python scripts/local_demo.py
```

### 5. Run Local API Server
```powershell
uvicorn eventgate.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## AWS Deployment (Phase 2)

See [docs/deployment.md](docs/deployment.md) for complete deployment documentation.

### Prerequisites
- AWS CLI (`aws`) configured with appropriate IAM credentials (`aws sts get-caller-identity`).
- AWS SAM CLI (`sam`).
- Docker daemon running (for local container emulation).

### Quick Deployment Steps
```powershell
# 1. Validate SAM template
sam validate --lint

# 2. Build deployment package
sam build

# 3. Deploy to AWS
sam deploy

# 4. Seed DynamoDB tables with canonical contracts
python scripts/seed_dynamodb.py `
  --event-table primex-eventgate-dev-event-contracts `
  --consumer-table primex-eventgate-dev-consumer-contracts

# 5. Run smoke tests against deployed API Gateway URL
python scripts/aws_smoke_test.py https://<api-id>.execute-api.<region>.amazonaws.com
```

---

## Golden Test Scenarios

EventGate deterministically evaluates schema transitions across both local and AWS runtimes:

| Scenario | Transition | Key Change | Consumer Findings | Decision | Severity |
|---|---|---|---|---|---|
| **Scenario A** | v1 → v2 | Added optional `metadata` | All consumers SAFE (`EVT005`) | **`ALLOW`** | `LOW` |
| **Scenario B** | v1 → v3 | `shippingMethod` changed to `object` | `inventory-service` BREAK (`EVT001`), others SAFE (`EVT008`) | **`BLOCK`** | `HIGH` |
| **Scenario C** | v1 → v4 | Removed optional `couponCode` | `analytics-service` RISK (`EVT006`), others SAFE (`EVT008`) | **`REVIEW`** | `MEDIUM` |

---

## Current Limitations & Phase 3 Readiness

- **Current Limitations**: Consumer contracts are currently seeded rather than dynamically registered via an admin API. Authentication (Cognito/API Key) and web frontend are not included in Phase 2.
- **Phase 3 Readiness**: The deployed serverless API and DynamoDB persistence provide the foundation for Phase 3:
  - Connecting `ALLOW` decisions to EventBridge event bus publication.
  - Rejecting `BLOCK` decisions at the gateway before publishing.
  - Deploying consumer worker Lambdas (`Billing`, `Inventory`, `Analytics`) subscribed to the EventBridge bus.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
