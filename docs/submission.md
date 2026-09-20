# PrimeX EventGate — Submission Brief

**First Commit Hackathon — Bharat Builds Tour by WeMakeDevs**

---

## 1. Project Summary

**PrimeX EventGate** is a consumer-aware release gate for event-driven systems.

* **Product Promise:** "You changed one thing. We tell you what breaks before it breaks."
* **Core Function:** EventGate evaluates proposed event contract changes against downstream consumer dependencies, classifies compatibility impact, evaluates environment-specific release policies, and permits, holds, or prevents publication before events reach the message broker.

---

## 2. Real-World Problem

In event-driven architectures, producers evolve event schemas independently. Traditional schema registries validate producer payload syntax in isolation without cross-referencing downstream consumer dependencies.

When a producer modifies a field type or removes an optional field:
1. The schema may appear backward-compatible from the producer's isolated perspective.
2. The event is published to the message broker.
3. Downstream consumer microservices crash in production during JSON deserialization or processing because they relied upon the altered field.

Standard schema validation answers: *"Is this payload valid against the producer's schema?"*
EventGate answers: *"Which declared consumers are affected by this change, and what should happen to the release in this environment?"*

---

## 3. Target Audience

Developers, platform engineers, and operations teams designing, evolving, and deploying event-driven microservice systems on AWS.

---

## 4. Core Workflow

```text
Current Event Contract + Proposed Event Contract
                       ↓
                Structural Diff
                       ↓
         Consumer Dependency Analysis
                       ↓
             Compatibility Result
             (SAFE / RISK / BREAK)
                       ↓
                   Severity
              (LOW / MEDIUM / HIGH)
                       ↓
           Environment Release Policy
        (production / staging / development)
                       ↓
                Release Decision
             (ALLOW / REVIEW / BLOCK)
                       ↓
            Publish / Hold / Prevent
                       ↓
         Release History / Traceability
```

---

## 5. Primary Differentiator

**Consumer-Aware Release Enforcement.**  
EventGate is not merely a schema validator. It isolates the blast radius of every change to the specific declared dependencies of each downstream consumer. Unrelated schema changes do not alert unaffected consumers, while incompatible changes halt publication before broker ingress, protecting downstream compute resources from failing.

---

## 6. Three Core Scenarios

The platform evaluates three canonical scenarios based on the `OrderPlaced` contract fixture:

### Scenario 1: Safe Evolution (v1 $\to$ v2)
* **Change:** Adds an optional `metadata` object field to the contract.
* **Compatibility:** `SAFE` (Severity: `LOW`, Rule `EVT005_OPTIONAL_FIELD_ADDED`).
* **Consumers:** `billing-service` (SAFE), `inventory-service` (SAFE), `analytics-service` (SAFE).
* **Release Decision:** `ALLOW` in all environments.
* **Publication Action:** Permitted. EventGate invokes `events:PutEvents` on the Amazon EventBridge bus. All three downstream consumer Lambdas are invoked.

### Scenario 2: Breaking Evolution (v1 $\to$ v3)
* **Change:** `shippingMethod` changed from `string` to nested `object`.
* **Compatibility:** `BREAK` (Severity: `HIGH`, Rule `EVT001_FIELD_TYPE_CHANGED`).
* **Consumers:** `inventory-service` expects `shippingMethod: string` (BREAK).
* **Release Decision:** `BLOCK` in all environments.
* **Publication Action:** Prevented. EventGate halts inside Lambda, returns HTTP 409 Conflict with diagnosis details, and calls zero broker APIs. Zero downstream consumer Lambdas are invoked.

### Scenario 3: Risky Evolution (v1 $\to$ v4)
* **Change:** Optional `couponCode` removed from the producer contract.
* **Compatibility:** `RISK` (Severity: `MEDIUM`, Rule `EVT006_OPTIONAL_FIELD_REMOVED`).
* **Consumers:** `analytics-service` declares an optional dependency on `couponCode` (RISK).
* **Release Decision:**
  * In `production` and `staging`: `REVIEW` (Publication held; requires operational review).
  * In `development`: `ALLOW with warning` (Permits rapid developer iteration).
