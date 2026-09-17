# EventGate API Reference

EventGate exposes a lightweight HTTP JSON interface with camelCase field serialization and stable structured error response envelopes.

---

## 1. Endpoints Overview

| Method | Path | Purpose | Transport Side Effects |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Service health status check | None (pure health probe) |
| `POST` | `/api/v1/analyze` | Advisory compatibility analysis | None (pure analysis, no publishing) |
| `POST` | `/api/v1/events/publish` | Payload validation, compatibility analysis, and gated EventBridge publishing | Publishes to EventBridge **only** on `ALLOW` |

> [!NOTE]
> **Advisory Invariant:** `GET /health` and `POST /api/v1/analyze` continue to function exactly as originally designed. They remain pure, read-only analysis endpoints with zero event bus publishing side effects.

---

## 2. Endpoint Details

### 2.1 Health Check
Returns operational service status and running version.

- **Method:** `GET`
- **Path:** `/health`
- **Headers:** None required
- **Success Response (`200 OK`):**
```json
{
  "status": "ok",
  "service": "eventgate",
  "version": "0.1.0"
}
```

---

### 2.2 Event Compatibility Analysis (Advisory)
Evaluates proposed schema evolution against active downstream consumer contracts without publishing.

- **Method:** `POST`
- **Path:** `/api/v1/analyze`
- **Headers:**
  - `Content-Type: application/json`
  - `X-Request-ID: <string>` *(optional correlation ID)*
- **Request Body:**
```json
{
  "eventType": "OrderPlaced",
  "currentVersion": 1,
  "proposedVersion": 2
}
```

#### Request Fields
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `eventType` | `string` | Yes | Target event name (e.g. `OrderPlaced`) |
| `currentVersion` | `integer` | Yes | Baseline version number ($\ge 1$) |
| `proposedVersion` | `integer` | Yes | Proposed version number ($\ge 1$) |

---

### 2.3 Event Publishing & Cloud Enforcement
Validates the event payload against the proposed contract, runs downstream consumer compatibility analysis, and publishes to Amazon EventBridge **only if the decision is `ALLOW`**.

> [!IMPORTANT]
> **Payload-First Validation Order:** EventGate validates the submitted `payload` against the proposed version's contract **before** executing consumer compatibility analysis. If the payload is malformed or invalid, the request fails immediately with HTTP 422 (`INVALID_EVENT_PAYLOAD`), completely bypassing consumer analysis and EventBridge transport.

- **Method:** `POST`
- **Path:** `/api/v1/events/publish`
- **Headers:**
  - `Content-Type: application/json`
  - `X-Request-ID: <string>` *(optional correlation ID)*
- **Request Body:**
```json
{
  "eventType": "OrderPlaced",
  "currentVersion": 1,
  "proposedVersion": 2,
  "payload": {
    "orderId": "O1001",
    "amount": 500,
    "items": [],
    "shippingMethod": "standard",
    "couponCode": "SAVE10"
  }
}
```

#### Request Fields
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `eventType` | `string` | Yes | Target event name (e.g. `OrderPlaced`) |
| `currentVersion` | `integer` | Yes | Baseline version number ($\ge 1$) |
| `proposedVersion` | `integer` | Yes | Proposed version number ($\ge 1$) |
| `payload` | `object` | Yes | Domain event payload conforming to the proposed version contract |

---

## 3. Publishing Response Semantics

### 3.1 Allowed & Published (`ALLOW`)
When all consumers are compatible (`decision: "ALLOW"`):
- **HTTP Status:** `200 OK`
- **`published`:** `true`
- **`eventBridgeEventId`:** Present (AWS EventBridge entry UUID returned by `PutEvents`)
- **Transport Behavior:** Event published to custom EventBridge bus (`primex-eventgate-dev-bus`), fanning out to subscribed consumer Lambdas.

