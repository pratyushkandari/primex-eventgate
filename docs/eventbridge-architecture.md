# EventBridge Architecture & Consumer Fan-Out (Phase 3)

EventGate turns deterministic compatibility evaluation into real cloud event enforcement using **Amazon EventBridge**. This document specifies the EventBridge topology, routing rule patterns, consumer fan-out configuration, event envelope formats, and security policies.

---

## 1. Architectural Topology

```text
                                  +-----------------------+
                                  |    Event Producer     |
                                  +-----------------------+
                                              |
                                              | POST /api/v1/events/publish
                                              v
+-----------------------------------------------------------------------------------------+
|                                 Amazon API Gateway                                      |
+-----------------------------------------------------------------------------------------+
                                              |
                                              v
+-----------------------------------------------------------------------------------------+
|                            EventGate Lambda Function                                    |
|                                                                                         |
|   1. Payload Validation   --> Validates event against proposed contract                 |
|   2. Consumer Analysis    --> Evaluates against all active consumer contracts           |
|   3. Decision Gate:                                                                     |
|      - BLOCK / REVIEW     --> HTTP 409 Conflict (0 events sent to EventBridge)          |
|      - ALLOW              --> Invokes events:PutEvents on EventBridge custom bus        |
+-----------------------------------------------------------------------------------------+
                                              |
                                 events:PutEvents (ALLOW only)
                                              v
+-----------------------------------------------------------------------------------------+
|                  Amazon EventBridge Custom Bus: primex-eventgate-dev-bus                |
+-----------------------------------------------------------------------------------------+
                                              |
                        Rule: primex-eventgate-dev-order-placed-rule
                                              |
                     +------------------------+------------------------+
                     |                        |                        |
                     v                        v                        v
          +--------------------+   +--------------------+   +--------------------+
          |  Billing Consumer  |   | Inventory Consumer |   | Analytics Consumer |
          |   Lambda (128MB)   |   |   Lambda (128MB)   |   |   Lambda (128MB)   |
          +--------------------+   +--------------------+   +--------------------+
```

---

## 2. EventBridge Custom Event Bus

- **Bus Name:** `primex-eventgate-dev-bus` (parameterized via `${ProjectName}-${Environment}-bus`)
- **Type:** Custom EventBridge Bus (`AWS::Events::EventBus`)
- **Pricing:** $1.00 per million custom events ingested.
- **Isolation:** Decoupled from the AWS `default` event bus to ensure strict access boundaries, prevent noisy neighbor interference, and isolate project event streams.

---

## 3. Event Envelope Specification

When an event is approved (`ALLOW`), `EventBridgeEventPublisher` packages the event into the canonical AWS EventBridge entry format:

```json
{
  "Source": "primex.eventgate",
  "DetailType": "EventGateEvent",
  "EventBusName": "primex-eventgate-dev-bus",
  "Detail": {
    "eventId": "evt-7a9b1c2d-3e4f-5678-90ab-cdef12345678",
    "eventType": "OrderPlaced",
    "version": 2,
    "decision": "ALLOW",
    "timestamp": "2026-09-18T01:15:30.123456Z",
    "requestId": "test-req-1726622130",
    "payload": {
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
}
```

### Envelope Fields
| Field | Type | Description |
| :--- | :--- | :--- |
| `eventId` | `string` | Unique identifier generated for the event instance. |
| `eventType` | `string` | Canonical event name (`OrderPlaced`). |
| `version` | `integer` | Verified contract version of the payload. |
| `decision` | `string` | Deterministic compatibility decision (`ALLOW`). |
| `timestamp` | `string` | ISO 8601 UTC timestamp of gate evaluation. |
| `requestId` | `string` | Inbound `X-Request-ID` correlation ID. |
| `payload` | `object` | Verified domain event body. |

---

## 4. Routing Rule & Event Pattern

The EventBridge rule filters events by source and type, fanning out to registered consumer demonstration Lambdas:

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

### Fan-Out Targets
The rule routes matched events simultaneously to three targets:

| Target ID | Lambda Resource | Function Name | Environment Variable |
| :--- | :--- | :--- | :--- |
| `BillingConsumerTarget` | `BillingConsumerFunction` | `primex-eventgate-dev-consumer-billing` | `CONSUMER_ID=billing-service` |
| `InventoryConsumerTarget` | `InventoryConsumerFunction` | `primex-eventgate-dev-consumer-inventory` | `CONSUMER_ID=inventory-service` |
| `AnalyticsConsumerTarget` | `AnalyticsConsumerFunction` | `primex-eventgate-dev-consumer-analytics` | `CONSUMER_ID=analytics-service` |

---

## 5. Consumer Demonstration Handlers

Each consumer function runs a lightweight Python 3.14 handler (`consumers/src/consumer_handler.py`):
1. Extracts `CONSUMER_ID` from the environment.
2. Extracts `eventId`, `eventType`, `version`, `decision`, `requestId`, and `payload` from `event["detail"]`.
3. Logs a structured JSON receipt to Amazon CloudWatch:
```json
{
  "level": "INFO",
  "message": "Consumer processed event successfully",
  "consumerId": "billing-service",
  "eventId": "evt-7a9b1c2d-3e4f-5678-90ab-cdef12345678",
  "eventType": "OrderPlaced",
  "version": 2,
  "requestId": "test-req-1726622130",
  "receivedAt": "2026-09-18T01:15:31.456Z"
}
```
4. Returns `{"status": "SUCCESS", "consumerId": "billing-service", "eventId": "..."}`.
5. Does **not** re-publish events or loop back into EventGate.

---

## 6. Security & Least-Privilege IAM Policies

1. **Producer Privileges (`EventGateFunction`):**
   - The API Lambda role is granted `events:PutEvents` **only** on `EventGateEventBus.Arn`:
   ```yaml
   - Statement:
       - Sid: PublishToEventGateBus
         Effect: Allow
         Action:
           - events:PutEvents
         Resource: !GetAtt EventGateEventBus.Arn
   ```
   - It cannot publish to the `default` bus or any unrelated bus.

2. **Consumer Invocation Privileges (`AWS::Lambda::Permission`):**
   - Each consumer Lambda has an explicit resource-based policy granting `events.amazonaws.com` permission to invoke it, constrained strictly to `OrderPlacedEventRule.Arn`:
   ```yaml
   BillingConsumerPermission:
     Type: AWS::Lambda::Permission
     Properties:
       FunctionName: !GetAtt BillingConsumerFunction.Arn
       Action: lambda:InvokeFunction
       Principal: events.amazonaws.com
       SourceArn: !GetAtt OrderPlacedEventRule.Arn
   ```

3. **Consumer Execution Roles:**
   - Standard `AWSLambdaBasicExecutionRole` allowing CloudWatch log stream creation and log writing. No additional AWS service permissions.
