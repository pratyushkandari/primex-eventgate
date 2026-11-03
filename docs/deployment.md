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

## How changes reach the live stack

| What changed | What deploys it | When |
| --- | --- | --- |
| `frontend/`, `amplify.yml`, `customHttp.yml` | Amplify Hosting (auto-build on `main`) | Every push to `main` |
| `backend/src/`, `template.yaml`, `contracts/` | `.github/workflows/deploy.yml` (`sam deploy`, then the seed script) | After CI passes on a push to `main` |

Other branches are not deployed. The manual steps below still work and are the fallback when the workflow is not set up.

## Automatic deploys

`.github/workflows/deploy.yml` runs when the CI workflow finishes successfully for a push to `main`, or by hand from the Actions tab (Deploy API, Run workflow). It runs `sam build` and `sam deploy` for `primex-eventgate-dev`, loads `contracts/` with `scripts/seed_dynamodb.py`, and checks `/health` and the error envelope on the deployed API. Deploys never run in parallel and are never cancelled midway.

GitHub gets AWS access through the IAM role in `infra/github-deploy-role.yaml`; no AWS keys are stored in GitHub. Only jobs on the `main` branch of this repository can assume the role, and it can only change this stack's resources (functions, tables, event bus, HTTP API and the functions' roles, all named `primex-eventgate-dev-*`). It cannot delete DynamoDB tables or change its own permissions. Anyone who can push to `main` can change what the stack's function roles allow, so protect `main` (require pull requests) if others get write access.

One-time setup, with an administrator's credentials:

```bash
aws cloudformation deploy --template-file infra/github-deploy-role.yaml --stack-name primex-eventgate-github-deploy --capabilities CAPABILITY_NAMED_IAM --region ap-south-1
aws cloudformation describe-stacks --stack-name primex-eventgate-github-deploy --region ap-south-1 --query "Stacks[0].Outputs[0].OutputValue" --output text
```

Then in GitHub, Settings, Secrets and variables, Actions, Variables, add `AWS_DEPLOY_ROLE_ARN` with the role ARN printed by the second command. Until the variable exists the deploy job is skipped. Deleting the `primex-eventgate-github-deploy` stack removes the role and GitHub's access.

## Deploy the backend by hand

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
