# Vercel integration

## Architecture

Vercel serves the React/Vite SPA from `public/`. Requests for ACG gateway
routes (`/v1/*`, `/dashboard/*`, `/catalog`, `/webhooks/*`, `/audit/*`, and
`/adapters/*`) are rewritten to the bundled `api/gateway.js` serverless
function. The function adapts the native Node request to the existing Fastify
application with `app.inject`; it does not proxy to a mock service or replace
any domain logic. Browser API calls are same-origin paths.

The dashboard deliberately requires an operator to enter a server-issued
bearer token at runtime. The token is retained only in `sessionStorage`; no
`VITE_*` credential is supported or emitted into the browser bundle.

## Vercel demo mode and persistence

Vercel does not provide a durable, shared filesystem suitable for the ACG
SQLite financial ledger. The Vercel function therefore refuses to initialize
unless `VERCEL_DEMO=1` is configured, and it uses `:memory:` for that explicit
demo mode. A cold start or a second function instance has independent state.

This is suitable only for deterministic UI/API demonstration. It is **not** a
durable financial deployment: atomicity, ledger continuity, idempotency, and
budget state cannot extend across instances. Do not connect live settlement
traffic to this mode. The repository's PostgreSQL schema is the starting point
for a production persistence implementation; it has not been wired or
verified by this Vercel adapter.

## Environment variables

Set these only in Vercel's server-side environment configuration:

| Variable | Required when | Purpose |
| --- | --- | --- |
| `VERCEL_DEMO=1` | Vercel deployment | Explicitly enables non-durable in-memory demo runtime. |
| `ACG_ADMIN_TOKEN` | Production control-plane write access | Merchant administrator bearer credential. |
| `ACG_VIEWER_TOKEN` | Viewer access | Read-only merchant credential. |
| `ACG_AUDIT_TOKEN` | Separate audit access | Audit bearer credential. |
| `RAZORPAY_KEY_ID` | Razorpay rail configured | Razorpay API key identifier. |
| `RAZORPAY_KEY_SECRET` | Razorpay rail configured | Razorpay API secret. |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook ingress | Raw-body HMAC-SHA256 verification secret. |
| `NODE_ENV=production` | Production | Disables local fallback credentials. |

No public environment variable is required. In particular, never set
`VITE_ACG_MERCHANT_TOKEN`, Razorpay secrets, or ACG bearer tokens in a Vite
environment variable.

## Deploy prerequisites

Run `npm run build`, then deploy the existing project with the Vercel CLI from
the repository root after authenticating (`vercel login` or an approved
`VERCEL_TOKEN`). Use `vercel --prod`; do not treat a preview URL as production.
The Vercel project must set the variables above before deployment.

The Vercel adapter reports initialization failures without logging request
headers, bearer tokens, webhook secrets, or payloads.
