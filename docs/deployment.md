# EventGate Deployment Guide (Phase 2)

This guide documents the end-to-end steps to build, validate, deploy, and seed EventGate on AWS Serverless infrastructure using AWS SAM and Amazon DynamoDB.

All commands use Windows PowerShell-compatible syntax.

---

## 1. Prerequisites

Before deploying to AWS, verify that the following tools are installed and configured:

```powershell
# Verify Python version (3.14 recommended)
python --version

# Verify AWS CLI installation & credential identity
aws --version
aws sts get-caller-identity
aws configure get region

# Verify AWS SAM CLI installation
sam --version

# Verify Docker daemon is running (for SAM local testing)
docker --version
```

> [!CAUTION]
> **Pre-Flight Safety Check:**
> Never proceed to deployment if `aws sts get-caller-identity` fails or indicates an unknown AWS account. Always confirm your deployment target account and region before running `sam deploy`.

---

## 2. Infrastructure Build & Validation

### 2.1 Validate the SAM Template
Validate `template.yaml` for syntax, specification conformance, and resource definitions:

```powershell
sam validate --lint
```

### 2.2 Build the Serverless Artifacts
Package dependencies from `backend/src/requirements.txt` into the deployment directory `.aws-sam/`:

```powershell
sam build
```

---

## 3. Local SAM Emulation (Optional)

You can invoke the Lambda function locally with simulated API Gateway events:

```powershell
# Health check test
sam local invoke EventGateFunction -e events/health.json

# Analysis scenario A (v1 -> v2)
sam local invoke EventGateFunction -e events/analyze-v2.json

# Run local API Gateway HTTP server on port 3000
sam local start-api --port 3000
```

---

## 4. Deployment to AWS

### 4.1 First-Time Guided Deployment
Run guided deployment to review configuration parameters:

```powershell
sam deploy --guided `
  --stack-name primex-eventgate-dev `
  --capabilities CAPABILITY_IAM `
  --parameter-overrides ProjectName="primex-eventgate" Environment="dev"
```

### 4.2 Subsequent Automated Deployments
Use the committed, non-secret `samconfig.toml`:

```powershell
sam deploy
```

### 4.3 Retrieve Stack Outputs
Capture the deployed API Gateway endpoint URL and generated DynamoDB table names:

```powershell
aws cloudformation describe-stacks `
  --stack-name primex-eventgate-dev `
  --query "Stacks[0].Outputs" `
  --output table
```

Expected output keys:
- `ApiUrl` (e.g. `https://abc123xyz.execute-api.us-east-1.amazonaws.com`)
- `EventContractsTableName` (e.g. `primex-eventgate-dev-event-contracts`)
- `ConsumerContractsTableName` (e.g. `primex-eventgate-dev-consumer-contracts`)
- `LambdaFunctionName` (e.g. `primex-eventgate-dev-api`)

---

## 5. DynamoDB Seeding

After the CloudFormation stack completes, populate the DynamoDB tables from the canonical local contract fixtures:

```powershell
python scripts/seed_dynamodb.py `
  --event-table primex-eventgate-dev-event-contracts `
  --consumer-table primex-eventgate-dev-consumer-contracts `
  --region ap-south-1 `
  --contracts-dir contracts
```

### Seeding Idempotency
The seed script uses `put_item`, allowing it to be safely rerun at any time without creating duplicate records or modifying unaffected versions.

---

## 6. Smoke Testing Deployed AWS Endpoints

### 6.1 Automated Smoke Test Script
Run the comprehensive smoke test against your live API Gateway URL:

```powershell
python scripts/aws_smoke_test.py https://ux8bwi3i8l.execute-api.ap-south-1.amazonaws.com
```

### 6.2 Manual Verification with curl / Invoke-RestMethod

#### Health Check:
```powershell
Invoke-RestMethod -Uri "https://abc123xyz.execute-api.us-east-1.amazonaws.com/health" -Method GET
```
Expected response:
```json
{
  "status": "ok",
  "service": "eventgate",
  "version": "0.1.0"
}
```

#### Scenario A: v1 -> v2 (Safe / Optional Field Added)
```powershell
Invoke-RestMethod -Uri "https://abc123xyz.execute-api.us-east-1.amazonaws.com/api/v1/analyze" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"eventType": "OrderPlaced", "currentVersion": 1, "proposedVersion": 2}'
```
Expected: `decision: "ALLOW"`, `severity: "LOW"`.

#### Scenario B: v1 -> v3 (Breaking / Field Type Changed)
```powershell
Invoke-RestMethod -Uri "https://abc123xyz.execute-api.us-east-1.amazonaws.com/api/v1/analyze" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"eventType": "OrderPlaced", "currentVersion": 1, "proposedVersion": 3}'
```
Expected: `decision: "BLOCK"`, `severity: "HIGH"`, inventory-service `BREAK`.

#### Scenario C: v1 -> v4 (Risk / Optional Field Removed)
```powershell
Invoke-RestMethod -Uri "https://abc123xyz.execute-api.us-east-1.amazonaws.com/api/v1/analyze" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"eventType": "OrderPlaced", "currentVersion": 1, "proposedVersion": 4}'
```
Expected: `decision: "REVIEW"`, `severity: "MEDIUM"`, analytics-service `RISK`.

---

## 7. CloudWatch Logs Inspection

To stream Lambda execution logs and verify correlation IDs:

```powershell
aws logs tail "/aws/lambda/primex-eventgate-dev-api" --follow
```
