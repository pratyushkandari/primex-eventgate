# EventGate Architectural Decision Records (ADRs)

This document records the foundational architectural decisions implemented during Phase 1 of EventGate.

---

## ADR-001: Pure Python Domain Layer with Frozen Dataclasses

- **Context:** EventGate evaluates schema compatibility for event-driven systems. We needed domain models to represent event schemas, consumer dependencies, diffs, and findings.
- **Decision:** Implement all domain models as plain Python dataclasses decorated with `@dataclass(frozen=True)`. Zero imports from FastAPI, Pydantic, or cloud SDKs are permitted within `eventgate.domain.*`.
- **Consequences:**
  - Provides shallow immutability against accidental field reassignment.
  - Ensures domain logic is 100% testable in under 1 second without network, mocks, or framework overhead.
  - Decouples core business rules from HTTP frameworks or database engines.

---

## ADR-002: Repository Ports and Adapters (Hexagonal Architecture)

- **Context:** The application service needs to load event contracts and consumer contracts. In Phase 1 these reside on disk, while Phase 2 introduces cloud persistence (DynamoDB).
- **Decision:** Define abstract interfaces (`IEventContractRepository`, `IConsumerContractRepository`) as ports, and implement file-based adapters (`JsonEventContractRepository`, `JsonConsumerContractRepository`).
- **Consequences:**
  - `EventAnalysisService` depends strictly on the interface abstractions.
  - Migrating to DynamoDB or PostgreSQL requires authoring a new adapter class without changing any application orchestration or domain logic.

---

## ADR-003: Local JSON Contract Storage for Phase 1

- **Context:** We needed a reliable contract storage strategy for local development, CI/CD, and regression testing without requiring cloud infrastructure.
- **Decision:** Store versioned contracts as JSON files under `contracts/events/<event_type>/` and `contracts/consumers/`.
- **Consequences:**
  - Clean human-readable JSON files can be version-controlled in Git.
  - No database setup or docker-compose required to run tests or local demos.
  - Establishes canonical test fixtures (`OrderPlaced` v1, v2-safe, v3-breaking, v4-risk).

---

## ADR-004: Deterministic Compatibility Engine

- **Context:** Schema validation tools often evaluate producer schemas in isolation (e.g. JSON Schema validation), missing downstream consumer breakage.
- **Decision:** Implement a deterministic `CompatibilityEngine` that computes structural diffs (`ChangeSet`) and evaluates compatibility per consumer using an explicit type matrix and rule catalog.
- **Consequences:**
  - Deterministic: Identical inputs always produce identical findings and decisions.
  - Explicit widening: `integer` $\to$ `number` is supported; unknown or unlisted type conversions evaluate to incompatible.

---

## ADR-005: Strict Consumer Scoping

- **Context:** In large event topologies, events contain dozens of fields. If a producer removes or alters a field that consumer `A` does not consume, consumer `A` should not break or alert.
- **Decision:** Isolate evaluations strictly to fields declared in each consumer's `ConsumerContract`.
- **Consequences:**
  - Unrelated schema changes evaluate to `SAFE` with rule `EVT008_CONSUMER_UNAFFECTED`.
  - Eliminates alert fatigue and false positive blocking in production event streams.

---

## ADR-006: Deterministic Rule Precedence & Finding Deduplication

- **Context:** Multiple rules could apply to the same consumer and field (for instance, a field simultaneously changing type and requiredness, or a missing required field).
- **Decision:** Codify an explicit `RULE_PRECEDENCE` hierarchy and deduplicate findings by `(consumer_id, field)`:
  1. `EVT001_FIELD_TYPE_CHANGED` (Type mismatch is fatal)
  2. `EVT003_CONSUMER_REQUIRED_FIELD_MISSING` (Consumer required field missing)
  3. `EVT002_REQUIRED_FIELD_REMOVED` (Producer removed required field)
  4. `EVT004_REQUIREDNESS_CHANGED` (Requiredness altered)
  5. `EVT007_UNSUPPORTED_CHANGE` (Unsupported change)
  6. `EVT006_OPTIONAL_FIELD_REMOVED` (Optional field removed - RISK)
  7. `EVT005_OPTIONAL_FIELD_ADDED` (Optional field added - SAFE)
  8. `EVT008_CONSUMER_UNAFFECTED` (Consumer unaffected - SAFE)
- **Consequences:**
  - Exactly one primary finding is emitted per consumer/field pair.
  - Finding selection is governed by explicit rank rather than arbitrary loop execution order.

---

## ADR-007: Conservative Zero-Consumer REVIEW Policy

- **Context:** When an event schema evolves but no consumer contracts are registered in the repository, what decision should be rendered?
- **Decision:** Evaluate empty consumer sets to `Decision.REVIEW` (Severity: `MEDIUM`) with finding `EVT009_EMPTY_CONSUMERS`, rather than blindly returning `ALLOW`.
- **Consequences:**
  - Prevents silent schema evolution on unmonitored or newly introduced events.
  - Prompts operations teams to register consumer contracts before automated publishing.
