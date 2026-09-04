# Performance Benchmark Evidence

## Verification Artifact

* **What was tested:** Cold-start end-to-end transaction latency measuring gateway boot, catalog ingestion, Ed25519 signature, and 6-phase zero-trust checkout.
* **How it was tested:** `src/demo/benchmark.ts` using high-resolution performance timers (`performance.now()`).
* **When it was tested:** September 3, 2026.
* **Reproduction Command:** `npm run benchmark`
* **Expected Result:** Sub-500ms total cold-start transaction latency.
* **Observed Result:** **303.81 ms** total time-to-first-AI-transaction.
  * Gateway Boot & Policy Engine: 250.30 ms
  * Catalog Ingestion: 0.41 ms
  * Ed25519 Mandate Sign: 3.15 ms
  * 6-Phase Agent Checkout: 49.95 ms
