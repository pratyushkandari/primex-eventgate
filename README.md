<div align="center">

# 🚪 PrimeX EventGate

### Consumer-Aware Safety Gate & Cloud Enforcement for Event-Driven Systems

**BREAK IT BEFORE IT BREAKS.**

*Stop breaking changes before they ever reach the event bus.*

[![Python](https://img.shields.io/badge/Python-3.14-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-ASGI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![AWS SAM](https://img.shields.io/badge/AWS-SAM%20%2F%20Lambda-FF9900?style=flat-square&logo=amazonaws&logoColor=white)](https://aws.amazon.com/serverless/sam/)
[![EventBridge](https://img.shields.io/badge/EventBridge-Custom%20Bus-FF4F8B?style=flat-square&logo=amazoneventbridge&logoColor=white)](https://aws.amazon.com/eventbridge/)
[![DynamoDB](https://img.shields.io/badge/DynamoDB-PAY__PER__REQUEST-4053D6?style=flat-square&logo=amazondynamodb&logoColor=white)](https://aws.amazon.com/dynamodb/)
[![Tests](https://img.shields.io/badge/Tests-190%20Passed-brightgreen?style=flat-square)]()
[![Coverage](https://img.shields.io/badge/Coverage-94.08%25-brightgreen?style=flat-square)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/Phase-3%20Complete-success?style=flat-square)]()

</div>

---

## ⚡ What is EventGate?

In event-driven microservices, producer schema changes frequently break downstream consumers without warning. Traditional schema registries only validate syntax on the producer side, blind to what downstream services actually depend upon.

**EventGate solves this.** It analyzes proposed event changes against **registered downstream consumer contracts** and enforces compatibility directly at the cloud publication boundary:

1. **Identifies Affected Consumers:** Evaluates field additions, removals, type changes, and requiredness against each consumer's exact consumption contract.
2. **Derives Deterministic Policy:**
   - ✅ **`ALLOW`**: All consumers are compatible $\to$ Event published to Amazon EventBridge $\to$ Fans out to consumer microservices.
   - 🚫 **`BLOCK`**: At least one consumer would break $\to$ Gateway returns HTTP 409 $\to$ **EventBridge publication is prevented** (zero downstream delivery).
   - ⚠️ **`REVIEW`**: An uncertain or risky change is detected $\to$ Gateway returns HTTP 409 $\to$ **EventBridge publication is prevented pending review** (zero downstream delivery).

---

## 🏗️ AWS Architecture

```text
                                  +-------------------+
                                  |   HTTP Producer   |
                                  +-------------------+
                                            │
                                            │ POST /api/v1/events/publish
                                            ▼
+---------------------------------------------------------------------------------------+
|                    Amazon API Gateway HTTP API (EventGateHttpApi)                     |
+---------------------------------------------------------------------------------------+
                                            │
                                            ▼
+---------------------------------------------------------------------------------------+
|                       EventGate Lambda (EventGateFunction)                            |
|                                                                                       |
|   1. Validate payload against proposed schema (HTTP 422 if invalid)                   |
|   2. Query contracts from Amazon DynamoDB (EventContractsTable & ConsumerContracts)   |
|   3. Deterministically evaluate compatibility:                                        |
|      - BLOCK / REVIEW  ──► HTTP 409 (EventBridge publication is prevented)            |
|      - ALLOW           ──► events:PutEvents to custom event bus                       |
+---------------------------------------------------------------------------------------+
                                            │
                               events:PutEvents (ALLOW only)
                                            ▼
+---------------------------------------------------------------------------------------+
|                 Amazon EventBridge Custom Bus (primex-eventgate-dev-bus)              |
+---------------------------------------------------------------------------------------+
                                            │
                      Rule: primex-eventgate-dev-order-placed-rule
                                            │
                   ┌────────────────────────┼────────────────────────┐
                   ▼                        ▼                        ▼
        +--------------------+   +--------------------+   +--------------------+
        |  Billing Consumer  |   | Inventory Consumer |   | Analytics Consumer |
        |   Lambda (128MB)   |   |   Lambda (128MB)   |   |   Lambda (128MB)   |
        +--------------------+   +--------------------+   +--------------------+
                   │                        │                        │
                   └────────────────────────┼────────────────────────┘
                                            ▼
                              Amazon CloudWatch Logs
```

---

## ☁️ Live Deployment (AWS `ap-south-1`)

The hackathon demonstration stack is deployed and operational in **`ap-south-1`**:

- **Live Base URL:** [`https://ux8bwi3i8l.execute-api.ap-south-1.amazonaws.com`](https://ux8bwi3i8l.execute-api.ap-south-1.amazonaws.com) *(public demonstration endpoint)*
- **CloudFormation Stack:** `primex-eventgate-dev`
- **Core Lambda:** `primex-eventgate-dev-api`
- **EventBridge Custom Bus:** `primex-eventgate-dev-bus`
- **Consumer Demonstration Lambdas:**
  - `primex-eventgate-dev-consumer-billing`
  - `primex-eventgate-dev-consumer-inventory`
  - `primex-eventgate-dev-consumer-analytics`
- **DynamoDB Tables:**
  - `primex-eventgate-dev-event-contracts`
  - `primex-eventgate-dev-consumer-contracts`

---

## 🧪 Verified on AWS

Every scenario below was verified against the live AWS deployment using `scripts/aws_enforcement_smoke_test.py`:

| Test Stage | Scenario | Verified Event ID | Gate Result | EventBridge Action | Consumer Receipt |
| :--- | :--- | :--- | :---: | :--- | :---: |
| **1. Health Check** | `GET /health` | — | `200 OK` | None | None |
| **2. Scenario A** | v1 $\to$ v2 (added `metadata`) | `4d22c323-2506-42ec-af22-8ac6ed99e18b` | `ALLOW` / `200 OK` | `PutEvents` succeeded (`a983ef0d-1ffa-fe94-a3be-012aba52c883`) | **3 / 3 Received** (Billing, Inventory, Analytics) |
| **3. Scenario B** | v1 $\to$ v3 (`shippingMethod` $\to$ `object`) | `8a4cafba-f9a6-48b1-af5b-57cb397e3d43` | `BLOCK` / `409 Conflict` | **Publication prevented** | **0 / 3 Received** (Absence confirmed in logs) |
| **4. Scenario C** | v1 $\to$ v4 (`couponCode` removed) | `f8705a9f-63cd-4194-be22-0869fe01d5b6` | `REVIEW` / `409 Conflict` | **Publication prevented** | **0 / 3 Received** (Absence confirmed in logs) |
| **5. Invalid Payload** | Missing required `orderId` | — | `422 Unproc` | **Publication bypassed** | **0 / 3 Received** |

---

## 🛠️ Technology Stack

- **Runtime & Language:** Python 3.14, FastAPI, Mangum ASGI adapter
- **Compute:** AWS Lambda (x86_64, 128–256 MB)
- **API Transport:** Amazon API Gateway HTTP API v2
- **Event Messaging:** Amazon EventBridge (Custom Bus + Rule fan-out)
- **Persistence:** Amazon DynamoDB (`PAY_PER_REQUEST`, zero-scan query patterns)
- **Observability:** Amazon CloudWatch (Structured JSON logging + `X-Request-ID` correlation)
- **Infrastructure as Code:** AWS SAM (Serverless Application Model)
- **Testing & Quality:** Pytest (190 tests, 94.08% coverage), Ruff (linter and formatter)

---

## 🔒 Scope & Limitations

> [!NOTE]
> **Controlled Demonstration Scope:**
> Phase 3 does not implement authentication or authorization. The public HTTP endpoint is intentionally configured for controlled hackathon demonstration. A production implementation would require Amazon Cognito or IAM SigV4 authentication, API Gateway throttling, and AWS WAF.

---

## 🚀 Getting Started (Local Development)

### Backend (Python + FastAPI + AWS SAM)

```powershell
# 1. Activate virtual environment
.\.venv\Scripts\Activate.ps1

# 2. Run test suite & coverage (190 tests, 94.08% coverage)
pytest --cov=eventgate --cov-report=term-missing

# 3. Lint and format checks
ruff check .
ruff format --check .

# 4. SAM template validation and build
sam validate --lint
sam build
```

### Frontend (React + Vite + Tailwind CSS)

```powershell
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Configure API target (optional, defaults to live AWS endpoint)
$env:VITE_EVENTGATE_API_URL = "https://ux8bwi3i8l.execute-api.ap-south-1.amazonaws.com"

# 4. Run local development server
npm run dev

# 5. Run test suite (44 tests)
npm test

# 6. Run linter
npm run lint

# 7. Build production bundle
npm run build
```

> [!NOTE]
> **Frontend Hosting Status:**
> The EventGate frontend is verified locally and bundled for production (`frontend/dist/`). Cloud hosting deployment preparation is underway (Phase 4.3); it is not yet publicly deployed.

---

## 🔮 Future Extensions

- Automated consumer pull-request notifications for `REVIEW` decisions
- Dead-letter queues (DLQs) and automated replay policies
- Bedrock-powered natural language schema evolution insights

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

<div align="center">

---

*Built for the AWS "First Commit" hackathon — Bharat Builds Tour by WeMakeDevs* 🇮🇳

</div>
