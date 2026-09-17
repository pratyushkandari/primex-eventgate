# EventGate Domain Model Specification

The EventGate domain layer (`backend/src/eventgate/domain/`) encapsulates the core business logic. All models are implemented as plain frozen Python dataclasses (`@dataclass(frozen=True)`), providing shallow immutability against attribute reassignment without framework coupling.

---

## 1. Domain Entities & Value Objects

### 1.1 `EventField`
Represents an individual field specification within a producer event contract.

- **Attributes:**
  - `name: str` — Field identifier (non-empty).
  - `type: str` — Data type (`string`, `number`, `integer`, `boolean`, `object`, `array`, `null`).
  - `required: bool` — Whether the field must be present in published events.
- **Validation:** Enforces non-empty name and membership in `SUPPORTED_FIELD_TYPES`.

### 1.2 `EventContract`
Represents a versioned schema contract published by an event producer.

- **Attributes:**
  - `event_type: str` — Event identifier (e.g. `OrderPlaced`).
  - `version: int` — Contract version number ($\ge 1$).
  - `fields: dict[str, EventField]` — Mapping of field names to field specifications.

### 1.3 `ConsumerField`
Represents a field expectation registered by a downstream consumer.

- **Attributes:**
  - `name: str` — Field identifier (non-empty).
  - `type: str` — Expected data type.
  - `required: bool` — Whether the consumer application requires this field to function.

### 1.4 `ConsumerContract`
Represents the expectations and schema dependencies of an active downstream consumer.

- **Attributes:**
  - `consumer_id: str` — Unique consumer application ID (e.g. `billing-service`).
  - `event_type: str` — The event type consumed.
  - `expected_fields: dict[str, ConsumerField]` — Fields declared and consumed by this application.

### 1.5 `TypeChange` & `RequirednessChange`
Value objects recording field-level differences between two event contract versions.

- **`TypeChange`:** `field: str`, `from_type: str`, `to_type: str`
- **`RequirednessChange`:** `field: str`, `from_required: bool`, `to_required: bool`

### 1.6 `ChangeSet`
Represents the normalized structural diff between two event contract versions.

- **Attributes:**
  - `added_fields: list[str]` — Lexically sorted list of field names added in proposed contract.
  - `removed_fields: list[str]` — Lexically sorted list of field names removed from current contract.
  - `type_changes: list[TypeChange]` — List of field type transitions.
  - `requiredness_changes: list[RequirednessChange]` — List of requiredness transitions.
- **Property:** `has_changes: bool` — True if any difference exists.

### 1.7 `Finding`
A consumer-specific compatibility diagnostic answering: *"Is this change safe for this specific consumer?"*

- **Attributes:**
  - `consumer_id: str` — Consumer identifier.
  - `status: CompatibilityStatus` — Enum value (`SAFE`, `RISK`, `BREAK`).
  - `rule_id: str` — Compatibility rule code (e.g. `EVT001_FIELD_TYPE_CHANGED`).
  - `field: str | None` — Target field name, or `"*"` if consumer-wide.
  - `expected_type: str | None` — Consumer's expected type.
  - `proposed_type: str | None` — Proposed contract's type.
  - `severity: Severity` — Diagnostic severity (`LOW`, `MEDIUM`, `HIGH`).
  - `reason: str` — Human-readable explanatory diagnostic message.

### 1.8 `AnalysisResult`
The top-level entity constructed and returned upon evaluating a proposed schema change across all active consumers.

- **Attributes:**
  - `analysis_id: str` — UUID identifying the evaluation execution.
  - `event_type: str` — Target event name.
  - `current_version: int` — Baseline contract version.
  - `proposed_version: int` — Proposed contract version.
  - `change_set: ChangeSet` — The producer-level schema diff.
  - `findings: list[Finding]` — List of all consumer-specific findings.
  - `decision: Decision` — Aggregate decision (`ALLOW`, `REVIEW`, `BLOCK`).
  - `severity: Severity` — Overall risk severity (`LOW`, `MEDIUM`, `HIGH`).
  - `summary: str` — Executive summary string.
  - `timestamp: datetime` — UTC execution timestamp.
  - `request_id: str | None` — Correlation identifier.

---

## 2. Domain Enumerations (`StrEnum`)

```python
class CompatibilityStatus(StrEnum):
    SAFE = "SAFE"
    RISK = "RISK"
    BREAK = "BREAK"

class Decision(StrEnum):
    ALLOW = "ALLOW"
    REVIEW = "REVIEW"
    BLOCK = "BLOCK"

class Severity(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
```

---

## 3. Entity Relationships Diagram

```text
       +--------------------+ 1
       |   EventContract    |-----------------+
       +--------------------+                 |
                 | 1                          |
                 |                            v
                 | *                   +-------------+
                 v                     |  ChangeSet  |
          +--------------+             +-------------+
          |  EventField  |                    | 1
          +--------------+                    |
                                              v
       +--------------------+ 1         +------------------+
       |  ConsumerContract  |---------->|  AnalysisResult  |
       +--------------------+           +------------------+
                 | 1                          | 1
                 |                            |
                 v *                          v *
         +---------------+              +-------------+
         | ConsumerField |              |   Finding   |
         +---------------+              +-------------+
```
