# Vercel deployment runbook

1. Install exact dependencies: `npm ci`.
2. Run the local gates: `npm test`, `npm run pentest`, `npm run audit:verify`,
   `npm run benchmark`, and `npm run build`.
3. In the intended Vercel project, set `NODE_ENV=production`, `VERCEL_DEMO=1`,
   and unique server-only ACG/Razorpay credentials required for the selected
   integration. Never upload `.env`.
4. Authenticate to Vercel and run `npx vercel --prod` from the repository root.
5. Record the returned URL and run the verification matrix in
   `docs/verification/VERCEL_VERIFICATION.md`.

## Route behavior

Static files and the SPA are served from `public/`. The Vite dashboard uses
hash navigation, so browser refresh does not require an application route
rewrite. The fallback also returns `index.html` for non-API SPA paths.

The following server routes are forwarded without changing their gateway path:
`/v1/*`, `/dashboard/*`, `/catalog`, `/webhooks/*`, `/audit/*`, and
`/adapters/*`. All other routes fall back to the SPA.

## Qualification

`VERCEL_DEMO=1` is an explicit single-instance/in-memory demonstration mode,
not a production financial-state deployment. It preserves all application
authorization checks, but storage is lost across cold starts and cannot be
shared across instances. A durable shared transactional database plus a
verified distributed reservation design is required before operating ACG as a
production financial control plane on serverless infrastructure.

Razorpay remains **CONTRACT VERIFIED / TEST MODE** unless live provider
network evidence is independently captured. Do not label this deployment as
live settlement merely because a Vercel URL is reachable.