```json
{
  "eventId": "4d22c323-2506-42ec-af22-8ac6ed99e18b",
  "published": true,
  "decision": "ALLOW",
  "severity": "LOW",
  "eventBridgeEventId": "a983ef0d-1ffa-fe94-a3be-012aba52c883",
  "analysis": {
    "analysisId": "197ada2a-5e37-4028-9c08-56af25fed6f4",
    "eventType": "OrderPlaced",
    "currentVersion": 1,
    "proposedVersion": 2,
    "changeSet": {
      "addedFields": ["metadata"],
      "removedFields": [],
      "typeChanges": [],
      "requirednessChanges": []
    },
    "findings": [
      {
        "consumerId": "billing-service",
        "status": "SAFE",
        "ruleId": "EVT005_OPTIONAL_FIELD_ADDED",
        "field": "*",
        "expectedType": null,
        "proposedType": null,
        "severity": "LOW",
        "reason": "Billing Service is not affected by the proposed changes."
      },
      {
        "consumerId": "inventory-service",
        "status": "SAFE",
        "ruleId": "EVT005_OPTIONAL_FIELD_ADDED",
        "field": "*",
        "expectedType": null,
        "proposedType": null,
        "severity": "LOW",
        "reason": "Inventory Service is not affected by the proposed changes."
      },
      {
        "consumerId": "analytics-service",
        "status": "SAFE",
        "ruleId": "EVT005_OPTIONAL_FIELD_ADDED",
        "field": "*",
        "expectedType": null,
        "proposedType": null,
        "severity": "LOW",
        "reason": "Analytics Service is not affected by the proposed changes."
      }
    ],
    "decision": "ALLOW",
    "severity": "LOW",
    "summary": "All 3 consumers are safe with the proposed event change.",
    "timestamp": "2026-09-18T01:15:30.123456Z",
    "requestId": "smoke-test-req-allow"
  }
}
```

---

### 3.2 Breaking Change Blocked (`BLOCK`)
When a consumer experiences a breaking change (`decision: "BLOCK"`):
- **HTTP Status:** `409 Conflict`
- **`published`:** `false`
- **`eventBridgeEventId`:** `null`
- **Transport Behavior:** **EventBridge publication is prevented.** Zero downstream consumer delivery.

```json
{
  "eventId": "8a4cafba-f9a6-48b1-af5b-57cb397e3d43",
  "published": false,
  "decision": "BLOCK",
  "severity": "HIGH",
  "eventBridgeEventId": null,
  "analysis": {
    "analysisId": "fa9d2b78-b11c-4b47-8a19-4841a1005a8b",
    "eventType": "OrderPlaced",
    "currentVersion": 1,
    "proposedVersion": 3,
    "changeSet": {
      "addedFields": [],
      "removedFields": [],
      "typeChanges": [
        {
          "fieldName": "shippingMethod",
          "oldType": "string",
          "newType": "object"
        }
      ],
      "requirednessChanges": []
    },
    "findings": [
      {
        "consumerId": "inventory-service",
        "status": "BREAK",
        "ruleId": "EVT001_FIELD_TYPE_CHANGED",
        "field": "shippingMethod",
        "expectedType": "string",
        "proposedType": "object",
        "severity": "HIGH",
        "reason": "Field 'shippingMethod' type changed from string to object which is incompatible with consumer expectation."
      }
    ],
    "decision": "BLOCK",
    "severity": "HIGH",
    "summary": "The proposed event cannot be deployed because 1 consumer would break.",
    "timestamp": "2026-09-18T01:15:35.000000Z",
    "requestId": "smoke-test-req-block"
  }
}
```

---

### 3.3 Risky Change Review Required (`REVIEW`)
When a consumer experiences an uncertain or risky change (`decision: "REVIEW"`):
- **HTTP Status:** `409 Conflict`
- **`published`:** `false`
- **`eventBridgeEventId`:** `null`
- **Transport Behavior:** **EventBridge publication is prevented pending future review.** Zero downstream consumer delivery.

