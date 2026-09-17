# EventGate Frontend Hosting Guide (AWS Amplify Hosting)

This guide specifies the production hosting design and deployment procedures for the **PrimeX EventGate React SPA**.

---

## 1. Hosting Architecture

```text
┌─────────────────────────────────────────────────────────┐
│              Public Frontend Web Clients                 │
│              (Browsers: Chrome / Safari / Edge)          │
└────────────────────────────┬────────────────────────────┘
                             │ HTTPS / CDN
                             ▼
┌─────────────────────────────────────────────────────────┐
│             AWS Amplify Hosting (Global Edge)           │
│     - Managed SSL/TLS Certificate                       │
│     - Global Content Delivery Network (CloudFront Edge) │
│     - SPA Fallback Route (200 Rewrite to /index.html)   │
│     - Continuous Git-based deployment via main branch   │
└────────────────────────────┬────────────────────────────┘
                             │ Direct HTTPS REST Calls
                             ▼
┌─────────────────────────────────────────────────────────┐
│     Existing AWS API Gateway (ap-south-1)                │
│     https://ux8bwi3i8l.execute-api.ap-south-1.amazonaws │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│     Existing EventGate Backend (Untouched)              │
│     Lambda + DynamoDB + EventBridge Custom Bus          │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Production Hosting Specifications

| Parameter | Value / Behavior |
| :--- | :--- |
| **Hosting Service** | **AWS Amplify Hosting** (Static Web App) |
| **Artifact Directory** | `frontend/dist` |
| **Framework** | React 19 + TypeScript + Vite 8 + Tailwind CSS v4 |
| **Build Specification** | [`amplify.yml`](../amplify.yml) |
| **Build Command** | `npm ci && npm run build` |
| **SPA Route Rewrites** | `</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>` $\to$ `/index.html` (Status: `200 Rewrite`) |
| **API Target** | `https://ux8bwi3i8l.execute-api.ap-south-1.amazonaws.com` |
| **Environment Variable** | `VITE_EVENTGATE_API_URL` (Defaults to production API if omitted) |
| **Target AWS Region** | `ap-south-1` (or global edge) |

---

## 3. Pre-Deployment Review & Verification Checklist

### 3.1 Backend Isolation Guarantee
- **Existing Backend Resources:** **UNTOUCHED**. No changes to CloudFormation stack `primex-eventgate-dev`, API Gateway, Lambda function, DynamoDB tables, or EventBridge bus.
- **Contract Schema Integrity:** No changes to event or consumer contracts.
- **Zero Drift:** No SAM template modifications (`template.yaml` remains pristine).

### 3.2 Resources to be Created
When authorized, the deployment creates:
1. **Amplify App**: `primex-eventgate-frontend`
2. **Amplify Branch**: `main` (connected to repository `https://github.com/pratyushkandari/primex-eventgate`)
3. **Managed SSL Certificate**: Automatically provisioned by AWS Certificate Manager (ACM) for `*.amplifyapp.com`.
4. **Custom Security Headers**: Enforces `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin`.

### 3.3 Expected AWS Cost Categories
- **Amplify Hosting Free Tier:**
  - Build & Deploy: 1,000 build minutes per month (free tier).
  - Hosting Data Storage: 5 GB per month (free tier).
  - Data Transfer: 15 GB served per month (free tier).
- **Post-Free-Tier Estimate:** $\approx \$0.00 - \$0.15$ / month for demo workloads.
- **Backend Costs:** Unchanged ($0.00 DynamoDB PAY_PER_REQUEST, custom EventBridge bus $1/M events).

### 3.4 Public URL Behavior
- **Default URL:** `https://main.<unique-id>.amplifyapp.com`
- **HTTPS:** Enforced automatically with HTTP $\to$ HTTPS redirection.
- **Cross-Origin Requests:** The existing API Gateway is already configured with CORS enabled (`AllowOrigins: ["*"]`, `AllowMethods: ["GET", "POST", "OPTIONS"]`).

### 3.5 Rollback Strategy
- **Instant Rollback:** Amplify maintains immutable build artifacts. If an issue arises in a newly published build, a previous deployment can be redeployed instantly with one click in the Amplify Console or via:
  ```powershell
  aws amplify start-deployment --app-id <APP_ID> --branch-name main --job-id <PREVIOUS_JOB_ID>
  ```

---

## 4. Deployment Procedure Options

### Option A: AWS Management Console (Recommended for Hackathon Demo)
1. Open the [AWS Amplify Console](https://console.aws.amazon.com/amplify/home).
2. Click **Deploy an app** $\to$ Select **GitHub** as the source repository.
3. Choose repository `pratyushkandari/primex-eventgate` and branch `main`.
4. Amplify will automatically detect [`amplify.yml`](../amplify.yml) and the `frontend` subfolder.
5. In **Environment variables**, set:
   - `VITE_EVENTGATE_API_URL`: `https://ux8bwi3i8l.execute-api.ap-south-1.amazonaws.com`
6. Click **Save and Deploy**.

### Option B: AWS CLI Manual Deployment
```powershell
# 1. Build production bundle locally
cd frontend
npm ci
npm run build
cd dist
Compress-Archive -Path * -DestinationPath ../build.zip
cd ..

# 2. Deploy bundle to Amplify via AWS CLI
aws amplify create-app --name primex-eventgate-frontend --region ap-south-1
aws amplify create-branch --app-id <APP_ID> --branch-name main --region ap-south-1
aws amplify create-deployment --app-id <APP_ID> --branch-name main --region ap-south-1
# Upload build.zip to the presigned S3 URL returned by create-deployment
aws amplify start-deployment --app-id <APP_ID> --branch-name main --job-id <JOB_ID> --region ap-south-1
```
