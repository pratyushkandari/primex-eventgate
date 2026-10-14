# PrimeX EventGate — Engineering Standards & Quality Assurance
**Document Owner:** PrimeX Platform Engineering Team  
**Scope:** Architecture Standards, Code Quality, Verification, and Operational Discipline  

---

## 1. Architectural Principles

### 1.1 Clean Hexagonal Architecture (Ports & Adapters)
All platform code strictly adheres to the dependency inversion principle:
* **The Domain is Sovereign:** The domain package (`eventgate.domain`) contains pure Python business logic, immutable models (frozen dataclasses), and deterministic state machines. It imports nothing from FastAPI, Boto3, or external cloud SDKs.
* **Ports as Explicit Contracts:** Application services interact with repositories and event publishers exclusively through abstract base classes (`IPublisher`, `IEventContractRepository`, `IConsumerContractRepository`, `IReleaseReviewRepository`).
* **Interchangeable Adapters:** Storage and messaging adapters implement the ports. The exact same business logic runs against local JSON files in development/testing and Amazon DynamoDB / EventBridge in cloud environments.

### 1.2 Two-Tier Decision Separation
To prevent conflating technical impact with operational risk:
1. **Compatibility Evaluation:** A pure mathematical classification of schema deltas against declared consumer dependencies (`SAFE`, `RISK`, `BREAK`).
2. **Release Policy:** An environment-scoped operational rule determining the release action (`ALLOW`, `REVIEW`, `BLOCK`). A medium-risk change in `development` is non-blocking (with warning), while in `production` it mandates an engineering review.

---

## 2. Code Quality & Static Analysis Standards

### 2.1 Backend Standards (Python 3.12+)
* **Linter & Formatter:** Enforced via `ruff`.
  * Selected rules: `E` (Pycodestyle errors), `F` (Pyflakes), `I` (isort import ordering), `W` (Pycodestyle warnings), `UP` (pyupgrade modernization).
  * Line length: Strict 100-character line limit.
  * Formatting: Double-quote string formatting with deterministic trailing commas.
* **Type Safety:** Type hints enforced across all function signatures, arguments, and return types (`from __future__ import annotations`).
* **Zero Warnings Policy:** Zero warnings and zero errors required to pass pull request checks.

### 2.2 Frontend Standards (TypeScript 5.8+ / React 19)
* **Type System:** Strict TypeScript configuration (`strict: true`, `noImplicitAny: true`, `noUnusedLocals: true`).
* **Linter:** `oxlint` executing 116 production lint rules.
* **Runtime Schema Validation:** All network ingress and external API responses validated at the boundary using `Zod` schemas before propagating into state management or UI components.
* **Styling & CSS Architecture:** Tailwind CSS v4 design tokens, CSS custom properties for dark-theme palette harmonization, accessible contrast ratios, and responsive breakpoints.

---

## 3. Testing & Verification Standards

### 3.1 Test Coverage Mandate
* **Coverage Threshold:** Minimum **85.0%** branch coverage enforced by `pytest --cov=eventgate --cov-report=term-missing`. Current repository baseline: **91.54%** across 281 tests.
* **Test Isolation:** Unit tests run entirely in memory with mock or local filesystem repositories without network access or cloud credentials.
* **Property & Matrix Conformance:** Conformance suites (`test_policy_engine.py`) verify that the pure Python standard engine and formal AWS Cedar engine produce 100% identical decisions across the entire environment-by-severity matrix.

### 3.2 Frontend Test Suite
* **Framework:** `vitest` + React Testing Library + `@testing-library/jest-dom`.
* **Coverage Scope:** Component unit tests, custom hooks, command palette keyboard shortcuts, form validation states, and full workspace end-to-end user workflows.
* **Resilience:** Accessible fallback components tested when WebGL / ReactFlow canvas is unavailable.

---

## 4. Security & Operational Discipline

### 4.1 Principle of Least Privilege (PoLP)
* Every AWS Lambda function is assigned a dedicated IAM execution role with granular, resource-specific statements.
* No wildcard `*` permissions are granted on DynamoDB tables or EventBridge event buses.
* Data access statements explicitly list allowed API actions (`dynamodb:GetItem`, `dynamodb:Query`, `dynamodb:PutItem`).

### 4.2 Auditability & Request Tracing
* Every API request propagates or assigns a unique `X-Request-ID`.
* Release records capture:
  * `analysis_id`: UUID generated during pre-flight schema analysis.
  * `record_id`: Authoritative persistent audit record key.
  * `event_bridge_event_id`: Unique message ID returned by AWS upon successful publication.
  * `timestamp`: ISO-8601 UTC timestamp.
* Compliance reports (Markdown / JSON) are deterministically generated from immutable audit records for internal compliance and regulatory review.

---

## 5. Continuous Delivery & Gated Workflows

* Pull requests modifying contract files under `contracts/events/**` automatically trigger the GitHub Actions release gate ([.github/workflows/eventgate-contract-check.yml](../.github/workflows/eventgate-contract-check.yml)).
* Breaking contract changes are intercepted during CI, failing the pipeline and rendering a structured decision table in the GitHub Step Summary.
