# EventGate AWS Serverless Architecture Specification (Phase 2)

## 1. Overview & System Topology

EventGate Phase 2 introduces an AWS serverless deployment runtime and Amazon DynamoDB persistence while strictly preserving the pure, deterministic compatibility engine developed in Phase 1.

The architectural boundary ensures that the core domain engine remains 100% cloud-agnostic: the domain layer has zero knowledge of AWS, boto3, Lambda, API Gateway, or DynamoDB.

```text
                  +-------------------------------+
                  |  Future Web / CLI / CI Client  |
                  +---------------+---------------+
                                  | (HTTPS JSON)
                                  v
                  +-------------------------------+
                  | Amazon API Gateway HTTP API   |
                  | GET /health                   |
                  | POST /api/v1/analyze          |
                  +---------------+---------------+
                                  | (Payload Format v2.0)
                                  v
                  +-------------------------------+
                  | AWS Lambda (Python 3.14)      |
                  | Handler: lambda_handler.py    |
                  +---------------+---------------+
                                  |
                                  v
                  +-------------------------------+
                  | Mangum ASGI Adapter           |
                  +---------------+---------------+
                                  |
                                  v
                  +-------------------------------+
                  | FastAPI Application           |
                  | - Structured error handling   |
                  | - Correlation / X-Request-ID  |
                  +---------------+---------------+
                                  |
                                  v
                  +-------------------------------+
                  | EventAnalysisService (App)    |
                  +---------------+---------------+
                                  |
                   +--------------+--------------+
                   |                             |
                   v                             v
       +-----------------------+     +------------------------+
       | Domain Engine (Pure)  |     | Repository Ports (App) |
       | - CompatibilityEngine |     | - IEventContractRepo   |
       | - ChangeSet Differ    |     | - IConsumerContractRepo|
       | - Decision Policy     |     +-----------+------------+
       +-----------------------+                 |
                                  +--------------+--------------+
                                  |                             |
                                  v                             v
                     +-------------------------+   +--------------------------+
                     | Json*ContractRepository |   | Dynamo*ContractRepository|
                     | (Local File System)     |   | (Amazon DynamoDB)        |
                     +-------------------------+   +------------+-------------+
                                                                |
                                             +------------------+------------------+
                                             |                                     |
                                             v                                     v
                                +---------------------------+         +----------------------------+
                                | EventContractsTable       |         | ConsumerContractsTable     |
                                | HASH: eventType (S)       |         | HASH: consumerId (S)       |
                                | RANGE: version (N)        |         | GSI: EventTypeIndex        |
                                +---------------------------+         +----------------------------+
```

> [!NOTE]
> **EventBridge & Bedrock Boundary:**
> Event transport (EventBridge bus publishing) and AI-assisted summaries (Bedrock) are **strictly NOT implemented in Phase 2**. All compatibility evaluations remain 100% deterministic mathematical calculations.

---

## 2. Serverless Component Specifications

### 2.1 Amazon API Gateway (HTTP API)
- **Protocol:** HTTP API (Payload format version 2.0).
- **Latency & Cost Profile:** Low latency, on-demand billing, minimal overhead compared to REST APIs.
- **Exposed Routes:**
  - `GET /health` → Basic service liveness and version info.
  - `POST /api/v1/analyze` → Consumer-aware compatibility analysis.
  - `ANY /{proxy+}` → Fallback routing to FastAPI router.
- **CORS Policy:** Explicitly configured for cross-origin development support:
  - Allowed methods: `GET`, `POST`, `OPTIONS`.
  - Allowed headers: `Content-Type`, `X-Request-ID`, `Authorization`.
  - Expose headers: `X-Request-ID`.
  - Wildcard credentials are strictly disallowed.

### 2.2 AWS Lambda Runtime
- **Runtime:** Python 3.14 (`python3.14`).
- **Architecture:** `x86_64`.
- **Memory Size:** 256 MB.
- **Timeout:** 10 seconds.
- **Adapter:** `Mangum(app, lifespan="off")` bridges API Gateway v2 HTTP events to the ASGI FastAPI application without custom translation layers.
- **Stateless Execution:** Lambda warm execution environments reuse boto3 DynamoDB resources outside request handler loops without persistent local state.

