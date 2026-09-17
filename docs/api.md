# EventGate API Reference (Phase 3)

EventGate exposes a lightweight HTTP JSON interface with camelCase field serialization and stable structured error response envelopes.

---

## 1. Endpoints Overview

| Method | Path | Purpose |
| :--- | :--- | :--- |
| `GET` | `/health` | Service health status check |
| `POST` | `/api/v1/analyze` | Compatibility analysis without event publication |
| `POST` | `/api/v1/events/publish` | Two-phase payload validation, compatibility analysis, and gated EventBridge publishing |

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

### 2.2 Event Compatibility Analysis
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
| `proposedVersion` | `integer` | Yes | Target version number ($\ge 1$) |

---

### 2.3 Event Publishing & Cloud Enforcement
Validates the event payload against the proposed contract, runs downstream consumer compatibility analysis, and publishes to Amazon EventBridge only if the decision is `ALLOW`.

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
  "event": {
    "orderId": "ord-101",
    "customerId": "cust-202",
    "totalAmount": 149.99,
    "items": [
      {
        "sku": "ITEM-A",
        "quantity": 2,
        "price": 49.99
      }
    ],
    "shippingMethod": "standard",
    "metadata": {
      "source": "web-checkout"
    }
  }
}
```

#### Request Fields
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `eventType` | `string` | Yes | Target event name (e.g. `OrderPlaced`) |
| `currentVersion` | `integer` | Yes | Baseline version number ($\ge 1$) |
| `proposedVersion` | `integer` | Yes | Target version number ($\ge 1$) |
| `event` | `object` | Yes | Domain event payload matching the proposed schema |

---

## 3. Publishing Response Examples

### 3.1 Allowed & Published (`200 OK`)
When all consumers are compatible (`decision: "ALLOW"`), the event is published to EventBridge and fans out to consumer Lambdas.

```json
{
  "published": true,
  "eventId": "evt-7a9b1c2d-3e4f-5678-90ab-cdef12345678",
  "eventType": "OrderPlaced",
  "version": 2,
  "decision": "ALLOW",
  "severity": "LOW",
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
    "requestId": "smoke-test-req-101"
  },
  "eventBridgeEventId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7549b01e",
  "reason": "All consumers are compatible. Event published to EventBridge.",
  "timestamp": "2026-09-18T01:15:30.123456Z",
  "requestId": "smoke-test-req-101"
}
```

---

### 3.2 Breaking Change Blocked (`409 Conflict`)
When a consumer experiences a breaking change (`decision: "BLOCK"`), publication to EventBridge is prevented.

```json
{
  "published": false,
  "eventId": "evt-c98e2f1a-5b3d-4e6f-87a1-123456789abc",
  "eventType": "OrderPlaced",
  "version": 3,
  "decision": "BLOCK",
  "severity": "HIGH",
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
    "requestId": "smoke-test-req-102"
  },
  "eventBridgeEventId": null,
  "reason": "Publication blocked: 1 consumer(s) would break.",
  "timestamp": "2026-09-18T01:15:35.000000Z",
  "requestId": "smoke-test-req-102"
}
```

---

### 3.3 Risky Change Review Required (`409 Conflict`)
When a consumer experiences an uncertain or risky change (`decision: "REVIEW"`), publication is halted pending approval.

```json
{
  "published": false,
  "eventId": "evt-e3f4a5b6-7c8d-90e1-2345-6789abcdef01",
  "eventType": "OrderPlaced",
  "version": 4,
  "decision": "REVIEW",
  "severity": "MEDIUM",
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
    "requestId": "smoke-test-req-103"
  },
  "eventBridgeEventId": null,
  "reason": "Publication halted: event schema requires review.",
  "timestamp": "2026-09-18T01:15:40.000000Z",
  "requestId": "smoke-test-req-103"
}
```

---

## 4. Error Responses

All errors return a consistent structured error envelope:

### 4.1 Invalid Event Payload (`422 Unprocessable Entity`)
Returned when the submitted `event` body does not match the schema of `proposedVersion`:

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
Returned if AWS EventBridge `PutEvents` fails or fails to return an `EventId`:

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

## 5. Example cURL Commands

```bash
# 1. Health Check
curl -s -X GET "https://<api-id>.execute-api.<region>.amazonaws.com/health"

# 2. Analyze Schema Transition
curl -s -X POST "https://<api-id>.execute-api.<region>.amazonaws.com/api/v1/analyze" \
  -H "Content-Type: application/json" \
  -d '{"eventType": "OrderPlaced", "currentVersion": 1, "proposedVersion": 2}'

# 3. Publish Event (Safe Evolution -> ALLOW)
curl -s -X POST "https://<api-id>.execute-api.<region>.amazonaws.com/api/v1/events/publish" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "OrderPlaced",
    "currentVersion": 1,
    "proposedVersion": 2,
    "event": {
      "orderId": "ord-101",
      "customerId": "cust-202",
      "totalAmount": 149.99,
      "items": [{"sku": "ITEM-A", "quantity": 2, "price": 49.99}],
      "shippingMethod": "standard",
      "metadata": {"source": "web"}
    }
  }'
```