```json
{
  "eventId": "f8705a9f-63cd-4194-be22-0869fe01d5b6",
  "published": false,
  "decision": "REVIEW",
  "severity": "MEDIUM",
  "eventBridgeEventId": null,
  "analysis": {
    "analysisId": "912384a1-4567-489a-bcde-f0123456789a",
    "eventType": "OrderPlaced",
    "currentVersion": 1,
    "proposedVersion": 4,
    "findings": [
      {
        "consumerId": "analytics-service",
        "status": "RISK",
        "ruleId": "EVT006_OPTIONAL_FIELD_REMOVED",
        "field": "couponCode",
        "expectedType": "string",
        "proposedType": null,
        "severity": "MEDIUM",
        "reason": "Field 'couponCode' was removed. Consumer considers it optional, but removal may degrade service functionality."
      }
    ],
    "decision": "REVIEW",
    "severity": "MEDIUM",
    "summary": "The proposed event requires review because 1 consumer compatibility check is uncertain.",
    "timestamp": "2026-09-18T01:15:40.000000Z",
    "requestId": "smoke-test-req-review"
  }
}
```

---

## 4. Error Responses

All errors return a consistent structured error envelope:

### 4.1 Invalid Event Payload (`422 Unprocessable Entity`)
Returned when the submitted `payload` does not conform to the schema of `proposedVersion`:

```json
{
  "error": {
    "code": "INVALID_EVENT_PAYLOAD",
    "message": "Event payload is invalid against proposed contract OrderPlaced v2: Missing required field: orderId",
    "requestId": "test-req-invalid-payload"
  }
}
```

### 4.2 Unknown Event or Version (`404 Not Found`)
```json
{
  "error": {
    "code": "CONTRACT_NOT_FOUND",
    "message": "Contract version 99 not found for event type 'OrderPlaced'.",
    "requestId": "6cf6c321-72f1-43e5-827c-17e94fbf2f8a"
  }
}
```

### 4.3 Event Publishing Failure (`503 Service Unavailable`)
Returned if AWS EventBridge `PutEvents` fails, returns `FailedEntryCount > 0`, or fails to return an `EventId`:

```json
{
  "error": {
    "code": "EVENT_PUBLISH_FAILED",
    "message": "Failed to publish event to EventBridge: Internal service error",
    "requestId": "test-req-fail"
  }
}
```

---

## 5. Public Endpoint Limitation & Production Scope

> [!WARNING]
> **Demonstration Scope Notice:**
> Phase 3 does not implement authentication or authorization. This is an intentional architectural boundary for the hackathon demonstration, enabling direct evaluation and live verification.
>
> A production deployment would require:
> 1. Authentication via Amazon Cognito, IAM SigV4, or API Gateway Lambda Authorizers
> 2. Fine-grained RBAC/ABAC authorization per event type
> 3. API Gateway usage plans, throttling, and burst rate limiting
> 4. Web Application Firewall (AWS WAF) for DDoS and abuse protection

---

## 6. Example cURL Commands

```bash
# 1. Health Check
curl -s -X GET "https://ux8bwi3i8l.execute-api.ap-south-1.amazonaws.com/health"

# 2. Analyze Schema Transition (Pure Analysis)
curl -s -X POST "https://ux8bwi3i8l.execute-api.ap-south-1.amazonaws.com/api/v1/analyze" \
  -H "Content-Type: application/json" \
  -d '{"eventType": "OrderPlaced", "currentVersion": 1, "proposedVersion": 2}'

# 3. Publish Event with Gated Cloud Enforcement
curl -s -X POST "https://ux8bwi3i8l.execute-api.ap-south-1.amazonaws.com/api/v1/events/publish" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "OrderPlaced",
    "currentVersion": 1,
    "proposedVersion": 2,
    "payload": {
      "orderId": "O1001",
      "amount": 500,
      "items": [],
      "shippingMethod": "standard",
      "couponCode": "SAVE10"
    }
  }'
```
