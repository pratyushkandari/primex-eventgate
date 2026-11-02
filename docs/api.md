# API reference

Base URL locally: `http://127.0.0.1:8000`. Interactive docs: `/docs` (Swagger UI) and `/openapi.json`. All bodies are JSON with camelCase fields. Every response carries `X-Request-ID`; send your own to correlate logs.

## Analyze a change

`POST /api/v1/analyze`

```json
{"eventType": "OrderPlaced", "currentVersion": 1, "proposedVersion": 3, "environment": "production"}
```

`environment` is `development`, `staging` or `production` (case-insensitive, default `production`). The versions must exist and differ.

Response `200`:

```json
{
  "analysisId": "7c18b762-6f29-411a-a53c-f86a98da5f81",
  "eventType": "OrderPlaced",
  "currentVersion": 1,
  "proposedVersion": 3,
  "environment": "production",
  "compatibilityResult": "BREAK",
  "severity": "HIGH",
  "decision": "BLOCK",
  "policyName": "StandardReleasePolicy",
  "policyReason": "Release policy for 'production' strictly blocks breaking changes (1 high-severity break detected).",
  "warnings": [],
  "summary": "The proposed event is incompatible with 1 registered consumer.",
  "changeSet": {
    "addedFields": [],
    "removedFields": [],
    "typeChanges": [{"field": "shippingMethod", "fromType": "string", "toType": "object"}],
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
      "reason": "Inventory Service expects 'shippingMethod' to be string, but the proposed contract defines it as object."
    }
  ],
  "timestamp": "2026-11-02T08:00:00.000000Z",
  "requestId": "4f2e3414-76e1-45a4-9923-3e4b05eebc0a"
}
```

`findings` contains at least one entry per subscribed consumer (SAFE ones too). The result is also saved to release history under `analysisId`.

## Publish an event

`POST /api/v1/events/publish`

```json
{
  "eventType": "OrderPlaced",
  "currentVersion": 1,
  "proposedVersion": 2,
  "environment": "staging",
  "analysisId": "7c18b762-…",
  "payload": {"orderId": "ord-1", "amount": 10.5, "items": ["sku-1"], "shippingMethod": "standard"}
}
```

| Status | Meaning |
| --- | --- |
| 200 | Decision ALLOW and the event was published. `published: true`, `eventBridgeEventId` set. |
| 409 | Decision BLOCK or REVIEW. Same body shape, `published: false`; the bus was not called. |
| 400 | `analysisId` refers to a different event, version pair or environment. |
| 422 | Payload missing a required field or with a wrong top-level type (`INVALID_EVENT_PAYLOAD`), or a malformed request (`VALIDATION_ERROR`). |
| 503 | Decision ALLOW but the bus rejected the event (`EVENT_PUBLISH_FAILED`). The attempt is still recorded. |

Response body (200 and 409):

```json
{
  "eventId": "e0b7…",
  "published": true,
  "decision": "ALLOW",
  "severity": "LOW",
  "eventBridgeEventId": "4d1f…",
  "analysis": { "…": "same shape as /analyze" }
}
```

`analysisId` is optional. With it, the publish outcome is written onto that analysis's history record, and the response and the published event carry the same `analysisId`; without it, a new record is created.

## Contracts

| Request | Returns |
| --- | --- |
| `GET /api/v1/contracts/events` | `[{eventType, versionCount, versions, latestVersion, consumerCount}]` |
| `GET /api/v1/contracts/events/{eventType}` | `{eventType, versions, latestVersion, contracts: [{version, fields}], consumers: [{consumerId, expectedFields}]}`; 404 if unknown |
| `GET /api/v1/contracts/consumers` | `[{consumerId, eventType, expectedFieldsCount}]` |
| `GET /api/v1/contracts/consumers/{consumerId}` | `{consumerId, eventType, expectedFields}`; 404 if unknown |

Field specs are `{name, type, required}` with type one of `string`, `number`, `integer`, `boolean`, `object`, `array`, `null`.

## History

| Request | Returns |
| --- | --- |
| `GET /api/v1/history?eventType=&limit=` | Release records, newest first. `limit` 1–200, default 50. |
| `GET /api/v1/history/{recordId}` | One record. Locally `recordId` may also be an analysis ID. 404 `RELEASE_RECORD_NOT_FOUND`. |
| `GET /api/v1/history/{recordId}/report?format=markdown\|json` | `{recordId, format, content}`; `content` is the rendered report. |

A record has: `recordId`, `analysisId`, `eventType`, `currentVersion`, `proposedVersion`, `environment`, `compatibilityResult`, `severity`, `policyName`, `policyReason`, `decision`, `affectedConsumers`, `findingsSummary`, `published`, `attemptedPublish`, `eventId`, `eventBridgeEventId`, `requestId`, `timestamp`, `publishedAt`, `error`.

## Inspection

- `GET /health` → `{"status": "ok", "service": "eventgate", "version": "0.1.0"}`. Does not check dependencies.
- `GET /api/v1/policies` → `{activeEngine, engineName, description, matrix: [{environment, low, medium, high}], cedarPolicyAvailable, cedarPolicyText}`.
- `GET /api/v1/config/runtime` → `{serviceVersion, storageBackend, storageBackendType, contractsSource, historyStore, publisherBackend, publisherBackendType, eventBridgeBus, awsRegion, policyEngine, policyEngineType}`. Contains no file system paths or credentials.

## Errors

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request. currentVersion: Field required",
    "requestId": "…",
    "details": [{"field": "currentVersion", "message": "Field required"}]
  }
}
```

The codes and statuses are listed in [architecture.md](architecture.md#requests-and-errors).