### 2.3 CloudWatch Logging & Request Tracing
- Execution logs automatically route to `/aws/lambda/${ProjectName}-${Environment}-api`.
- Correlation ID (`X-Request-ID` header or generated UUID) is propagated across every log entry and returned in response headers.
- **Security Policy:** No credentials, secret environment variables, or raw payloads are ever emitted to CloudWatch.

---

## 3. DynamoDB Data Model & Access Patterns

EventGate implements single-purpose, on-demand (`PAY_PER_REQUEST`) DynamoDB tables designed around exact application access patterns.

### 3.1 EventContractsTable
Stores historical and proposed event contract schemas.

- **Partition Key (HASH):** `eventType` (String) — e.g. `"OrderPlaced"`.
- **Sort Key (RANGE):** `version` (Number) — e.g. `1`, `2`, `3`.
- **Billing Mode:** `PAY_PER_REQUEST` (On-Demand).
- **Attributes:**
  - `eventType` (S)
  - `version` (N)
  - `fields` (Map): Nested dictionary of field names to `{ "type": str, "required": bool }`.

#### Access Patterns:
| Operation | Implementation | Scan Used? |
|---|---|:---:|
| `get_event_contract(event_type, version)` | `GetItem(Key={"eventType": event_type, "version": version})` | **NO** |
| `list_event_contracts(event_type)` | `Query(KeyConditionExpression=Key("eventType").eq(event_type))` | **NO** |

### 3.2 ConsumerContractsTable
Stores registered consumer requirements and subscribed fields.

- **Partition Key (HASH):** `consumerId` (String) — e.g. `"billing-service"`.
- **Global Secondary Index (GSI):** `EventTypeIndex`
  - GSI Partition Key (HASH): `eventType` (String) — e.g. `"OrderPlaced"`.
  - GSI Sort Key (RANGE): `consumerId` (String) — e.g. `"billing-service"`.
  - Projection: `ALL`.
- **Billing Mode:** `PAY_PER_REQUEST` (On-Demand).
- **Attributes:**
  - `consumerId` (S)
  - `eventType` (S)
  - `expectedFields` (Map): Nested dictionary of expected field names to `{ "type": str, "required": bool }`.

#### Access Patterns:
| Operation | Implementation | Scan Used? |
|---|---|:---:|
| `get_consumer(consumer_id)` | `GetItem(Key={"consumerId": consumer_id})` | **NO** |
| `list_consumers(event_type)` | `Query(IndexName="EventTypeIndex", KeyConditionExpression=Key("eventType").eq(event_type))` | **NO** |

> [!IMPORTANT]
> **Zero-Scan Policy:** Full-table scans (`Scan`) are strictly prohibited in all application repositories to prevent unbounded latency and escalating AWS costs.

---

## 4. IAM Least-Privilege Policy

The Lambda execution role is restricted to read-only actions on the two application tables:

```yaml
Policies:
  - Statement:
      - Sid: ReadEventContractsTable
        Effect: Allow
        Action:
          - dynamodb:GetItem
          - dynamodb:Query
        Resource: !GetAtt EventContractsTable.Arn
  - Statement:
      - Sid: ReadConsumerContractsTable
        Effect: Allow
        Action:
          - dynamodb:GetItem
          - dynamodb:Query
        Resource:
          - !GetAtt ConsumerContractsTable.Arn
          - !Sub "${ConsumerContractsTable.Arn}/index/*"
```

- No `dynamodb:PutItem`, `UpdateItem`, or `DeleteItem` permissions for the Lambda function.
- No `dynamodb:Scan` permissions.
- No `AdministratorAccess` or broad service permissions.

---

## 5. Storage Backend Strategy (Dual Modes)

EventGate supports two interchangeable persistence modes without modifying domain logic:

```bash
# Mode 1: Local Development (Default)
EVENTGATE_STORAGE_BACKEND=local
# Reads canonical contract JSON fixtures from contracts/

# Mode 2: AWS Serverless Runtime
EVENTGATE_STORAGE_BACKEND=dynamodb
# Reads persisted contract items from DynamoDB tables
```

### Deterministic Equivalence Guarantee
Unit tests in `backend/tests/unit/test_storage_equivalence.py` prove that given identical contract schemas, both `local` and `dynamodb` backends produce **bitwise identical**:
- Decisions (`ALLOW`, `REVIEW`, `BLOCK`)
- Severities (`LOW`, `MEDIUM`, `HIGH`)
- Summaries
- Findings (rule IDs, statuses, fields, reasons)
- ChangeSets
