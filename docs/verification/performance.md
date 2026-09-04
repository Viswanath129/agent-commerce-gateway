# ACG Performance Benchmarks

## Cold-Start Latency Measurements

---

## 1. Canonical Cold-Run Benchmark

* **Headline Metric:** **303.81 ms** (Measured cold-run end-to-end Razorpay order creation).
* **Command:** `npm run benchmark`
* **Milestones:**
  * Gateway Boot & Policy Engine: 250.30 ms
  * Catalog Ingestion & Truth Link: 0.41 ms
  * Ed25519 Principal Mandate Sign: 3.15 ms
  * 6-Phase Zero-Trust Checkout: 49.95 ms

---

## 2. Appendix: Historical Reference Runs
* Historical run 1: 338.08 ms
* Historical run 2: 295.98 ms
* Historical run 3: 282.94 ms
* **Active Verified Baseline:** **303.81 ms**
