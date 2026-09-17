# EventGate API Reference (Phase 1)

EventGate exposes a lightweight HTTP JSON interface with camelCase field serialization and stable structured error response envelopes.

---

## 1. Endpoints

### 1.1 Health Check
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

### 1.2 Event Compatibility Analysis
Evaluates proposed schema evolution against active downstream consumer contracts.

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

## 2. Analysis Response Examples

### 2.1 Safe Evolution (`ALLOW`)
Proposed contract adds an optional `metadata` field. All registered consumers remain unaffected or receive non-breaking additions.

```json
{
  "analysisId": "197ada2a-5e37-4028-9c08-56af25fed6f4",
  "eventType": "OrderPlaced",
  "currentVersion": 1,
  "proposedVersion": 2,
  "changeSet": {
    "addedFields": [
      "metadata"
    ],
    "removedFields": [],
    "typeChanges": [],
    "requirednessChanges": []
  },
  "findings": [
    {
      "consumerId": "analytics-service",
      "status": "SAFE",
      "ruleId": "EVT005_OPTIONAL_FIELD_ADDED",
      "field": "*",
      "expectedType": null,
      "proposedType": null,
      "severity": "LOW",
      "reason": "Analytics Service is not affected by the proposed changes."
    },
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
    }
  ],
  "decision": "ALLOW",
  "severity": "LOW",
  "summary": "All registered consumers are compatible with the proposed event.",
  "timestamp": "2026-09-17T11:20:17.059823Z",
  "requestId": "d48d69ad-12c3-4ab3-b912-2ec55e3b43f3"
}
```

### 2.2 Breaking Evolution (`BLOCK`)
Proposed contract changes `shippingMethod` from `string` to `object`. `inventory-service` expects `string`.

```json
{
  "analysisId": "13f05216-201f-49c7-a9b5-b1fcc2fea9ba",
  "eventType": "OrderPlaced",
  "currentVersion": 1,
  "proposedVersion": 3,
  "changeSet": {
    "addedFields": [],
    "removedFields": [],
    "typeChanges": [
      {
        "field": "shippingMethod",
        "fromType": "string",
        "toType": "object"
      }
    ],
    "requirednessChanges": []
  },
  "findings": [
    {
      "consumerId": "analytics-service",
      "status": "SAFE",
      "ruleId": "EVT008_CONSUMER_UNAFFECTED",
      "field": "*",
      "expectedType": null,
      "proposedType": null,
      "severity": "LOW",
      "reason": "Analytics Service is not affected by the proposed changes."
    },
    {
      "consumerId": "billing-service",
      "status": "SAFE",
      "ruleId": "EVT008_CONSUMER_UNAFFECTED",
      "field": "*",
      "expectedType": null,
      "proposedType": null,
      "severity": "LOW",
      "reason": "Billing Service is not affected by the proposed changes."
    },
    {
      "consumerId": "inventory-service",
      "status": "BREAK",
      "ruleId": "EVT001_FIELD_TYPE_CHANGED",
      "field": "shippingMethod",
      "expectedType": "string",
      "proposedType": "object",
      "severity": "HIGH",
      "reason": "Inventory Service expects 'shippingMethod' to be string, but the proposed contract defines it as object."
    }
  ],
  "decision": "BLOCK",
  "severity": "HIGH",
  "summary": "The proposed event is incompatible with 1 registered consumer.",
  "timestamp": "2026-09-17T11:20:17.065527Z",
  "requestId": "c245a266-fa0f-45b9-b333-b65a69bd4612"
}
```

### 2.3 Risky Evolution (`REVIEW`)
Proposed contract removes optional `couponCode` field. `analytics-service` consumes it.

```json
{
  "analysisId": "c7e23346-23db-4856-9d83-fcbae9c7a315",
  "eventType": "OrderPlaced",
  "currentVersion": 1,
  "proposedVersion": 4,
  "changeSet": {
    "addedFields": [],
    "removedFields": [
      "couponCode"
    ],
    "typeChanges": [],
    "requirednessChanges": []
  },
  "findings": [
    {
      "consumerId": "analytics-service",
      "status": "RISK",
      "ruleId": "EVT006_OPTIONAL_FIELD_REMOVED",
      "field": "couponCode",
      "expectedType": "string",
      "proposedType": null,
      "severity": "MEDIUM",
      "reason": "Analytics Service uses optional field 'couponCode' (string), but it has been removed from the proposed contract."
    },
    {
      "consumerId": "billing-service",
      "status": "SAFE",
      "ruleId": "EVT008_CONSUMER_UNAFFECTED",
      "field": "*",
      "expectedType": null,
      "proposedType": null,
      "severity": "LOW",
      "reason": "Billing Service is not affected by the proposed changes."
    },
    {
      "consumerId": "inventory-service",
      "status": "SAFE",
      "ruleId": "EVT008_CONSUMER_UNAFFECTED",
      "field": "*",
      "expectedType": null,
      "proposedType": null,
      "severity": "LOW",
      "reason": "Inventory Service is not affected by the proposed changes."
    }
  ],
  "decision": "REVIEW",
  "severity": "MEDIUM",
  "summary": "The proposed event requires review because 1 consumer compatibility check is uncertain.",
  "timestamp": "2026-09-17T11:20:17.073037Z",
  "requestId": "1bf0e58f-dd2d-485a-adf3-d25ef5ef7b30"
}
```

---

## 3. Error Responses

Errors return a consistent structured error envelope:

### 3.1 Unknown Event (`404 Not Found`)
```json
{
  "error": {
    "code": "CONTRACT_NOT_FOUND",
    "message": "No contracts found for event type 'NonExistent'.",
    "requestId": "45497a5a-b8fe-4016-b596-7dec72f6105e"
  }
}
```

### 3.2 Unknown Version (`404 Not Found`)
```json
{
  "error": {
    "code": "CONTRACT_NOT_FOUND",
    "message": "Contract version 99 not found for event type 'OrderPlaced'.",
    "requestId": "6cf6c321-72f1-43e5-827c-17e94fbf2f8a"
  }
}
```

### 3.3 Validation Error (`422 Unprocessable Entity`)
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "loc": ["body", "currentVersion"],
        "msg": "Input should be greater than or equal to 1",
        "type": "greater_than_equal"
      }
    ],
    "requestId": "5be7bc8a-723a-4467-93aa-bf4cb2c8d234"
  }
}
```
