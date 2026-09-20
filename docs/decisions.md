# PrimeX EventGate — Engineering Decision Records (ADRs)

This document records the foundational architectural decisions governing the design, boundaries, and operational characteristics of PrimeX EventGate.

---

## ADR-001: FastAPI on AWS Lambda via Mangum

* **Context:** The platform requires an HTTP API for schema evaluation, gated publishing, catalog exploration, and audit retrieval. The service must support both zero-idle-cost cloud deployment and lightweight, instant local developer execution.
* **Decision:** Implement the API layer using FastAPI (ASGI) packaged for AWS Lambda execution via the Mangum adapter.
* **Reason:** FastAPI provides high-performance asynchronous request handling, automatic OpenAPI schema generation, dependency injection, and Pydantic model validation. Mangum translates AWS API Gateway v2 HTTP events into standard ASGI scope dictionaries without modifying route handlers. The identical application instance runs locally under Uvicorn and in AWS Lambda.
* **Trade-off:** Lambda cold starts can introduce small initialization latency on first invocation compared to a long-running container or VM, but idle operational cost is zero and scaling is fully managed.

---

## ADR-002: Amazon DynamoDB for Contract and Release History Storage

* **Context:** The service needs to persist versioned event contracts, registered consumer contracts, and immutable release audit records with low latency and zero operational maintenance.
* **Decision:** Use Amazon DynamoDB with `PAY_PER_REQUEST` billing mode and three dedicated tables: `event-contracts`, `consumer-contracts`, and `release-history`.
* **Reason:** DynamoDB provides single-digit millisecond read/write latency, seamless autoscaling, and predictable key-based access patterns. Catalog queries use deterministic composite keys (`PK=METADATA#CATALOG`) and Global Secondary Indexes (`EventTypeIndex`), eliminating unbounded table scans.
* **Trade-off:** DynamoDB does not provide multi-table relational joins or arbitrary SQL querying. Access patterns must be modeled explicitly around primary keys and GSIs.

---

## ADR-003: Amazon EventBridge for Approved Event Publication

* **Context:** Gated event publishing requires routing approved events to downstream consumer microservices without coupling EventGate to specific consumer endpoints or transports.
* **Decision:** Route all permitted events to an Amazon EventBridge custom event bus (`primex-eventgate-${Environment}-bus`).
* **Reason:** EventBridge offers native asynchronous fan-out, declarative content filtering rules, integration with AWS Lambda targets, and built-in dead-letter queues. Gating happens upstream: when EventGate detects an incompatible change, `events:PutEvents` is never called, preventing compute execution across all downstream subscribers.
* **Trade-off:** Event publication is tied to the AWS messaging ecosystem in cloud mode. For non-AWS environments, an abstraction layer is required.

---

## ADR-004: Deterministic Compatibility Rules over Probabilistic or LLM Evaluation

* **Context:** Contract compatibility evaluation in mission-critical event pipelines must be reliable, auditable, and reproducible across CI, CLI, and production environments.
* **Decision:** Implement an explicit, deterministic rule engine (`CompatibilityEngine`) operating on structural schema diffs with an explicit rule precedence hierarchy (`EVT001` through `EVT008`).
* **Reason:** Release gates protect production systems from outages. Probabilistic models or LLMs introduce non-determinism, hallucinations, latency, and unpredictable edge-case behavior. A deterministic rule engine guarantees that identical contract pairs always yield identical findings and decisions.
* **Trade-off:** Schema evolution rules must be explicitly codified. Complex domain-specific payload transformations that fall outside structural type rules require custom rule implementations.

---

## ADR-005: Explicit Downstream Consumer Impact Modeling

* **Context:** Traditional schema registries evaluate schema backward-compatibility in isolation (producer-only), checking whether a new schema satisfies generic JSON Schema or Avro rules.
* **Decision:** Explicitly model downstream consumers via versioned `ConsumerContract` definitions declaring the specific fields and types each consumer relies upon.
* **Reason:** An event producer adding or removing a field may not break all consumers. If producer removes field `X` but only consumer `A` uses `X`, consumer `B` remains unaffected. Isolating blast radius to declared dependencies eliminates false alarms, informs affected teams precisely, and prevents unnecessary release blockage.
* **Trade-off:** Downstream consumers must declare and maintain their dependency contracts. Unregistered consumers cannot be protected by the gate (which EventGate flags as `REVIEW` with medium severity).

