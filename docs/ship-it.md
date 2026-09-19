# PrimeX EventGate — Ship It Track: Live AWS Architecture & Production Guide

## 1. Overview

The **Ship It** track evaluates genuine deployment, architectural rigor, serverless best practices, cost-consciousness, and live end-to-end evidence. PrimeX EventGate is fully deployed and operational in **AWS ap-south-1 (Mumbai)**.

```text
                                 AWS CLOUD INFRASTRUCTURE
 ┌─────────────────────────────────────────────────────────────────────────────────────────┐
 │                                                                                         │
 │   AWS Amplify Hosting ────────► Amazon API Gateway (HTTP API v2)                        │
 │   https://main.d1etyexqf0w3wz   https://ux8bwi3i8l.execute-api.ap-south-1.amazonaws.com │
 │   .amplifyapp.com                                 │                                     │
 │                                                   ▼                                     │
 │                                          AWS Lambda (EventGate)                         │
 │                                          Python 3.14 + FastAPI                          │
 │                                                   │                                     │
 │                                ┌──────────────────┴──────────────────┐                  │
 │                                ▼                                     ▼                  │
 │                       Amazon DynamoDB                      Amazon EventBridge           │
 │                       • EventContracts                     primex-eventgate-dev-bus     │
 │                       • ConsumerContracts                            │                  │
 │                                                            ┌─────────┼─────────┐        │
 │                                                            ▼         ▼         ▼        │
 │                                                         Billing  Inventory Analytics    │
 │                                                         Lambda    Lambda    Lambda      │
 │                                                            │         │         │        │
 │                                                            └─────────┼─────────┘        │
 │                                                                      ▼                  │
 │                                                            Amazon CloudWatch Logs       │
 └─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Production Endpoints & Verified Resources

| Resource | Value / Identifier | AWS Region | Role |
| :--- | :--- | :---: | :--- |
| **Frontend Console** | `https://main.d1etyexqf0w3wz.amplifyapp.com` | `ap-south-1` | AWS Amplify continuous deployment from GitHub `main` |
| **Enforcement API** | `https://ux8bwi3i8l.execute-api.ap-south-1.amazonaws.com` | `ap-south-1` | Amazon API Gateway HTTP API v2 |
| **CloudFormation Stack** | `primex-eventgate-dev` | `ap-south-1` | Declarative AWS SAM deployment stack |
| **EventBridge Bus** | `primex-eventgate-dev-bus` | `ap-south-1` | Custom broker routing approved event contracts |
| **EventBridge Rule** | `primex-eventgate-dev-order-placed-rule` | `ap-south-1` | Pattern matching `source: primex.orders` & `detail-type: OrderPlaced` |
| **DynamoDB Table 1** | `primex-eventgate-dev-event-contracts` | `ap-south-1` | Versioned producer event contracts (`HASH: eventType`, `RANGE: version`) |
| **DynamoDB Table 2** | `primex-eventgate-dev-consumer-contracts` | `ap-south-1` | Registered consumer contracts (`HASH: consumerId`, GSI `EventTypeIndex`) |
| **DynamoDB Table 3** | `primex-eventgate-dev-release-history` | `ap-south-1` | Correlated release audit trail (`HASH: recordId`, GSI `EventTypeIndex`) |
| **Core Lambda** | `primex-eventgate-dev-EventGateFunction` | `ap-south-1` | Python 3.14 runtime with FastAPI + Mangum |
| **Billing Consumer** | `primex-eventgate-dev-BillingConsumerFunction` | `ap-south-1` | Downstream billing demonstration consumer |
| **Inventory Consumer**| `primex-eventgate-dev-InventoryConsumerFunction` | `ap-south-1` | Downstream inventory demonstration consumer |
| **Analytics Consumer**| `primex-eventgate-dev-AnalyticsConsumerFunction` | `ap-south-1` | Downstream analytics demonstration consumer |

---

## 3. Serverless Architectural Rationale

