<div align="center">

# 🚪 PrimeX EventGate

### Consumer-Aware Event Compatibility Analysis & Publication Enforcement

**You changed one thing. We tell you what breaks before it breaks.**

*EventGate analyzes proposed event changes against downstream consumer contracts and blocks incompatible changes before they propagate.*

[![Frontend](https://img.shields.io/badge/Frontend-AWS%20Amplify-FF9900?style=flat-square&logo=awsamplify&logoColor=white)](https://main.d1etyexqf0w3wz.amplifyapp.com)
[![Backend](https://img.shields.io/badge/Backend-API%20Gateway%20%2B%20Lambda-FF9900?style=flat-square&logo=amazonaws&logoColor=white)](https://ux8bwi3i8l.execute-api.ap-south-1.amazonaws.com/health)
[![Tests Backend](https://img.shields.io/badge/Backend%20Tests-190%20Passed-brightgreen?style=flat-square)]()
[![Tests Frontend](https://img.shields.io/badge/Frontend%20Tests-54%20Passed-brightgreen?style=flat-square)]()
[![Coverage](https://img.shields.io/badge/Coverage-94.08%25-brightgreen?style=flat-square)]()
[![Python](https://img.shields.io/badge/Python-3.14-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-ASGI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square)](LICENSE)

---

### 🌐 Live Hackathon Demonstration

| Component | URL | Provider | Role |
| :--- | :--- | :--- | :--- |
| **Control Console** | [`https://main.d1etyexqf0w3wz.amplifyapp.com`](https://main.d1etyexqf0w3wz.amplifyapp.com) | **AWS Amplify** | Interactive developer control plane |
| **Enforcement API** | [`https://ux8bwi3i8l.execute-api.ap-south-1.amazonaws.com`](https://ux8bwi3i8l.execute-api.ap-south-1.amazonaws.com) | **Amazon API Gateway** | Live schema gating & EventBridge ingress |

</div>

---

## 1. The Problem

In event-driven architectures, producers evolve schemas independently. Traditional schema registries validate schemas in isolation against a producer-side schema history, **blind to what downstream consumers actually depend upon**.

When a producer modifies a field type or removes an optional field:
* The event is accepted by the producer registry.
* The event is published to the message broker.
* Downstream consumer services fail silently in production during JSON deserialization or data processing.

---

## 2. The EventGate Solution

EventGate evaluates proposed event schema changes against **actual registered downstream consumer contracts** stored in DynamoDB and enforces the compatibility decision **before** the event ever reaches Amazon EventBridge:

* **Consumer-Aware Analysis:** Evaluates exact field dependencies, type expectations, and requiredness per registered consumer.
* **Deterministic Publication Enforcement:**
  * ✅ **`ALLOW`**: All consumers are compatible $\to$ Event published to Amazon EventBridge $\to$ Fans out to subscribers.
  * 🚫 **`BLOCK`**: One or more consumers would break $\to$ Publication prevented $\to$ Zero downstream delivery.
  * ⚠️ **`REVIEW`**: An uncertain or risky change is detected $\to$ Publication prevented pending review $\to$ Zero downstream delivery.

---

## 3. 30-Second Example

Consider `OrderPlaced` event evolution from baseline `v1`:

| Transition | Change | Gate Decision | Impact Breakdown | EventBridge Delivery |
| :--- | :--- | :---: | :--- | :---: |
| **v1 $\to$ v2** | Add optional `metadata` object | **`ALLOW`** | All 3 consumers (`billing`, `inventory`, `analytics`) unaffected. | ✅ **Published & Fanned Out** |
| **v1 $\to$ v3** | `shippingMethod` changed from `string` $\to$ `object` | **`BLOCK`** | `inventory-service` expects `string`. Deserialization would fail. | 🚫 **Publication Prevented** (HTTP 409) |
| **v1 $\to$ v4** | Optional `couponCode` removed from contract | **`REVIEW`** | `analytics-service` uses `couponCode` for telemetry. Review required. | ⚠️ **Publication Prevented** (HTTP 409) |

---

## 4. End-to-End Architecture

```text
Browser User
    │
    ▼
AWS Amplify Hosting
  (React + TypeScript + Tailwind Control Plane)
    │
    │ HTTPS REST (CORS)
    ▼
Amazon API Gateway HTTP API (ap-south-1)
  POST /api/v1/analyze  │  POST /api/v1/events/publish
    │
    ▼
AWS Lambda: EventGateFunction (Python 3.14 + FastAPI)
    │
    ├──► 1. Query Amazon DynamoDB (EventContracts & ConsumerContracts)
    │
    ├──► 2. Validate payload syntax & schema (HTTP 422 if invalid)
    │
    └──► 3. Deterministic Decision Engine
              │
              ├── [BLOCK]  ──► Return HTTP 409 (EventBridge publication PREVENTED)
              │
              ├── [REVIEW] ──► Return HTTP 409 (EventBridge publication PREVENTED)
              │
              └── [ALLOW]  ──► events:PutEvents (Publication APPROVED)
                                      │
                                      ▼
                       Amazon EventBridge Custom Bus (primex-eventgate-dev-bus)
                                      │
                                      ▼ Rule: primex-eventgate-dev-order-placed-rule
                         ┌────────────┼────────────┐
                         ▼            ▼            ▼
                     Billing      Inventory    Analytics
                     Consumer     Consumer     Consumer
                      Lambda       Lambda       Lambda
                         │            │            │
                         └────────────┼────────────┘
                                      ▼
                             Amazon CloudWatch Logs
```

---

## 5. How Enforcement Works

1. **Advisory Analysis (`POST /api/v1/analyze`):**
   * Compares `currentVersion` against `proposedVersion` for the given `eventType`.
   * Evaluates compatibility rules `EVT001` through `EVT008` against all registered consumer contracts in DynamoDB.
   * Returns deterministic decision (`ALLOW`, `BLOCK`, or `REVIEW`), severity, summary, change set diff, and consumer-by-consumer findings. Zero side effects.
2. **Gated Publication (`POST /api/v1/events/publish`):**
   * Validates event payload against proposed schema (returns HTTP 422 with trace request ID if invalid).
   * Re-evaluates consumer contract compatibility in real-time.
   * If `ALLOW`: Publishes event to EventBridge bus via `events:PutEvents`, returning `eventId` and `eventBridgeEventId`.
   * If `BLOCK` or `REVIEW`: Halts execution and returns HTTP 409 with full violation diagnosis. **Zero events enter EventBridge.**

---

## 6. AWS Services Used

* **AWS Amplify Hosting:** Serves the responsive developer console with global CDN distribution and continuous deployment from `main`.
* **Amazon API Gateway:** HTTP API v2 providing low-latency entrypoint with payload compression and CORS configuration.
* **AWS Lambda:** Serverless Python 3.14 execution environment running the FastAPI decision engine and demonstration consumers.
* **Amazon DynamoDB:** Fully managed NoSQL key-value store with `PAY_PER_REQUEST` billing storing versioned event schemas and consumer dependency contracts.
* **Amazon EventBridge:** Custom event bus (`primex-eventgate-dev-bus`) routing verified events to target consumer microservices.
* **Amazon CloudWatch:** Structured JSON log aggregation and request tracing correlation via `X-Request-ID`.
* **AWS SAM:** Infrastructure-as-Code declarative template managing stack creation and deployment.

---

## 7. Verification Evidence

The system has passed comprehensive local quality gates and live AWS end-to-end verification:

* **Backend Test Suite:** **190 passed**, **94.08% code coverage** (exceeds 85% requirement).
* **Frontend Test Suite:** **54 passed** across 12 test files with zero failures.
* **Static Analysis:** `ruff check .` clean, `oxlint` clean (0 warnings, 0 errors).
* **Live AWS Smoke Test (`scripts/aws_enforcement_smoke_test.py`):**
  * `GET /health` $\to$ **`200 OK`**
  * v1 $\to$ v2 $\to$ **`ALLOW` / `200 OK`** $\to$ EventBridge ID generated $\to$ **3 / 3 consumers invoked** (verified in CloudWatch).
  * v1 $\to$ v3 $\to$ **`BLOCK` / `409 Conflict`** $\to$ **0 / 3 consumers invoked** (traffic halted at gate).
  * v1 $\to$ v4 $\to$ **`REVIEW` / `409 Conflict`** $\to$ **0 / 3 consumers invoked** (traffic halted at gate).
  * Malformed payload $\to$ **`422 Unprocessable Entity`** $\to$ **0 / 3 consumers invoked**.

---

## 8. Local Development

### Prerequisites
* Python 3.14+
* Node.js 20+
* AWS SAM CLI (for deployment)

### Backend Setup
```powershell
# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Run tests and coverage
pytest --cov=eventgate --cov-report=term-missing

# Lint check
ruff check .
```

### Frontend Setup
```powershell
cd frontend

# Install dependencies
npm install

# Run tests
npm test

# Run linter
npm run lint

# Build production bundle
npm run build
```

---

## 9. Repository Structure

```text
primex-eventgate/
├── backend/                  # Core EventGate decision engine (Python + FastAPI)
│   ├── src/eventgate/
│   │   ├── api/              # HTTP routes (/health, /analyze, /publish)
│   │   ├── application/      # Analysis and gated publication services
│   │   ├── domain/           # Compatibility rules EVT001-EVT008 & models
│   │   └── infrastructure/   # DynamoDB repositories & EventBridge publisher
│   └── tests/                # 190 pytest unit & integration tests (94.08% cov)
├── consumers/                # Target consumer demonstration Lambdas
│   ├── billing/              # Billing service consumer handler
│   ├── inventory/            # Inventory service consumer handler
│   └── analytics/            # Analytics service consumer handler
├── frontend/                 # Production developer control console (React + Vite)
│   ├── src/
│   │   ├── components/       # 3-column workspace, code editor, event path
│   │   ├── services/         # REST API client
│   │   └── test/             # 54 Vitest test cases
├── docs/                     # Comprehensive architecture and API documentation
├── scripts/                  # AWS enforcement smoke test & verification scripts
└── template.yaml             # Declarative AWS SAM infrastructure specification
```

---

## 10. Scope & Limitations

* **Demonstration Authentication Scope:** In accordance with hackathon constraints, endpoints do not require IAM SigV4 or Cognito authentication. A production deployment would introduce Cognito user pools or API Gateway authorizers.
* **Demonstration Consumers:** Downstream consumer Lambdas log received events to CloudWatch to demonstrate fan-out and isolation rather than executing business-layer transactions.
* **Supported Schema Format:** Implements contract compatibility evaluation for structured JSON schemas (field presence, type transitions, requiredness). Full JSON Schema Draft 7/2020-12 keyword evaluation is planned for future iterations.

---

<div align="center">

*Built for the AWS "First Commit" Hackathon — Bharat Builds Tour by WeMakeDevs* 🇮🇳

</div>
