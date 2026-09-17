# Enforcement & Gated Publishing (Phase 3)

EventGate moves beyond advisory compatibility reporting to **active cloud enforcement**. This document details the decision-to-enforcement mapping, two-phase payload-first validation pipeline, fail-closed guarantees, and error semantics.

---

## 1. Decision-to-Enforcement Mapping

Every event submitted to `POST /api/v1/events/publish` is subjected to the deterministic compatibility engine. The aggregate decision dictates whether the event is published to Amazon EventBridge or blocked at the boundary:

| Decision | Severity | HTTP Status | `published` | EventBridge Action | Consumer Invocations | Downstream Impact |
| :---: | :---: | :---: | :---: | :--- | :---: | :--- |
| **`ALLOW`** | `LOW` | **`200 OK`** | `true` | `events:PutEvents` called | **3** (`Billing`, `Inventory`, `Analytics`) | Event delivered safely |
| **`BLOCK`** | `HIGH` | **`409 Conflict`** | `false` | `PutEvents` **prevented** | **0** | Breaking change intercepted |
| **`REVIEW`** | `MEDIUM` | **`409 Conflict`** | `false` | `PutEvents` **prevented** | **0** | Risky change quarantined |

```text
                    POST /api/v1/events/publish
                               |
                               v
                  +-------------------------+
                  | Phase 1: Validate Event |
                  |    Payload Structure    |
                  +-------------------------+
                     /                   \
            (invalid)                     (valid)
               /                             \
              v                               v
       HTTP 422 Error           +-------------------------+
     INVALID_EVENT_PAYLOAD      |  Phase 2: Analyze All   |
                                |   Downstream Consumers  |
                                +-------------------------+
                                             |
                                 +-----------+-----------+
                                 |           |           |
                               ALLOW      REVIEW       BLOCK
                                 |           |           |
                                 v           v           v
                            HTTP 200     HTTP 409    HTTP 409
                            Published    Rejected    Rejected
                                 |           |           |
                                 v           v           v
                            EventBridge   0 Events    0 Events
                            Custom Bus    Published   Published
                                 |
                        +--------+--------+
                        |        |        |
                        v        v        v
                     Billing  Inventory Analytics
```

---

## 2. Two-Phase Validation Pipeline

### Phase 1: Payload Validation (`payload_validator.py`)
Before executing consumer analysis, EventGate validates the submitted event payload against the proposed schema:
1. **Required Fields:** All required fields declared in the proposed contract must be present.
2. **Type Checking:** Field values must match declared JSON primitive types (`string`, `number`, `integer`, `boolean`, `object`, `array`, `null`).
3. **Boolean vs Numeric Distinction:** Explicitly prevents Python `bool` (which is a subclass of `int`) from masquerading as a valid `integer` or `number`.
4. **Open-World Extensibility:** Extra fields not defined in the contract are permitted under open-world semantics.

If payload validation fails:
- Returns **`HTTP 422 Unprocessable Entity`**
- Error code: **`INVALID_EVENT_PAYLOAD`**
- Event analysis and EventBridge publishing are completely bypassed.

### Phase 2: Consumer Impact Analysis (`EventAnalysisService`)
Once the payload structure is verified, EventGate retrieves the baseline and proposed event contracts alongside all active consumer contracts for that event type:
1. Computes the field-level `ChangeSet` (added fields, removed fields, type changes, requiredness changes).
2. Runs the deterministic compatibility rules engine (`EVT001` through `EVT008`).
3. Determines consumer-level statuses (`SAFE`, `RISK`, `BREAK`).
4. Derives the aggregate decision:
   - Any `BREAK` $\to$ **`BLOCK`**
   - Any `RISK` $\to$ **`REVIEW`**
   - All `SAFE` $\to$ **`ALLOW`**

### Phase 3: Gated Publication (`EventPublishService`)
- If decision is `ALLOW`, calls `IEventPublisher.publish(...)`.
- If decision is `BLOCK` or `REVIEW`, returns an HTTP 409 response containing the full consumer findings, breaking fields, and decision reasons. `IEventPublisher` is never called.

---

## 3. Strict PutEvents Invariant & Fail-Closed Design

EventGate implements a **fail-closed** design philosophy:

1. **Strict PutEvents Invariant:**
   When publishing to EventBridge, AWS returns `FailedEntryCount` and an array of `Entries`. EventGate checks both conditions:
   ```python
   if failed_count > 0 or not entry.get("EventId"):
       raise EventPublishFailedError(f"EventBridge publication failed: {error_message}")
   ```
   Even if `FailedEntryCount == 0`, if AWS fails to return an `EventId`, the operation is treated as a critical failure and returns **`HTTP 503 Service Unavailable`** (`EVENT_PUBLISH_FAILED`).

2. **Negative-Path Invariant (Zero Downstream Receipt):**
   In the smoke test suite and real-world operation, when an event receives `BLOCK` or `REVIEW`:
   - The API Gateway returns `HTTP 409 Conflict`.
   - The consumer CloudWatch log groups are polled across the entire delivery window.
   - **PASS condition:** The test confirms zero occurrences of the `eventId` across all three consumer functions (`Billing`, `Inventory`, `Analytics`).
   - **FAIL condition:** If an event with that `eventId` appears in any consumer log, the test immediately fails.

---

## 4. End-to-End Traceability & Correlation

Every request carries a consistent correlation thread:
1. **`X-Request-ID`**: Propagated from HTTP headers (or auto-generated UUID) into:
   - Response headers (`X-Request-ID`)
   - Response JSON body (`requestId`)
   - EventGate structured Lambda execution log
   - EventBridge detail envelope (`requestId`)
   - Consumer Lambda structured CloudWatch execution log
2. **`eventId`**: Generated at the gate, passed inside the EventBridge envelope, and emitted in consumer execution logs:
   ```json
   {
     "level": "INFO",
     "message": "Consumer processed event successfully",
     "consumerId": "billing-service",
     "eventId": "evt-7a9b1c2d-3e4f-5678-90ab-cdef12345678",
     "eventType": "OrderPlaced",
     "version": 2,
     "requestId": "smoke-test-req-101"
   }
   ```
3. **`eventBridgeEventId`**: The native AWS EventBridge entry UUID returned by AWS `PutEvents` and included in `POST /api/v1/events/publish` `200 OK` responses.
