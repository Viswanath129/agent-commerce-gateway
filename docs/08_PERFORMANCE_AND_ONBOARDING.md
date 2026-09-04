# ACG Performance Benchmarks & Merchant Onboarding

## Empirical Latency Measurements & Integration Velocity

---

## 1. Canonical Cold-Run Benchmark

```text
===========================================================================
  ACG EMPIRICAL BENCHMARK: TIME-TO-FIRST-AI-TRANSACTION
===========================================================================
Execution Milestones (Cold-Start In-Memory Test):
   ├── 1. Gateway Boot & Policy Engine:      250.30 ms
   ├── 2. Catalog Ingestion & Truth Link:    0.41 ms
   ├── 3. Ed25519 Principal Mandate Sign:    3.15 ms
   └── 4. 6-Phase Zero-Trust Agent Checkout: 49.95 ms

🚀 TOTAL TIME-TO-FIRST-AI-TRANSACTION (Cold Run): 303.81 ms
   ├── Gateway Response Status: 201 Created
   ├── Razorpay Order Created:  order_d753597e364a8240
   └── Policy Version Pinned:   pol_v1.0.0
===========================================================================
```

### Benchmark Metadata:
* **Canonical Headline Value:** **303.81 ms** (Measured cold-run end-to-end order creation)
* **Command:** `npm run benchmark`
* **Test Environment:** Node.js v22 (x64 Windows 11), in-memory SQLite ACID store.

---

## 2. Merchant Onboarding Velocity (10–12 Minutes)

| Setup Phase | Description | Estimated Time |
| :--- | :--- | :---: |
| **Step 1: Environment & Keys** | Configure `.env` with Razorpay API credentials | ~3–5 mins |
| **Step 2: Policy DSL Definition** | Configure JSON Policy DSL (Allowed categories & transaction caps) | ~2 mins |
| **Step 3: Catalog Database Link** | Connect SQLite/Postgres product catalog | ~5 mins |
| **Total Integration Velocity** | **Complete Merchant Setup** | **~10–12 minutes** |

---

## 3. Appendix: Historical Benchmark Runs (Reference Only)

* `2026-09-01 Initial Prototype`: 338.08 ms
* `2026-09-02 Test Run B`: 295.98 ms
* `2026-09-03 Pre-Freeze Run`: 282.94 ms
* **Active Verified Canonical Baseline:** **303.81 ms**
