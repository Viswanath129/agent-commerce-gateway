# ACG Vercel deployment report

- Deployment timestamp: Not deployed during this verification run.
- Vercel project: Not authenticated / not identified.
- Production URL: None.
- Deployment architecture: Vite SPA in `public` with a same-origin Fastify
  serverless adapter at `api/gateway.js`.
- Persistence qualification: `VERCEL_DEMO=1` uses in-memory SQLite only; it is
  non-durable and not suitable for financial production state.
- Razorpay qualification: CONTRACT VERIFIED / TEST MODE only; no live
  settlement evidence recorded.
- Local verification: `npm test` passed 110/110 tests; `npm run pentest`
  passed 19/19 scenarios; `npm run audit:verify` validated 256, 28, and 60
  blocks in its three local ledgers; `npm run build` passed. The local
  Vercel-adapter smoke request to `/v1/health` returned `200`.
- Benchmark: 314.49 ms measured local cold time-to-first AI transaction.
- Live HTTP and browser verification: Not performed because no authenticated
  Vercel production deployment was available.

Local build and security-gate results are appended only after their commands
complete. Historical red-team replay results must be taken from the actual
test/pentest output, never asserted from this template.