---

## ADR-006: Separation of Compatibility Evaluation and Environment Release Policy

* **Context:** The technical impact of a schema change (what broke) is an objective mathematical fact, whereas the release action (whether to deploy) depends on organizational governance, risk tolerance, and deployment stage.
* **Decision:** Strictly separate Compatibility Analysis (`SAFE` / `RISK` / `BREAK` with `LOW` / `MEDIUM` / `HIGH` severity) from Release Policy (`ALLOW` / `REVIEW` / `BLOCK`).
* **Reason:** Coupling impact to action prevents environment-specific flexibility. For example, removing an optional field is a medium-risk change. In `production` and `staging`, governance demands manual review (`REVIEW`), whereas in `development`, engineers need rapid iteration (`ALLOW with warning`). Decoupling allows pluggable policy engines (pure Python standard engine or formal AWS Cedar specifications) without altering the compatibility engine.
* **Trade-off:** Requires a two-phase evaluation pipeline and an additional conceptual layer in API models and UI representations.

---

## ADR-007: Repository and Publisher Abstractions for Local and Cloud Parity

* **Context:** Developers need to run tests, execute CLI checks, and test the frontend locally without an AWS account, cloud credentials, or internet connectivity.
* **Decision:** Define abstract ports (`IEventContractRepository`, `IConsumerContractRepository`, `IReleaseReviewRepository`, `IEventPublisher`) and implement both local adapters (filesystem JSON, in-memory sink) and cloud adapters (DynamoDB, EventBridge).
* **Reason:** Hexagonal architecture enables zero-credential local development, rapid unit testing (< 5 seconds for 279 tests), and automated CI pipelines. The exact same business logic executes whether running against local JSON fixtures or AWS cloud infrastructure.
* **Trade-off:** Requires maintaining interface parity across both storage and publisher implementations, including handling differences in persistence semantics (filesystem vs DynamoDB).

---

## ADR-008: Correlated Release History Traceability

* **Context:** Auditing event releases requires correlating the pre-publication compatibility analysis with the actual publication outcome, runtime request metadata, and broker event identifiers.
* **Decision:** Use the `analysis_id` as the authoritative `record_id` in `ReleaseRecord`, linking pre-flight checks, policy outcomes, publication timestamps, and `EventBridgeEventId` in a single persistent audit document.
* **Reason:** Ensures end-to-end traceability from developer pull request to cloud broker delivery. Operations teams can inspect any historical release record, regenerate deterministic compliance reports, and prove whether a published event adhered to organizational release policy.
* **Trade-off:** The publish endpoint must accept and validate the prior `analysis_id` to link records, or perform an integrated analyze-and-publish workflow in a single request.

---

## ADR-009: AWS Serverless Application Model (SAM) for Declarative Infrastructure

* **Context:** Infrastructure provisioning, IAM role definitions, API Gateway integrations, and deployment automation must be version-controlled, auditable, and repeatable.
* **Decision:** Define all AWS infrastructure in a single declarative `template.yaml` using AWS SAM (Serverless Application Model).
* **Reason:** SAM provides shorthand syntax for Lambda, API Gateway HTTP APIs, DynamoDB tables, and EventBridge buses while compiling into native AWS CloudFormation. It enables declarative IAM least-privilege scoping, linting via `sam validate --lint`, packaging via `sam build`, and automated parameter overrides per environment tier.
* **Trade-off:** Deployment is tied to CloudFormation mechanisms, which can be slower than lightweight imperative scripts during initial stack provisioning.

---

## ADR-010: Intentional Deferral of Docker and Containerized Runtimes

* **Context:** Modern projects often default to containerization (Docker, docker-compose, Kubernetes) for local development and deployment.
* **Decision:** Intentionally defer Docker and container-based deployment for the current release. Provide native Python virtual environments for local development and native AWS Lambda zip packaging for cloud deployment.
* **Reason:** EventGate's domain engine has zero external binary dependencies. Native Python execution starts in milliseconds, requires no daemon processes, avoids Docker Desktop licensing and virtualization overhead, and simplifies CI pipelines. AWS Lambda native zip deployment minimizes packaging complexity and maximizes cold-start efficiency.
* **Trade-off:** Local emulation of the complete AWS stack (e.g. via LocalStack containerization or `sam local start-api`) requires the developer to run Docker on demand as an optional prerequisite rather than an enforced project default.
