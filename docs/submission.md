# PrimeX EventGate — Technical Platform Brief
**Enterprise Event Contract Release-Control Platform**  
**Classification:** Distributed Systems Architecture & Governance Specification  

---

## 1. Executive Summary

**PrimeX EventGate** is a consumer-aware safety gate for event-driven architectures. It detects downstream consumer impact from event schema mutations and halts incompatible events before they propagate across the message broker.

* **Core Mission:** "You changed one thing. We tell you what breaks before it breaks."
* **System Function:** EventGate evaluates proposed event schema changes against declared downstream consumer dependency contracts, computes structural blast radius, applies environment release policy (via Python or formal AWS Cedar specs), and allows, reviews, or blocks event publication before broker ingress.

---

## 2. Problem Statement: The Isolated Schema Fallacy

In event-driven microservice architectures, producers evolve schemas independently. Traditional schema registries (e.g. Confluent Schema Registry, AWS Glue) evaluate schema backward-compatibility in isolation against prior producer schemas without cross-referencing downstream consumer dependencies.

When a producer alters a field type or removes an optional field:
1. The schema appears backward-compatible from the producer's isolated perspective.
2. The event is published to the central message broker.
3. Downstream consumer services crash during JSON deserialization or business processing because they relied upon the altered field.

**The Core Distinction:**
* Standard schema validation answers: *"Is this payload valid against the producer's schema?"*
* PrimeX EventGate answers: *"Which declared consumers are affected by this change, and what should happen to the release in this environment?"*

---

## 3. Target Audience & Ecosystem Fit

* **Platform Engineering & SRE Teams:** Enforcing organizational schema governance across enterprise event brokers (Kafka, EventBridge, RabbitMQ).
* **Distributed Microservice Developers:** Validating contract mutations during local development, pull request CI checks, and staging deployments.
* **Compliance & Audit Teams:** Maintaining an immutable, traceable audit trail of all schema releases and publication outcomes.

---

## 4. End-to-End Evaluation Flow

```text
Current Event Contract + Proposed Event Contract
                       ↓
         Deterministic Structural Diff
                       ↓
         Consumer Dependency Graph Analysis
                       ↓
              Compatibility Result
             (SAFE / RISK / BREAK)
                       ↓
               Severity Calculation
              (LOW / MEDIUM / HIGH)
                       ↓
            Environment Release Policy
       (production / staging / development)
                       ↓
               Authoritative Decision
              (ALLOW / REVIEW / BLOCK)
                       ↓
             Publish / Hold / Prevent
                       ↓
         Correlated Immutable Audit Record
```

---

## 5. Canonical Evolution Scenarios

Using the canonical `OrderPlaced` event contract fixtures:

1. **Safe Evolution (v1 $\to$ v2):** Adds optional `metadata` field.
   * Compatibility: `SAFE` (Severity: `LOW`)
   * Decision: `ALLOW` in all environments.
   * Action: Published to Amazon EventBridge. All registered consumer Lambdas (`Billing`, `Inventory`, `Analytics`) invoked.
2. **Breaking Change (v1 $\to$ v3):** Modifies `shippingMethod` from `string` to `object`.
   * Compatibility: `BREAK` (Severity: `HIGH`)
   * Affected Consumer: `inventory-service` (Rule: `EVT001_FIELD_TYPE_CHANGED`).
   * Decision: `BLOCK` in all environments.
   * Action: Publication intercepted inside Lambda. Zero broker calls. Consumers protected from failure.
3. **Risky Removal (v1 $\to$ v4):** Removes optional `couponCode` field.
   * Compatibility: `RISK` (Severity: `MEDIUM`)
   * Affected Consumer: `analytics-service` (Rule: `EVT006_OPTIONAL_FIELD_REMOVED`).
   * Decision: `REVIEW` in `production` and `staging` (held); `ALLOW` with warning in `development`.
   * Action: In production, publication is held pending review. In development, permitted with warnings.

---

## 6. Architecture & Implementation

* **Presentation Layer:** FastAPI with Mangum ASGI adapter running on AWS Lambda behind Amazon API Gateway HTTP API (v2).
* **Application Layer:** Hexagonal services orchestrating compatibility diffing, policy evaluation, gated publishing, and audit retrieval.
* **Domain Core:** Pure Python domain entities implemented as frozen dataclasses with zero framework or cloud SDK dependencies.
* **Persistence Layer:** Amazon DynamoDB using single-table design principles and Global Secondary Indexes (`EventTypeIndex`) for zero-scan lookups.
* **Messaging Layer:** Custom Amazon EventBridge bus routing approved events to consumer microservices.
* **Infrastructure as Code:** Declarative AWS Serverless Application Model (`template.yaml`).
* **Frontend Console:** React 19, TypeScript, Vite, Tailwind CSS v4, and `@xyflow/react` for interactive dependency topology visualization.

---

## 7. Key Capabilities & Interfaces

* **Control Console:** Interactive blast radius topology, PR-style schema diff viewer, live scenario runner, and release audit inspector.
* **Developer CLI (`eventgate`):** Offline and CI contract validation (`check`, `catalog`, `history`, `test`).
* **Continuous Integration:** GitHub Actions pull request diff analyzer ([scripts/ci_contract_diff.py](../scripts/ci_contract_diff.py)) posting structured markdown summaries to PRs.
* **Pluggable Policy Engines:** Deterministic standard Python engine and formal AWS Cedar engine (`cedarpy`).
* **Compliance Reporting:** Exportable audit reports in Markdown and JSON formats.

---

## 8. Verification & Conformance

| Quality Dimension | Verification Tool | Result |
| :--- | :--- | :---: |
| **Backend Tests** | `pytest --cov=eventgate` | **281 passed**, **91.54% coverage** |
| **Frontend Tests** | `vitest run` | **114 passed** across 25 suites |
| **Python Static Analysis** | `ruff check` & `ruff format --check` | **0 errors, all 90 files formatted** |
| **Frontend Static Analysis** | `oxlint` & `tsc -b` | **0 errors, 0 warnings across 66 files** |
| **Cloud Deployment** | Automated smoke tests in `ap-south-1` | **100% pass across all endpoints** |

---

## 9. Security & Least Privilege

* **IAM Scoping:** Cloud compute execution roles restricted strictly to specific DynamoDB table ARNs and custom EventBridge bus ARN. Zero wildcard permissions on data resources.
* **Boundary Hardening:** Ingress payloads validated before reaching domain services; invalid payloads rejected with HTTP 422.
* **Audit Correlation:** Pre-flight `analysis_id` serves as authoritative `record_id`, linking request IDs, timestamps, and broker event IDs in an immutable audit document.

---

## 10. Architectural References

* 🏛️ [System Design Specification](system-design.md) — Comprehensive distributed systems design, data access patterns, and latency budgets.
* ⚖️ [Engineering Standards & QA](engineering-standards.md) — Architecture principles, static analysis standards, and test coverage mandates.
* 📋 [Architectural Decision Records (ADRs)](decisions.md) — Context, rationale, and trade-offs for 10 foundational technical decisions.
* 📡 [API Reference](api.md) — Complete REST API contract, request/response schemas, and error envelopes.
* 💻 [CLI Reference Guide](cli.md) — Developer command-line interface documentation.