### Why API Gateway HTTP API (v2)?
* **Cost Efficiency:** ~70% less expensive than REST APIs ($1.00/million requests vs $3.50/million).
* **Latency:** Sub-10ms overhead with native payload compression and configurable CORS.
* **Simplicity:** Clean direct proxy routing to AWS Lambda without heavyweight mapping templates.

### Why AWS Lambda (Python 3.14)?
* **Zero Idle Cost:** Scales to absolute zero when no release gating requests are active.
* **Fast Execution:** Python 3.14 provides optimized opcode dispatch and faster dictionary operations.
* **FastAPI + Mangum:** Clean ASGI architecture enabling identical code to run locally in development and in Lambda in production.

### Why Amazon DynamoDB (On-Demand, Three Tables, Zero Primary Scans)?
* **Single-Digit Millisecond Retrieval:** Fast key-value lookups provide immediate contract access during pre-publication gating.
* **`PAY_PER_REQUEST` Billing:** Zero minimum cost, no provisioned capacity management, automatic elastic scaling.
* **Access Patterns & Zero-Scan Strategy:**
  * **EventContractsTable:** Partition key `eventType` (String), Sort key `version` (Number).
    * `GetItem(Key={"eventType": "OrderPlaced", "version": 1})`
    * `Query(KeyConditionExpression=Key("eventType").eq("OrderPlaced"))`
    * `GetItem(Key={"eventType": "METADATA#CATALOG", "version": 0})` $\to$ Zero table scans for listing all registered event types.
  * **ConsumerContractsTable:** Partition key `consumerId` (String), GSI `EventTypeIndex` (`eventType` HASH, `consumerId` RANGE).
    * `GetItem(Key={"consumerId": "inventory-service"})`
    * `Query(IndexName="EventTypeIndex", KeyConditionExpression=Key("eventType").eq("OrderPlaced"))`
    * `GetItem(Key={"consumerId": "METADATA#CATALOG"})` $\to$ Zero table scans for consumer catalog discovery.
  * **ReleaseHistoryTable:** Partition key `recordId` (String), GSI `EventTypeIndex` (`eventType` HASH, `timestamp` RANGE).
    * `PutItem` / `UpdateItem` on `recordId = analysisId` (correlated 1-to-1).
    * `Query(IndexName="EventTypeIndex", KeyConditionExpression=Key("eventType").eq("OrderPlaced"))`

### Why Amazon EventBridge Custom Bus?
* **Decoupled Asynchronous Fan-Out:** Producers emit once; EventBridge delivers to multiple independent downstream consumer queues or Lambdas.
* **Target Isolation:** When EventGate intercepts a breaking change, zero events are emitted to the bus, preventing any compute invocation in downstream consumer microservices.

### Why No VPC / NAT Gateway?
* **Cost Consciousness:** An AWS NAT Gateway incurs ~$32/month per availability zone plus data transfer fees.
* **Public Service Parity:** API Gateway, DynamoDB, and EventBridge are fully managed AWS public endpoints communicating securely over HTTPS/TLS with IAM authentication. Keeping the Lambda outside a VPC eliminates NAT cost and cold-start ENI attachment latency while maintaining strong least-privilege IAM controls.

---

## 4. IAM Least Privilege Scope

EventGate's Lambda execution role grants strictly scoped access governed by AWS SAM:

```yaml
Policies:
  - DynamoDBReadPolicy:
      TableName: !Ref EventContractsTable
  - DynamoDBReadPolicy:
      TableName: !Ref ConsumerContractsTable
  - DynamoDBCrudPolicy:
      TableName: !Ref ReleaseHistoryTable
  - Statement:
      - Effect: Allow
        Action:
          - events:PutEvents
        Resource: !GetAtt EventBus.Arn
```

* **Zero Full-Admin Permissions:** No wildcard `*` on DynamoDB or EventBridge.
* **Scoped PutEvents:** Allowed ONLY to `arn:aws:events:ap-south-1:<account-id>:event-bus/primex-eventgate-dev-bus`.
* **Zero Credential Hardcoding:** Runtime credentials injected securely via Lambda execution role.

