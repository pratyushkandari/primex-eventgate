# Deployment

The AWS stack is defined in `template.yaml` (AWS SAM) and deployed as `primex-eventgate-dev` in `ap-south-1` using the defaults in `samconfig.toml`. The console is hosted on AWS Amplify, built from `frontend/` by `amplify.yml`, with response headers from `customHttp.yml`.

## Resources

| Resource | Name | Notes |
| --- | --- | --- |
| HTTP API | `EventGateHttpApi` | Routes `/health` and `/{proxy+}` to the API Lambda; CORS for any origin; default throttling 20 req/s, burst 40 |
| Lambda | `primex-eventgate-dev-api` | Python 3.14, 256 MB, 10 s; code from `backend/src` (includes the Cedar policy and `requirements.txt`) |
| DynamoDB | `…-event-contracts`, `…-consumer-contracts`, `…-release-history` | On-demand billing; keys and indexes in [architecture.md](architecture.md#dynamodb) |
| EventBridge | `primex-eventgate-dev-bus` and rule `…-order-placed-rule` | Routes `OrderPlaced` events to three demo consumer Lambdas |
| IAM | Function policies | GetItem/Query on the contract tables, GetItem/PutItem/Query on history, PutEvents on the bus only |

The Lambda environment sets `EVENTGATE_STORAGE_BACKEND=dynamodb`, `EVENTGATE_EVENT_PUBLISHER=eventbridge` and the table and bus names. To use the Cedar engine, add `EVENTGATE_POLICY_ENGINE: cedar` to the function's environment.

## Deploy the backend

Prerequisites: AWS CLI with credentials for the target account (`aws sts get-caller-identity`), SAM CLI, Python 3.14 (or Docker for `sam build --use-container`).

```bash
sam validate --lint
sam build
sam deploy                      # first time: sam deploy --guided
aws cloudformation describe-stacks --stack-name primex-eventgate-dev --query "Stacks[0].Outputs"
```

Then load the contracts and the catalog items the API uses to list event types and consumers:

```bash
python scripts/seed_dynamodb.py --region ap-south-1
```

The script reads `contracts/`, validates each file, and overwrites items with PutItem, so it is safe to re-run after changing contracts. Table names default to the dev stack; override them with `--event-table` and `--consumer-table`.

## Verify

```bash
python scripts/aws_smoke_test.py <ApiUrl>
```

Checks `/health` and the three sample analyses (ALLOW, BLOCK, REVIEW). It writes three history records.

```bash
python scripts/aws_enforcement_smoke_test.py <ApiUrl> --stack-name primex-eventgate-dev --region ap-south-1
```

Publishes one ALLOWed event to the real bus, confirms the blocked and held changes return 409, and reads the consumer Lambdas' CloudWatch logs to confirm which consumers received an event. Needs credentials that can read the stack outputs and CloudWatch Logs.

## Local Lambda emulation

With Docker running, `sam local invoke EventGateFunction -e events/analyze-v2.json` runs the Lambda handler on a sample API Gateway event (`events/` also has `health.json`, `analyze-v3.json` and `analyze-v4.json`), and `sam local start-api` serves the API on port 3000. Without Docker, `uvicorn eventgate.main:app` runs the same application code.

## Console (Amplify)

The Amplify app builds on every push to `main`: `npm ci` and `npm run build` in `frontend/`, publishing `frontend/dist`. `customHttp.yml` at the repository root adds `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin` to every response. Amplify ignores headers placed in `amplify.yml`, and a header change takes effect on the next build. Production builds call the deployed API URL in `frontend/src/config/env.ts` unless `VITE_EVENTGATE_API_URL` is set in the Amplify environment. Pages use hash URLs (`#/history`), so no rewrite rules are needed.
