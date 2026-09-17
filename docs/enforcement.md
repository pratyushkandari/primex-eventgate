# Enforcement & Gated Publishing (Phase 3)

EventGate moves beyond advisory compatibility reporting to **active cloud enforcement**. Rather than merely reporting compatibility findings, EventGate acts as an authoritative publication gate at the cloud boundary, preventing breaking schema changes from ever propagating to downstream consumers.

---

## 1. Decision-to-Enforcement Mapping

Every event submitted to `POST /api/v1/events/publish` is subjected to the deterministic compatibility engine. The aggregate decision dictates transport behavior:

| Decision | Severity | HTTP Status | `published` | EventBridge Action | Consumer Invocations | Downstream Impact |
| :---: | :---: | :---: | :---: | :--- | :---: | :--- |
| **`ALLOW`** | `LOW` | **`200 OK`** | `true` | EventBridge publication permitted | **3** (`Billing`, `Inventory`, `Analytics`) | Downstream consumers receive event |
| **`BLOCK`** | `HIGH` | **`409 Conflict`** | `false` | **EventBridge publication is prevented** | **0** | Zero downstream consumer delivery |
| **`REVIEW`** | `MEDIUM` | **`409 Conflict`** | `false` | **EventBridge publication is prevented pending future review** | **0** | Zero downstream consumer delivery |

---

## 2. Exact Orchestration Sequence

Event publication execution follows a strict 8-step pipeline:

```text
Producer Request (POST /api/v1/events/publish)
       │
       ▼
 1. Generate eventId (UUIDv4)
       │
       ▼
 2. Load Proposed Contract from DynamoDB / local repo
       │
       ▼
 3. Validate Event Payload Schema (payload_validator)
       │
       ├─► (Invalid Payload) ─────────────────────────► Return HTTP 422 (INVALID_EVENT_PAYLOAD)
       │                                                [Transport Bypassed]
       ▼ (Valid Payload)
 4. Analyze Downstream Consumer Impact (EventAnalysisService)
       │  - Compute field-level ChangeSet
       │  - Evaluate compatibility rules (EVT001 - EVT008)
       ▼
 5. Aggregate Decision (ALLOW / REVIEW / BLOCK)
       │
       ├─► (BLOCK)  ──────────────────────────────────► 7. Do NOT publish -> Return HTTP 409
       ├─► (REVIEW) ──────────────────────────────────► 7. Do NOT publish -> Return HTTP 409
       ▼ (ALLOW)
 6. Publish to Amazon EventBridge (EventBridgeEventPublisher.PutEvents)
       │
       ▼
 8. Return Structured Result (PublishResponse)
```

### Safety Invariants
1. **Publisher Never Called on Rejection:** The event publisher is never invoked if payload validation fails, or if the consumer analysis decision is `BLOCK` or `REVIEW`.
2. **Payload-First Ordering:** Payload validation occurs **before** any consumer contract querying or rule computation. A producer sending malformed data cannot consume engine resources or reach transport.
3. **Strict PutEvents Invariant:** When publishing to Amazon EventBridge, AWS returns `FailedEntryCount` and an array of `Entries`. EventGate enforces that:
   ```python
   if failed_count > 0 or not entry.get("EventId"):
       raise EventPublishFailedError(f"EventBridge publication failed: {error_message}")
   ```
   A `PutEvents` response that lacks a valid `EventId` is treated as a critical publishing failure and returns **`HTTP 503 Service Unavailable`** (`EVENT_PUBLISH_FAILED`).

---

## 3. Verified Live AWS Enforcement Evidence

The enforcement loop was verified against the live AWS stack (`primex-eventgate-dev` in `ap-south-1`):

| Test Stage | Scenario | Verified Event ID | EventBridge EventId | Consumer Log Receipt | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **Health Check** | `GET /health` | — | — | — | ✅ PASS (`200 OK`) |
| **Scenario A** | v1 $\to$ v2 (`ALLOW`) | `4d22c323-2506-42ec-af22-8ac6ed99e18b` | `a983ef0d-1ffa-fe94-a3be-012aba52c883` | Billing: YES<br/>Inventory: YES<br/>Analytics: YES | ✅ PASS (`200 OK`) |
| **Scenario B** | v1 $\to$ v3 (`BLOCK`) | `8a4cafba-f9a6-48b1-af5b-57cb397e3d43` | `None` (Prevented) | Billing: NO<br/>Inventory: NO<br/>Analytics: NO | ✅ PASS (`409 Conflict`) |
| **Scenario C** | v1 $\to$ v4 (`REVIEW`) | `f8705a9f-63cd-4194-be22-0869fe01d5b6` | `None` (Prevented) | Billing: NO<br/>Inventory: NO<br/>Analytics: NO | ✅ PASS (`409 Conflict`) |
| **Malformed Payload** | Missing required `orderId` | — | `None` (Bypassed) | Billing: NO<br/>Inventory: NO<br/>Analytics: NO | ✅ PASS (`422 Unproc`) |

### Negative-Path Verification (Confirmed Absence)
In Scenarios B and C, the live smoke test script actively polls the CloudWatch log groups for all three consumer Lambdas across a 15-second observation window:
- If the tested `eventId` is recorded in any consumer log, the test immediately **fails**.
- Expiration of the polling window with zero occurrences of `eventId` provides empirical proof of **zero downstream consumer delivery**.

---

## 4. End-to-End Correlation Thread

Each publication request establishes a complete correlation chain across AWS services:

1. **`X-Request-ID`**: Propagates across HTTP headers, API Gateway access logs, EventGate Lambda execution logs, EventBridge detail payload, and consumer Lambda execution logs.
2. **`eventId`**: UUID generated by EventGate, returned in the HTTP response, embedded in the EventBridge event detail envelope, and recorded in consumer execution receipts.
3. **`eventBridgeEventId`**: Native AWS EventBridge event identifier returned by AWS on successful ingestion.
