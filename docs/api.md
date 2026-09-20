# EventGate API Reference

EventGate exposes a lightweight HTTP JSON interface with camelCase field serialization and stable structured error response envelopes.

---

## 1. Endpoints Overview

| Method | Path | Purpose | Transport Side Effects |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Service health status check | None (pure health probe) |
| `POST` | `/api/v1/analyze` | Advisory compatibility analysis & policy evaluation | None (persists initial evaluated audit record) |
| `POST` | `/api/v1/events/publish` | Payload validation, compatibility, policy, and gated EventBridge publishing | Publishes to EventBridge **only** on `ALLOW` |
| `GET` | `/api/v1/contracts/events` | List registered event types and metadata | None (catalog read) |
| `GET` | `/api/v1/contracts/events/{event_type}` | Event version details and schemas | None (catalog read) |
| `GET` | `/api/v1/contracts/consumers` | List all registered consumer services | None (catalog read) |
| `GET` | `/api/v1/history` | Query persistent release review history | None (audit read) |
| `GET` | `/api/v1/history/{record_id}` | Get specific release review record | None (audit read) |
| `GET` | `/api/v1/history/{record_id}/report` | Export release audit report (Markdown or JSON) | None (audit report export) |
| `POST` | `/api/v1/reports/export` | Export release report directly from active review payload | None (ad-hoc report export) |
| `GET` | `/api/v1/policies` | Active policy engine, 3x3 matrix, and Cedar policy source | None (policy inspection) |
| `GET` | `/api/v1/config/runtime` | Authoritative runtime configuration | None (configuration probe) |

---

## 2. Core Release Endpoints

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
Evaluates proposed schema evolution against active downstream consumer contracts within the target environment policy without publishing to EventBridge.

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
  "proposedVersion": 2,
  "environment": "production"
}
```

#### Request Fields
| Field | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `eventType` | `string` | Yes | - | Target event name (e.g. `OrderPlaced`) |
| `currentVersion` | `integer` | Yes | - | Baseline version number ($\ge 1$) |
| `proposedVersion` | `integer` | Yes | - | Proposed version number ($\ge 1$) |
| `environment` | `string` | No | `"production"` | Operational environment (`production`, `staging`, `development`) |

#### Success Response (`200 OK`)
```json
{
  "analysisId": "197ada2a-5e37-4028-9c08-56af25fed6f4",
  "eventType": "OrderPlaced",
  "currentVersion": 1,
  "proposedVersion": 2,
  "environment": "production",
  "compatibilityResult": "SAFE",
  "severity": "LOW",
  "decision": "ALLOW",
  "policyName": "StandardProductionPolicy",
  "policyReason": "All consumers compatible in production.",
  "policyProvider": "standard",
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
      "severity": "LOW",
      "reason": "Billing Service is not affected by the proposed changes."
    }
  ],
  "summary": "All 3 consumers are safe with the proposed event change.",
  "timestamp": "2026-09-19T10:00:00.000000Z",
  "requestId": "req-123"
}
```

---

### 2.3 Event Publishing & Cloud Enforcement
Validates the event payload against the proposed contract, runs downstream consumer compatibility and policy analysis, and publishes to Amazon EventBridge **only if the decision is `ALLOW`**.

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
  "environment": "production",
  "payload": {
    "orderId": "O1001",
    "amount": 500,
    "items": [],
    "shippingMethod": "standard",
    "couponCode": "SAVE10"
  },
  "analysisId": "197ada2a-5e37-4028-9c08-56af25fed6f4"
}
```

#### Request Fields
| Field | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `eventType` | `string` | Yes | - | Target event name (e.g. `OrderPlaced`) |
| `currentVersion` | `integer` | Yes | - | Baseline version number ($\ge 1$) |
| `proposedVersion` | `integer` | Yes | - | Proposed version number ($\ge 1$) |
| `environment` | `string` | No | `"production"` | Operational environment (`production`, `staging`, `development`) |
| `payload` | `object` | Yes | - | Domain event payload conforming to the proposed version contract |
| `analysisId` | `string` | No | `null` | Optional correlation ID from preceding analysis to correlate audit record |

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
    "environment": "production",
    "decision": "ALLOW",
    "severity": "LOW",
    "summary": "All 3 consumers are safe with the proposed event change."
  }
}
```

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
    "environment": "production",
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
    "summary": "The proposed event cannot be deployed because 1 consumer would break."
  }
}
```

### 3.3 Risky Change Review Required (`REVIEW`)
When a consumer experiences an uncertain or risky change (`decision: "REVIEW"`):
- **HTTP Status:** `409 Conflict`
- **`published`:** `false`
- **`eventBridgeEventId`:** `null`
- **Transport Behavior:** **EventBridge publication is prevented pending future review.** Zero downstream consumer delivery.

---

## 4. Contract Catalog Endpoints