---

## 5. Failure & Enforcement Semantics

| Scenario | HTTP Status | Backend Action | EventBridge Called? | Downstream Impact |
| :--- | :---: | :--- | :---: | :--- |
| **Safe Evolution (`ALLOW`)** | **`200 OK`** | Schema validated $\to$ Consumers checked $\to$ `events:PutEvents` called | **YES** | 3 / 3 consumers invoked (Billing, Inventory, Analytics) |
| **Breaking Change (`BLOCK`)** | **`409 Conflict`** | Halts inside Lambda $\to$ Diagnoses violation $\to$ Returns HTTP 409 | **NO** | 0 / 3 consumers invoked. Zero downstream compute cost |
| **Risky Removal (`REVIEW`)** | **`409 Conflict`** | Halts inside Lambda $\to$ Flags dependency $\to$ Returns HTTP 409 | **NO** | 0 / 3 consumers invoked. Zero downstream compute cost |
| **Malformed Schema (`422`)** | **`422 Unprocessable`**| Halts before compatibility engine $\to$ Returns `INVALID_EVENT_PAYLOAD` | **NO** | 0 / 3 consumers invoked. Zero downstream compute cost |
| **Broker Outage (`503`)** | **`503 Unavailable`** | Catches `ClientError` from EventBridge $\to$ Returns `EVENTBRIDGE_UNAVAILABLE` | Attempted | Graceful error recovery reported to client |

---

## 6. Live AWS Smoke Test Evidence

Executed against the live AWS production stack via `scripts/aws_enforcement_smoke_test.py`:

```text
================================================================================
PrimeX EventGate — Live AWS Enforcement Smoke Test
Target API: https://ux8bwi3i8l.execute-api.ap-south-1.amazonaws.com
Region:     ap-south-1
================================================================================

[TEST 1] GET /health
  Status:  200 OK
  Payload: {"status": "ok", "service": "eventgate", "version": "0.1.0"}
  Outcome: PASS

[TEST 2] POST /api/v1/events/publish — Safe Addition (v1 -> v2)
  Status:  200 OK
  Decision:ALLOW (Severity: LOW)
  EventBridge Event ID: 90b4d45d-4f18-6c8c-1e64-e2216666ec71
  CloudWatch Consumer Invocations:
    - billing-service:   INVOKED (LogStream: 2026/09/18/[$LATEST]...)
    - inventory-service: INVOKED (LogStream: 2026/09/18/[$LATEST]...)
    - analytics-service: INVOKED (LogStream: 2026/09/18/[$LATEST]...)
  Outcome: PASS (3 / 3 Consumers Invoked)

[TEST 3] POST /api/v1/events/publish — Breaking Field Type (v1 -> v3)
  Status:  409 Conflict
  Decision:BLOCK (Severity: HIGH)
  Diagnosis: inventory-service expects shippingMethod as string, proposed object
  CloudWatch Consumer Invocations:
    - billing-service:   ZERO invocations observed
    - inventory-service: ZERO invocations observed
    - analytics-service: ZERO invocations observed
  Outcome: PASS (0 / 3 Consumers Invoked — Intercepted before PutEvents)

[TEST 4] POST /api/v1/events/publish — Risky Optional Removal (v1 -> v4)
  Status:  409 Conflict
  Decision:REVIEW (Severity: MEDIUM)
  Diagnosis: analytics-service depends on optional couponCode
  CloudWatch Consumer Invocations:
    - 0 invocations observed across all consumers
  Outcome: PASS (0 / 3 Consumers Invoked — Intercepted before PutEvents)

[TEST 5] POST /api/v1/events/publish — Invalid Payload (Missing orderId)
  Status:  422 Unprocessable Entity
  ErrorCode: INVALID_EVENT_PAYLOAD
  Outcome: PASS (Payload rejected before consumer analysis)
```
