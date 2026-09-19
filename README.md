<div align="center">

# 🚪 PrimeX EventGate

### Event-Contract Release-Control Platform
**Frontend • Backend • AWS • CLI • CI • Policy Engine**

**"You changed one thing. We tell you what breaks before it breaks."**

*EventGate analyzes proposed event-contract changes against downstream consumer contracts, evaluates release policy, and prevents incompatible changes from being published.*

[![Frontend](https://img.shields.io/badge/Frontend-AWS%20Amplify-FF9900?style=flat-square&logo=awsamplify&logoColor=white)](https://main.d1etyexqf0w3wz.amplifyapp.com)
[![Backend](https://img.shields.io/badge/Backend-API%20Gateway%20%2B%20Lambda-FF9900?style=flat-square&logo=amazonaws&logoColor=white)](https://ux8bwi3i8l.execute-api.ap-south-1.amazonaws.com/health)
[![Tests Backend](https://img.shields.io/badge/Backend%20Tests-270%20Passed-brightgreen?style=flat-square)]()
[![Tests Frontend](https://img.shields.io/badge/Frontend%20Tests-88%20Passed-brightgreen?style=flat-square)]()
[![Coverage](https://img.shields.io/badge/Coverage-91.71%25-brightgreen?style=flat-square)]()
[![Python](https://img.shields.io/badge/Python-3.14-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-ASGI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square)](LICENSE)

---

### 🌐 Live Platform Demonstration

| Component | URL | Provider | Role |
| :--- | :--- | :--- | :--- |
| **Control Console** | [`https://main.d1etyexqf0w3wz.amplifyapp.com`](https://main.d1etyexqf0w3wz.amplifyapp.com) | **AWS Amplify** | 6-view developer control plane & workspace |
| **Enforcement API** | [`https://ux8bwi3i8l.execute-api.ap-south-1.amazonaws.com`](https://ux8bwi3i8l.execute-api.ap-south-1.amazonaws.com) | **Amazon API Gateway** | Schema gating, policy engine, & EventBridge ingress |

</div>

---

## 1. The Problem

In event-driven microservices, producers evolve schemas independently. Traditional schema registries validate producer payload syntax in isolation without cross-referencing downstream consumer dependencies.

When a producer modifies a field type or removes an optional field:
* The event schema may appear backward-compatible from the producer's isolated perspective.
* The event is published to the message broker.
* Downstream consumer microservices crash in production during JSON deserialization or data processing because they relied upon the altered field.

---

## 2. The EventGate Solution

EventGate adds **consumer-aware impact analysis and release policy enforcement on top of event contract validation**:

```text
PROPOSE CONTRACT CHANGE
        ↓
COMPATIBILITY ANALYSIS  (SAFE | RISK | BREAK)
        ↓
CONSUMER IMPACT         (Affected Services & Dependencies)
        ↓
BLAST RADIUS            (Interactive Topology Visualization)
        ↓
RELEASE POLICY          (Environment Matrix: prod | staging | dev)
        ↓
ALLOW / REVIEW / BLOCK
        ↓
PUBLISH OR PREVENT      (Amazon EventBridge PutEvents on ALLOW only)
        ↓
RELEASE EVIDENCE / HISTORY (Persistent Audit Trail & Exportable Reports)
```

1. **Separation of Compatibility and Policy:**
   * **Compatibility Analysis:** Deterministically calculates whether a change is `SAFE`, `RISK`, or `BREAK` based on rules `EVT001`–`EVT008`.
   * **Release Policy:** Evaluates the compatibility result against the target environment (`production`, `staging`, `development`) to produce an authoritative `ALLOW`, `REVIEW`, or `BLOCK` decision.
2. **Release Policy Matrix:**
   * **Production & Staging:** `LOW` severity $\to$ `ALLOW`, `MEDIUM` severity $\to$ `REVIEW`, `HIGH` severity $\to$ `BLOCK`.
   * **Development:** `LOW` severity $\to$ `ALLOW`, `MEDIUM` severity $\to$ `ALLOW with warning`, `HIGH` severity $\to$ `BLOCK`.
3. **Pluggable Policy Providers:** Decoupled `IPolicyEngine` supporting pure standard deterministic evaluation and Cedar policy language integration.
4. **Deterministic Publication Enforcement:**
   * ✅ **`ALLOW`**: Compatible $\to$ EventGate calls `events:PutEvents` $\to$ Fans out to downstream subscribers.
   * 🚫 **`BLOCK`**: Incompatible $\to$ Publication prevented $\to$ HTTP 409 returned $\to$ Zero downstream consumer receipt.
   * ⚠️ **`REVIEW`**: Risky change $\to$ Publication prevented pending review $\to$ HTTP 409 returned $\to$ Zero downstream consumer receipt.

---

## 3. Platform Architecture & Features

### 3.1 Six Integrated Developer Workspaces
* **Review:** Main release review workspace with 3-column layout, line-numbered JSON payload editor, inline schema diagnostics, interactive blast radius topology, and PR-style schema diff.
* **Contracts:** Comprehensive Contract Registry with real event versions (`OrderPlaced`, `PaymentCompleted`, `UserCreated`) and Consumer Explorer with dependency drill-down.
* **History:** Persistent audit trail correlating analysis and publication into unified release records with exportable Markdown and JSON audit reports.
* **Developer Tools:** Live assertion test runner comparing actual vs expected decisions, developer CLI command generator, and CI workflow integration guide.
* **Policies:** Interactive release policy matrix viewer across all environments with Cedar language policy inspection.
* **Settings:** Authoritative **Runtime Configuration** display exposing active storage backend, publisher, AWS region, event bus, and policy engine.

### 3.2 Developer CLI (`eventgate`)
A command-line release gate tool sharing the exact same domain core as the API:
```bash
# Evaluate contract compatibility in CI/CD pipelines
eventgate check --event OrderPlaced --current 1 --proposed 3 --env production

# Inspect registered contracts and consumer dependencies
eventgate catalog --events
eventgate catalog --consumers

# Query persistent audit history
eventgate history --limit 10

# Execute assertion tests
eventgate test --event OrderPlaced --current 1 --proposed 2 --expected ALLOW
```
Exit codes: `0` (ALLOW), `1` (BLOCK), `2` (REVIEW, or `1` with `--fail-on-review`). See [docs/cli.md](docs/cli.md).

### 3.3 CI/CD Integration & GitHub Actions
* **Automatic Version Detection (`scripts/ci_contract_diff.py`):** Automatically detects modified contract files in pull requests, derives the established base version dynamically from repository state, and invokes `eventgate check`.
* **GitHub Actions Release Gate (`.github/workflows/eventgate-contract-check.yml`):** Runs on PRs touching `contracts/**` and blocks pull requests if breaking changes are introduced without authorization.

---

## 4. End-to-End Architecture

```text
Browser User / Developer / CLI / CI
    │
    ▼
Amazon API Gateway HTTP API (ap-south-1)
  POST /api/v1/analyze  │  POST /api/v1/events/publish
  GET  /api/v1/contracts/*  │  GET /api/v1/history/*
    │
    ▼
AWS Lambda: EventGateFunction (Python 3.14 + FastAPI)
    │
    ├──► 1. Query Amazon DynamoDB (Zero Primary Scans via Catalog Metadata)
    │
    ├──► 2. Validate payload syntax & schema (HTTP 422 if invalid)
    │
    ├──► 3. Deterministic Compatibility Engine (Rules EVT001-EVT008)
    │
    ├──► 4. Decoupled Release Policy Engine (Standard / Cedar)
    │
    ├──► 5. Persist Correlated Release Record (Analysis ID = Record ID)
    │
    └──► 6. Gated Ingress
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
                                      ▼
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

## 5. Verification Evidence & Quality Baseline

The system is validated through comprehensive local and cloud quality gates:

* **Backend Test Suite:** **270 passed**, **91.71% code coverage** (exceeds 90% requirement).
* **Frontend Test Suite:** **88 passed** across 22 test files with zero failures.
* **Static Analysis:** `ruff check backend scripts` clean, `oxlint` clean (0 warnings, 0 errors).
* **TypeScript & Build:** `tsc -b` clean, Vite production bundle clean.
* **CLI Verification:** Fully verified across `check`, `catalog`, `history`, and `test` subcommands.
* **CI Integration:** Automated contract diff detection and GitHub Actions workflow verified.
* **Live AWS Verification:** Verified end-to-end in `ap-south-1` with EventBridge fan-out and CloudWatch log correlation.

---

## 6. Repository Structure

```text
primex-eventgate/
├── backend/                  # Core EventGate decision engine (Python 3.14 + FastAPI)
│   ├── src/eventgate/
│   │   ├── api/              # HTTP routes (analyze, publish, catalog, history, policies, config)
│   │   ├── application/      # Catalog, history, analysis, and gated publish services
│   │   ├── cli/              # EventGate developer CLI tool
│   │   ├── domain/           # Rules EVT001-EVT008, policy abstraction, and domain models
│   │   └── infrastructure/   # Repositories (Local JSON & DynamoDB) and EventBridge publisher
│   └── tests/                # 270 pytest unit, integration, and conformance tests (91.71% cov)
├── frontend/                 # Enterprise developer console (React 19 + Vite 8 + Tailwind 4)
│   ├── src/
│   │   ├── components/       # 6 views: Review, Contracts, History, DevTools, Policies, Settings
│   │   ├── services/         # REST API client & Zod schemas
│   │   └── test/             # 88 Vitest component and flow tests
├── contracts/                # Real event contracts & registered consumer contracts
│   ├── events/               # OrderPlaced (v1-v4), PaymentCompleted (v1-v2), UserCreated (v1-v2)
│   ├── consumers/            # billing, inventory, analytics, fraud, notification, audit contracts
│   ├── policies/             # Release policy Cedar definitions
│   └── history/              # Persistent release review audit trail (reviews.json)
├── docs/                     # Comprehensive engineering documentation
│   ├── architecture.md       # Clean architecture, repositories, and correlation model
│   ├── api.md                # Complete HTTP REST API specification
│   ├── cli.md                # Developer CLI command reference & integration guide
│   ├── release-policy.md     # Policy matrix, providers, and Cedar integration
│   ├── build-it.md           # Zero-credential local execution guide
│   ├── ship-it.md            # AWS serverless infrastructure and production guide
│   └── ui.md                 # Design system tokens, UX rationale, and keyboard shortcuts
├── scripts/                  # CI contract diff, AWS smoke tests, and local demo scripts
└── template.yaml             # Declarative AWS SAM infrastructure specification
```

---

## 7. Local Development

### Prerequisites
* Python 3.14+ (or 3.12+)
* Node.js 20+
* AWS SAM CLI (for cloud deployments)

### Backend Execution
```powershell
# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Run tests and coverage
pytest --cov=eventgate --cov-report=term-missing

# Run linter
ruff check backend scripts
```

### Frontend Execution
```powershell
cd frontend

# Install dependencies
npm install

# Run test suite
npm test -- --run

# Run linter & build
npm run lint
npm run build

# Start dev server
npm run dev
```

---

## 8. Documentation Index

* 📘 [Architecture Specification](docs/architecture.md)
* 📡 [API Reference](docs/api.md)
* 💻 [CLI Reference Guide](docs/cli.md)
* ⚖️ [Release Policy & Cedar Specification](docs/release-policy.md)
* 🛠️ [Build It Track: Local Execution](docs/build-it.md)
* 🚀 [Ship It Track: AWS Production Architecture](docs/ship-it.md)
* 🎨 [Best UI Track: Design System & UX](docs/ui.md)

---

## 9. AI Tool Disclosure & Attribution

In accordance with hackathon guidelines, the team used the following AI tools during development:
* **Google Antigravity IDE & Gemini Models:** Used as an interactive pair-programming assistant for boilerplate generation, test case scaffolding, documentation drafting, and UI design token refinement.
* **Deterministic Core Integrity:** All core compatibility decision algorithms (rules `EVT001` through `EVT008`), AWS SAM CloudFormation declarations, and security gating policies were human-architected, verified, and backed by automated regression tests.

---

<div align="center">

*Built for the AWS "First Commit" Hackathon — Bharat Builds Tour by WeMakeDevs* 🇮🇳

</div>