### 4.1 List Event Types
- **Method:** `GET`
- **Path:** `/api/v1/contracts/events`
- **Response (`200 OK`):**
```json
[
  {
    "eventType": "OrderPlaced",
    "versions": [1, 2, 3, 4],
    "latestVersion": 4,
    "consumerCount": 3,
    "schemaDescription": "Fired when a customer completes checkout"
  },
  {
    "eventType": "PaymentCompleted",
    "versions": [1, 2],
    "latestVersion": 2,
    "consumerCount": 2,
    "schemaDescription": "Fired when payment processor settles charge"
  },
  {
    "eventType": "UserCreated",
    "versions": [1, 2],
    "latestVersion": 2,
    "consumerCount": 2,
    "schemaDescription": "Fired upon user registration"
  }
]
```

### 4.2 Get Event Type Detail
- **Method:** `GET`
- **Path:** `/api/v1/contracts/events/{event_type}`
- **Response (`200 OK`):** Returns full contract detail and schema dictionary for all versions of the event.

### 4.3 List Consumers
- **Method:** `GET`
- **Path:** `/api/v1/contracts/consumers`
- **Response (`200 OK`):**
```json
[
  {
    "consumerId": "billing-service",
    "serviceName": "Billing Service",
    "subscribedEvents": ["OrderPlaced", "PaymentCompleted"],
    "owner": "finance-team"
  },
  {
    "consumerId": "inventory-service",
    "serviceName": "Inventory Service",
    "subscribedEvents": ["OrderPlaced"],
    "owner": "logistics-team"
  }
]
```

### 4.4 Get Consumer Detail
- **Method:** `GET`
- **Path:** `/api/v1/contracts/consumers/{consumer_id}`
- **Response (`200 OK`):** Returns detailed consumer contracts including exact field dependencies, types, and requiredness.

---

## 5. Release History & Audit Trail Endpoints

### 5.1 Query Release History
- **Method:** `GET`
- **Path:** `/api/v1/history`
- **Query Parameters:**
  - `eventType` *(optional string)*: Filter by event name
  - `limit` *(optional int, default 50)*: Maximum records to return
- **Response (`200 OK`):** Array of correlated `ReleaseRecord` objects.

### 5.2 Get Specific Release Record
- **Method:** `GET`
- **Path:** `/api/v1/history/{record_id}`
- **Response (`200 OK`):** Correlated `ReleaseRecord` entity.

### 5.3 Export Audit Report
- **Method:** `GET`
- **Path:** `/api/v1/history/{record_id}/report?format=markdown` (or `format=json`)
- **Response (`200 OK`):**
  - For `format=markdown`: Content-Type `text/markdown`, returns GitHub-formatted compliance report.
  - For `format=json`: Content-Type `application/json`, returns structured audit payload.

### 5.4 Export Active Review Report
- **Method:** `POST`
- **Path:** `/api/v1/reports/export`
- **Request Body:** Active review payload with `format` ("markdown" | "json")
- **Response (`200 OK`):** Structured report payload with filename and content.

---

## 6. Policies & Runtime Configuration Endpoints

### 6.1 Get Active Policies & Matrix
- **Method:** `GET`
- **Path:** `/api/v1/policies`
- **Response (`200 OK`):**
```json
{
  "activeEngine": "standard",
  "policyMatrix": {
    "production": { "LOW": "ALLOW", "MEDIUM": "REVIEW", "HIGH": "BLOCK" },
    "staging": { "LOW": "ALLOW", "MEDIUM": "REVIEW", "HIGH": "BLOCK" },
    "development": { "LOW": "ALLOW", "MEDIUM": "ALLOW", "HIGH": "BLOCK" }
  },
  "cedarAvailable": true,
  "cedarSource": "permit (principal, action, resource) when { ... };"
}
```

### 6.2 Get Authoritative Runtime Configuration
- **Method:** `GET`
- **Path:** `/api/v1/config/runtime`
- **Response (`200 OK`):**
```json
{
  "environment": "development",
  "storageBackend": "Local JSON",
  "publisher": "Local Event Publisher",
  "awsRegion": "ap-south-1",
  "eventBus": "primex-eventgate-dev-bus",
  "policyEngine": "Standard Deterministic Engine",
  "contractsPath": "c:\\primex-eventgate\\contracts"
}
```

---

## 7. Error Responses

All errors return a consistent structured error envelope:

### 7.1 Invalid Event Payload (`422 Unprocessable Entity`)
```json
{
  "error": {
    "code": "INVALID_EVENT_PAYLOAD",
    "message": "Event payload is invalid against proposed contract OrderPlaced v2: Missing required field: orderId",
    "requestId": "test-req-invalid-payload"
  }
}
```

### 7.2 Unknown Event or Version (`404 Not Found`)
```json
{
  "error": {
    "code": "CONTRACT_NOT_FOUND",
    "message": "Contract version 99 not found for event type 'OrderPlaced'.",
    "requestId": "6cf6c321-72f1-43e5-827c-17e94fbf2f8a"
  }
}
```

### 7.3 Event Publishing Failure (`503 Service Unavailable`)
```json
{
  "error": {
    "code": "EVENT_PUBLISH_FAILED",
    "message": "Failed to publish event to EventBridge: Internal service error",
    "requestId": "test-req-fail"
  }
}
```

