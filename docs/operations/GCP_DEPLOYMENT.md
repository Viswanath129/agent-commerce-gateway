# Google Cloud Run Production Deployment Guide: Agent Commerce Gateway (ACG)

## 1. Executive Summary & Architecture
Agent Commerce Gateway (ACG / MACCP) is packaged as a high-density, unified single-container microservice delivering both the Fastify control plane API and the Vite-powered React Luxury Operations Dashboard from a single origin.

### Runtime Architecture on Google Cloud Run
```
                 ┌─────────────────────────────────────────────────────────┐
                 │                 Google Cloud Platform                   │
                 │                                                         │
  HTTP Request ──┼──► [ Cloud Run (Fully Managed / Serverless HTTPS) ]    │
                 │         │                                               │
                 │         ▼                                               │
                 │    [ Container: node:22-alpine / User: node ]           │
                 │         ├── Fastify Ingress Router (Port 3000)          │
                 │         │   ├── /v1/agent/checkout (Zero-Trust Gate)    │
                 │         │   ├── /v1/commerce/chat (AI Buyer + Recs)    │
                 │         │   ├── /v1/analytics/revenue (Attribution)     │
                 │         │   ├── /dashboard/* (Admin Metrics & Scopes)   │
                 │         │   └── /webhooks/razorpay (Raw HMAC Validator) │
                 │         ├── Static Asset Engine (/public - Vite SPA)    │
                 │         └── SQLite3 Ledger & Catalog (/app/data)        │
                 └─────────────────────────────────────────────────────────┘
```

---

## 2. Containerization & Multi-Stage Dockerfile

The repository utilizes a multi-stage `Dockerfile` optimizing build caching and final production runtime weight:
- **Build Stage (`node:22-alpine`):** Compiles TypeScript sources (`dist/src/server.js`) and builds Vite SPA assets (`public/`).
- **Production Stage (`node:22-alpine`):** Includes only production dependencies, runs as non-root user `node` (UID 1000), binds to port 3000, and isolates database volumes in `/app/data/`.

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json vite.config.ts ./
COPY frontend/ ./frontend/
COPY src/ ./src/
RUN npm ci
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/app/data/acg_gateway.db

RUN mkdir -p /app/data && chown -R node:node /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/v1/health || exit 1

CMD ["node", "dist/src/server.js"]
```

---

## 3. Environment Variables & Secret Configuration

Set the following runtime environment variables in Google Cloud Run or Secret Manager:

| Variable Name | Required | Default / Description |
|---|---|---|
| `PORT` | Yes | `3000` (Assigned by Cloud Run or defaulted) |
| `HOST` | Yes | `0.0.0.0` |
| `NODE_ENV` | Yes | `production` |
| `DATABASE_PATH` | Yes | `/app/data/acg_gateway.db` |
| `MERCHANT_ADMIN_TOKEN` | Yes | Bearer token for Control Plane `/dashboard/*` endpoints |
| `RAZORPAY_KEY_ID` | Yes | Merchant Razorpay Key ID (`rzp_test_...`) |
| `RAZORPAY_KEY_SECRET` | Yes | Merchant Razorpay Key Secret |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | HMAC SHA-256 Webhook Secret |

---

## 4. Deployment Instructions

### Prerequisites
1. Ensure the Google Cloud SDK (`gcloud`) is installed and authenticated:
   ```bash
   gcloud auth login
   gcloud config set project <YOUR_PROJECT_ID>
   ```
2. Ensure Cloud Run and Artifact Registry APIs are enabled:
   ```bash
   gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
   ```
3. Attach an active Cloud Billing account to `<YOUR_PROJECT_ID>`.

### Step-by-Step Google Cloud Run Deployment
```bash
# 1. Build and push image using Cloud Build
gcloud builds submit --tag gcr.io/<YOUR_PROJECT_ID>/acg-gateway:v1.0.0

# 2. Deploy container to Google Cloud Run
gcloud run deploy acg-gateway \
  --image gcr.io/<YOUR_PROJECT_ID>/acg-gateway:v1.0.0 \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10 \
  --set-env-vars="NODE_ENV=production,DATABASE_PATH=/app/data/acg_gateway.db,MERCHANT_ADMIN_TOKEN=acg_admin_token_2026"
```

---

## 5. Live Cloud Verification

Once deployed, run the automated verification suite against the assigned Cloud Run URL:
```bash
npx tsx scripts/verify_gcp_deployment.ts https://<SERVICE_NAME>-<HASH>-<REGION>.a.run.app
```

Expected output: `GCP DEPLOYMENT LIVE VERIFICATION SUMMARY: 23 / 23 PASSED (100%)`.

---

## 6. Operational Constraints & Truth-in-Engineering Disclosures
- **Persistence Boundary:** SQLite single-instance container storage. For multi-region autoscaling with high concurrency, use Cloud SQL (PostgreSQL schema provided in `src/store/postgres_schema.sql`).
- **Payment Processing Status:** Operates on Razorpay Test-Mode and Deterministic Contract Test Harness. Live settlement requires production Razorpay credentials and merchant activation.