* **Publication Action (Production):** Held pending review. HTTP 409 Conflict returned. Zero downstream consumer Lambdas are invoked.

---

## 7. AWS Cloud Architecture (Ship It Track)

The production infrastructure is deployed in **AWS Region `ap-south-1` (Mumbai)** under CloudFormation stack `primex-eventgate-dev`.

| AWS Service | Resource / Identifier | Role in EventGate |
| :--- | :--- | :--- |
| **AWS Amplify** | `https://main.d1etyxeqf0w3wz.amplifyapp.com` | Continuous deployment hosting for the React control plane console |
| **Amazon API Gateway** | `https://ux8bwi3i8l.execute-api.ap-south-1.amazonaws.com` | HTTP API (v2) entry point routing requests to Lambda |
| **AWS Lambda** | `primex-eventgate-dev-api` | Python 3.14 compute runtime executing FastAPI via Mangum |
| **Amazon DynamoDB** | `primex-eventgate-dev-event-contracts`<br/>`primex-eventgate-dev-consumer-contracts`<br/>`primex-eventgate-dev-release-history` | Versioned contracts, consumer registrations, and correlated release records (On-demand billing, zero primary table scans) |
| **Amazon EventBridge** | `primex-eventgate-dev-bus` | Custom event bus routing approved events to downstream subscribers |
| **AWS Lambda (Consumers)**| `...-consumer-billing`<br/>`...-consumer-inventory`<br/>`...-consumer-analytics` | Downstream subscriber Lambdas demonstrating real event delivery |
| **Amazon CloudWatch** | `/aws/lambda/primex-eventgate-dev-*` | Runtime execution logs, request ID tracing, and invocation verification |
| **AWS IAM** | Scoped execution roles | Least-privilege access (scoped DynamoDB tables and EventBridge bus ARN) |
| **AWS SAM** | `template.yaml` | Declarative serverless infrastructure specification |

---

## 8. Local Execution & Portability (Build It Track)

EventGate was engineered with **hexagonal architecture (ports and adapters)**, ensuring complete separation between business logic and cloud infrastructure:

* **Direct Python Execution:** Zero cloud dependencies, zero AWS credentials required. Run backend locally via Uvicorn (`eventgate.main:app`) using local JSON contract storage (`contracts/events/` and `contracts/consumers/`) and an in-memory event publisher (`LocalEventPublisher`).
* **Developer CLI:** The `eventgate` CLI executes contract checks, catalog queries, history audits, and assertion tests locally using the identical domain engine.
* **AWS SAM Local:** Declarative SAM template (`template.yaml`) validates via `sam validate --lint` and builds via `sam build`. Local Lambda emulation (`sam local start-api` or `sam local invoke`) is supported when a local Docker daemon is present.
* **No Docker Dependency for Native Development:** Native virtual environment and Node.js toolchains run the complete test suite and local server without Docker daemon overhead.

---

## 9. User Interface (Best UI Track)

The web console provides a responsive, high-density engineering workspace built with React 19, TypeScript, Vite 8, and Tailwind CSS:

1. **Review Workspace:** 3-column control plane with event selection, line-numbered JSON payload editor, inline schema diagnostics, interactive blast radius topology graph, and PR-style structural schema diff.
2. **Decision Hero:** Prominent status display presenting Compatibility Status (`SAFE` / `RISK` / `BREAK`), Severity (`LOW` / `MEDIUM` / `HIGH`), and Release Decision (`ALLOW` / `REVIEW` / `BLOCK`).
3. **Event Path Visualization:** Dynamic step-by-step pipeline illustrating the path from Payload Validation $\to$ Diff $\to$ Consumer Impact $\to$ Policy Evaluation $\to$ EventBridge Ingress.
4. **Contracts Registry & Consumer Explorer:** Comprehensive exploration of versioned event contracts and registered consumer dependencies with search, filtering, and field inspection.
5. **Release History:** Correlated audit trail linking Analysis ID to Record ID, EventBridge Event ID, publication timestamps, and affected consumers, with one-click export to Markdown and JSON compliance reports.
6. **Policies & Cedar Inspector:** Interactive 3x3 release policy matrix viewer across `production`, `staging`, and `development`, with read-only inspection of formal AWS Cedar policy definitions.
7. **Developer Tools:** Live assertion test runner, CLI command generator, and CI integration guides.
8. **Command Palette & Keyboard Ergonomics:** Quick navigation via `Ctrl+K` / `Cmd+K` and full accessibility support.

