<div align="center">

# 🚪 PrimeX EventGate

### Consumer-Aware Event Compatibility Analysis & Publication Enforcement

**You changed one thing. We tell you what breaks before it breaks.**

*EventGate analyzes proposed event changes against registered downstream consumer contracts and prevents incompatible changes from being published to Amazon EventBridge.*

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

In event-driven architectures, producers evolve schemas independently. Many schema-validation workflows focus on producer/schema compatibility in isolation without cross-referencing downstream consumer dependencies.

When a producer modifies a field type or removes an optional field:
* The event schema may appear backward-compatible from the producer's viewpoint.
* The event is published to the message broker.
* Downstream consumer services fail in production during JSON deserialization or data processing because they depended upon the modified field.

---

## 2. The EventGate Solution

EventGate adds **consumer-aware impact analysis and publication enforcement on top of event contract validation**:

* **Consumer-Contract Model:** Proposed contract changes are evaluated against known downstream consumer contracts stored in Amazon DynamoDB.
* **Deterministic Publication Enforcement:** EventGate evaluates the change inside the EventGate Lambda and prevents EventBridge publication when the decision is `BLOCK` or `REVIEW`:
  * ✅ **`ALLOW`**: All registered consumers are compatible $\to$ EventGate calls `events:PutEvents` $\to$ Fans out to subscribers.
  * 🚫 **`BLOCK`**: One or more consumers would break $\to$ Publication prevented $\to$ HTTP 409 returned $\to$ No downstream consumer receipt observed.
  * ⚠️ **`REVIEW`**: An uncertain or risky change is detected (e.g. removing an optional field used by a consumer) $\to$ Publication prevented pending review $\to$ HTTP 409 returned $\to$ No downstream consumer receipt observed.

---

## 3. 30-Second Example

Consider `OrderPlaced` event evolution from baseline `v1`:

| Transition | Change | Gate Decision | Impact Breakdown | EventBridge Delivery |
| :--- | :--- | :---: | :--- | :---: |
| **v1 $\to$ v2** | Add optional `metadata` object | **`ALLOW`** | All 3 consumers (`billing`, `inventory`, `analytics`) unaffected. | ✅ **Published & Fanned Out** |
| **v1 $\to$ v3** | `shippingMethod` changed from `string` $\to$ `object` | **`BLOCK`** | `inventory-service` expects `string`. Deserialization would fail. | 🚫 **Publication Prevented** (HTTP 409) |
| **v1 $\to$ v4** | Optional `couponCode` removed from contract | **`REVIEW`** | `analytics-service` declares dependency on `couponCode`. Review required. | ⚠️ **Publication Prevented** (HTTP 409) |

---

## 4. End-to-End Architecture

```text
Browser User / Developer
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
    ├──► 2. Validate payload syntax & schema (HTTP 422 INVALID_EVENT_PAYLOAD if invalid)
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
   * Answers: *"Would the proposed contract create incompatibilities for registered consumers?"*
   * Compares `currentVersion` against `proposedVersion` for the given `eventType`.
   * Evaluates deterministic compatibility rules `EVT001` through `EVT008` against registered consumer contracts in DynamoDB.
   * Returns deterministic decision (`ALLOW`, `BLOCK`, or `REVIEW`), severity, summary, change set diff, and consumer findings. Zero side effects.
2. **Gated Publication (`POST /api/v1/events/publish`):**
   * Answers: *"Is the actual payload valid for the proposed contract, and are all consumers compatible?"*
   * Validates event payload against proposed schema (returns HTTP 422 `INVALID_EVENT_PAYLOAD` with request ID if invalid).
   * Evaluates consumer contract compatibility in real-time inside the Lambda application.
   * If `ALLOW`: Publishes event to EventBridge bus via `events:PutEvents`, returning `eventId` and `eventBridgeEventId`.
   * If `BLOCK` or `REVIEW`: Halts execution before calling EventBridge and returns HTTP 409 with violation diagnosis. Publication is prevented before EventBridge, and no downstream consumer receipt is observed.

---

## 6. AWS Services Used

* **AWS Amplify Hosting:** Serves the responsive developer console with continuous deployment from GitHub `main`.
* **Amazon API Gateway:** HTTP API v2 providing the public entrypoint with payload compression and CORS configuration.
* **AWS Lambda:** Hosts the EventGate application decision engine (Python 3.14 + FastAPI) and demonstration consumers.
* **Amazon DynamoDB:** Fully managed NoSQL key-value store with `PAY_PER_REQUEST` billing storing versioned event contracts and consumer dependency contracts.
* **Amazon EventBridge:** Custom event bus (`primex-eventgate-dev-bus`) routing approved events to target consumer microservices.
* **Amazon CloudWatch:** Stores structured application and consumer logs with request and event correlation using `X-Request-ID`, `eventId`, and `eventBridgeEventId`.
* **AWS SAM:** Infrastructure-as-Code declarative template managing stack creation and deployment.

---

## 7. Verification Evidence

The system has passed comprehensive local quality gates and live AWS end-to-end verification:

* **Backend Test Suite:** **190 passed**, **94.08% code coverage** (exceeds 85% requirement).
* **Frontend Test Suite:** **54 passed** across 12 test files with zero failures.
* **Static Analysis:** `ruff check .` clean, `oxlint` clean (0 warnings, 0 errors).
* **Live AWS Smoke Test (`scripts/aws_enforcement_smoke_test.py`):**
  * `GET /health` $\to$ **`200 OK`**
  * v1 $\to$ v2 $\to$ **`ALLOW` / `200 OK`** $\to$ EventBridge Event ID returned $\to$ **3 / 3 consumers invoked** (verified in CloudWatch).
  * v1 $\to$ v3 $\to$ **`BLOCK` / `409 Conflict`** $\to$ Publication prevented before EventBridge $\to$ **0 / 3 consumer receipt observed**.
  * v1 $\to$ v4 $\to$ **`REVIEW` / `409 Conflict`** $\to$ Publication prevented before EventBridge $\to$ **0 / 3 consumer receipt observed**.
  * Missing required field `orderId` $\to$ **`422 Unprocessable Entity` (`INVALID_EVENT_PAYLOAD`)** $\to$ Publication prevented before EventBridge.

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

* **Demonstration Authentication Scope:** In accordance with hackathon constraints, endpoints do not require IAM SigV4 or Cognito authentication to permit frictionless judge evaluation. A production deployment would introduce Cognito user pools or API Gateway authorizers.
* **Demonstration Consumers:** Downstream consumer Lambdas log received events to CloudWatch to demonstrate fan-out and isolation rather than executing business-layer transactions.
* **Supported Schema Format:** Implements contract compatibility evaluation for structured JSON schemas (field presence, type transitions, requiredness). Full JSON Schema Draft 7/2020-12 keyword evaluation is planned for future iterations.

---

<div align="center">

*Built for the AWS "First Commit" Hackathon — Bharat Builds Tour by WeMakeDevs* 🇮🇳

</div>
