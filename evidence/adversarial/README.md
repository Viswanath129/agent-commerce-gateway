# Adversarial Penetration Testing Evidence

## Verification Artifact

* **What was tested:** 19 live HTTP attack vectors including high-concurrency races, replayed intents, forged webhooks, pre-capture refunds, policy mutations, mandate revocations, SQL injections, and audit tampering.
* **How it was tested:** `src/demo/pentest_runner.ts` executing real HTTP inject requests against Fastify and SQLite.
* **When it was tested:** September 3, 2026.
* **Reproduction Command:** `npm run pentest`
* **Raw Artifact:** Results persisted in `reports/pentest/raw_results.json`.
* **Expected Result:** 19 / 19 vectors intercepted and mitigated.
* **Observed Result:** **19 / 19 passed** (0 breaches, 0 unauthorized financial impact paths).