---

## 10. Execution Evidence & Verification Baseline

| Verification Area | Scope | Result |
| :--- | :--- | :--- |
| **Backend Unit & Integration Tests** | 279 pytest tests covering rules, policies, catalog, publish, CLI, and CI scripts | **279 passed** in ~4.8s |
| **Backend Code Coverage** | Full line coverage report across `eventgate.*` | **91.54% coverage** |
| **Backend Static Analysis** | `ruff check backend scripts` | **All checks passed** (0 errors) |
| **Frontend Unit & Component Tests** | 114 Vitest tests across 25 test suites | **114 passed** in ~1.5s |
| **Frontend Linting & Type Checking** | `npm run lint` (`oxlint`) and `npx tsc -b` | **0 errors, 0 warnings** |
| **Frontend Production Build** | `vite build` | Clean production build (`frontend/dist`) |
| **SAM Infrastructure Validation** | `sam validate -t template.yaml --lint` | **Valid SAM template** |
| **SAM Build** | `sam build` | **Build Succeeded** (`.aws-sam/build`) |
| **Live AWS Deployment Verification** | Live probes against API Gateway (`ap-south-1`) | Health (200), Safe publish (200), Breaking publish (409), Missing record (404), Unknown route (404) |

---

## 11. Engineering Learnings

1. **Decoupling Compatibility from Policy:** Structural compatibility is an immutable technical fact, while release policy is an organizational governance choice. Separating them into distinct layers allows different environments to enforce different risk tolerances without altering the underlying diff engine.
2. **Zero Table Scans in DynamoDB:** Modeling catalog metadata as dedicated partition key items (`PK=METADATA#CATALOG`) eliminates table scans entirely, ensuring single-digit millisecond latency regardless of repository growth.
3. **Pre-Broker Ingress Gating:** Intercepting breaking changes inside the API Lambda before invoking EventBridge completely eliminates downstream compute costs and downstream error log pollution.
4. **Hexagonal Architecture for Portability:** Abstracting storage and messaging behind domain ports allows the exact same business logic to run in milliseconds in local pytest runs and in production on AWS Lambda.

---

## 12. Known System Boundaries

* **Local Storage:** Local JSON storage is designed for local development and CI testing, not as a distributed multi-node production datastore.
* **Consumer Registration:** Downstream consumers must declare their field dependencies via `ConsumerContract` definitions. Unregistered consumers cannot be evaluated, triggering a conservative `REVIEW` decision.
* **Rule Scope:** The compatibility engine enforces 8 deterministic structural rules (`EVT001` through `EVT008`). Domain-specific business semantic validation requires custom rules.
* **AWS Serverless Target:** Cloud deployment is optimized for AWS Serverless (Lambda, DynamoDB, EventBridge). Containerized portable deployments (Docker) are intentionally deferred for future releases.

---

## 13. AI-Assisted Development Disclosure

In accordance with First Commit hackathon guidelines:

* **AI Tools Used:** Google Antigravity IDE and Gemini models.
* **Scope of Assistance:** Used as an interactive pair-programming assistant for boilerplate generation, test case scaffolding, documentation drafting, and UI design token refinement.
* **Engineering Ownership:** All architectural designs, domain models, compatibility algorithms, AWS SAM template definitions, security boundaries, and verification procedures were authored, reviewed, and validated by the team.
