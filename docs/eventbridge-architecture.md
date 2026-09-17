# EventBridge Architecture & Consumer Fan-Out (Phase 3)

EventGate utilizes **Amazon EventBridge** as the cloud enforcement and event transport layer. This document details the architectural topology, event schema envelope, routing rules, consumer demonstration handlers, and IAM security boundaries.

---

## 1. Architectural Topology

```text
Client / Event Producer
  │
  │ POST /api/v1/events/publish
  ▼
API Gateway HTTP API (EventGateHttpApi)
  │
  ▼
EventGate Lambda (EventGateFunction)
  │
  ▼
EventPublishService
  │
  ▼
Consumer Compatibility Analysis
  │
  ▼
Decision Policy
  ├── BLOCK  ──► HTTP 409 (EventBridge publication is prevented)
  ├── REVIEW ──► HTTP 409 (EventBridge publication is prevented)
  └── ALLOW
          │
          │ events:PutEvents
          ▼
    Amazon EventBridge Custom Bus (primex-eventgate-dev-bus)
          │
          ▼
    EventBridge Rule (primex-eventgate-dev-order-placed-rule)
          │
          ├──────────────────────┼──────────────────────┐
          ▼                      ▼                      ▼
    Billing Consumer      Inventory Consumer     Analytics Consumer
    Lambda (128MB)        Lambda (128MB)         Lambda (128MB)
```

---

## 2. EventBridge Custom Event Bus

- **Bus Name:** `primex-eventgate-dev-bus`
- **Resource Type:** `AWS::Events::EventBus`
- **Pricing:** $1.00 per million custom events.
- **Isolation:** Decoupled from the AWS account `default` bus to isolate project events, prevent noise, and establish strict IAM boundaries.

---

## 3. Event Envelope Specification

When an event passes validation and receives an `ALLOW` decision, `EventBridgeEventPublisher` publishes it with the following envelope:

- **Source:** `primex.eventgate`
- **DetailType:** `EventGateEvent`
- **EventBusName:** `primex-eventgate-dev-bus`
- **Detail Envelope Fields:**
  - `eventId` (`string`): Unique event identifier.
  - `eventType` (`string`): Canonical event type name (e.g. `OrderPlaced`).
  - `version` (`integer`): Verified contract version.
  - `decision` (`string`): Compatibility decision (`ALLOW`).
  - `analysisId` (`string`): UUID of the compatibility evaluation.
  - `requestId` (`string`): Correlation identifier (`X-Request-ID`).
  - `payload` (`object`): Verified domain payload.

### Example Event Entry
```json
{
  "Source": "primex.eventgate",
  "DetailType": "EventGateEvent",
  "EventBusName": "primex-eventgate-dev-bus",
  "Detail": {
    "eventId": "4d22c323-2506-42ec-af22-8ac6ed99e18b",
    "eventType": "OrderPlaced",
    "version": 2,
    "decision": "ALLOW",
    "analysisId": "197ada2a-5e37-4028-9c08-56af25fed6f4",
    "requestId": "smoke-test-req-101",
    "payload": {
      "orderId": "O1001",
      "amount": 500,
      "items": [],
      "shippingMethod": "standard",
      "couponCode": "SAVE10",
      "metadata": {
        "source": "web-checkout"
      }
    }
  }
}
```

---

## 4. Routing Rule & Fan-Out Targets

The routing rule is scoped specifically to `OrderPlaced` events:

- **Rule Name:** `primex-eventgate-dev-order-placed-rule`
- **State:** `ENABLED`
- **Event Pattern:**
```json
{
  "source": ["primex.eventgate"],
  "detail-type": ["EventGateEvent"],
  "detail": {
    "eventType": ["OrderPlaced"]
  }
}
```

> [!NOTE]
> **Scope Precision:** The current EventBridge rule pattern explicitly matches `detail.eventType = ["OrderPlaced"]`. Supporting additional event types requires registering corresponding routing rules or generalizing the pattern.

### Consumer Lambda Targets

| Target ID | Function Name | Memory | Timeout | Environment Variable |
| :--- | :--- | :--- | :--- | :--- |
| `BillingConsumerTarget` | `primex-eventgate-dev-consumer-billing` | 128 MB | 5s | `CONSUMER_ID=billing-service` |
| `InventoryConsumerTarget` | `primex-eventgate-dev-consumer-inventory` | 128 MB | 5s | `CONSUMER_ID=inventory-service` |
| `AnalyticsConsumerTarget` | `primex-eventgate-dev-consumer-analytics` | 128 MB | 5s | `CONSUMER_ID=analytics-service` |

---

## 5. Consumer Demonstration Handlers

The three consumer Lambdas execute a lightweight Python 3.14 handler (`consumers/src/consumer_handler.py`). Their scope is intentionally minimal to demonstrate observable receipt without side effects:
1. **Receive:** Accepts EventBridge invocation payload.
2. **Extract Metadata:** Pulls `CONSUMER_ID` from the environment, and `eventId`, `eventType`, `version`, `decision`, and `requestId` from `event["detail"]`.
3. **Structured CloudWatch Log:** Emits a structured JSON log entry for automated discovery and verification.
4. **Return Success:** Returns `{"status": "SUCCESS", "consumerId": "...", "eventId": "..."}`.
5. **No Republishing:** Consumers do **not** publish downstream events or loop back into EventGate.

---

## 6. IAM Security & Permission Boundaries

1. **Publisher Permission (`EventGateFunctionRole`):**
   Least-privilege policy granting `events:PutEvents` **only** on the custom event bus ARN:
   ```yaml
   - Statement:
       - Sid: PublishToEventGateBus
         Effect: Allow
         Action:
           - events:PutEvents
         Resource: !GetAtt EventGateEventBus.Arn
   ```
   The function cannot write to the default bus or any other AWS event bus.

2. **Consumer Invocation Permissions (`AWS::Lambda::Permission`):**
   Each consumer function is protected by an explicit resource-based policy granting `events.amazonaws.com` permission to invoke it, constrained strictly by the rule's ARN:
   ```yaml
   BillingConsumerPermission:
     Type: AWS::Lambda::Permission
     Properties:
       FunctionName: !GetAtt BillingConsumerFunction.Arn
       Action: lambda:InvokeFunction
       Principal: events.amazonaws.com
       SourceArn: !GetAtt OrderPlacedEventRule.Arn
   ```
