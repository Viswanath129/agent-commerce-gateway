# AGENT COMMERCE GATEWAY (ACG) — RAW TEST RESULTS LOG

**Execution Environment:** Node.js v22+ / Fastify / Native SQLite  
**Execution Timestamp:** 2026-08-22T05:48:12Z  
**Total Live Tests Executed:** 19 live HTTP & protocol test cases  
**Total Passed:** 19 (100%)  
**Total Failed:** 0  

---

## Complete Test Case Execution Telemetry

| Test ID | Category | Title | Method & Route | Status | Expected | Latency | Result |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **RECON-01** | Reconnaissance | Probe Public Catalog Endpoint | `GET /catalog` | `200` | `200` | 25.84 ms | **PASS** |
| **RECON-02** | Reconnaissance | Probe Undefined Debug/Admin Route | `GET /admin/debug` | `404` | `404` | 1.87 ms | **PASS** |
| **AUTH-01** | Auth & Mandate | Reject Tampered Mandate Budget | `POST /v1/agent/checkout` | `401` | `401` | 45.97 ms | **PASS** |
| **AUTH-02** | Auth & Mandate | Reject Expired Mandate | `POST /v1/agent/checkout` | `403` | `403` | 37.87 ms | **PASS** |
| **LOGIC-01** | Commerce Truth | Ignore LLM Price (DB Price Wins) | `POST /v1/agent/checkout` | `201` | `201` | 56.59 ms | **PASS** |
| **LOGIC-02** | Business Logic | Reject Mandate Budget Exceeded | `POST /v1/agent/checkout` | `403` | `403` | 27.55 ms | **PASS** |
| **LOGIC-03** | Business Logic | Reject Un-whitelisted Category | `POST /v1/agent/checkout` | `403` | `403` | 32.13 ms | **PASS** |
| **CONCUR-01** | Concurrency | 10 Parallel Agents Double-Spend Race | `POST /v1/agent/checkout` | `201 / 409` | `1 Allowed / 9 Blocked` | 427.16 ms | **PASS** |
| **REPLAY-01** | Replay | Reject Duplicate Intent ID Submission | `POST /v1/agent/checkout` | `409` | `409` | 1.82 ms | **PASS** |
| **WEBHOOK-01** | Webhook | Reject Forged Webhook Signature | `POST /webhooks/razorpay` | `401` | `401` | 2.70 ms | **PASS** |
| **REFUND-01** | Refund Safety | Block Refund on Uncaptured Order | `INTERNAL /rails/refund` | `200` (Blocked) | `Capture Requisite Enforced` | 5.20 ms | **PASS** |
| **POL-01** | Policy Mutation | Mutate Policy in Real-Time | `PUT /v1/merchant/policy` | `200` | `200` | 3.33 ms | **PASS** |
| **POL-02** | Policy Mutation | Enforce Mutated Policy Limit | `POST /v1/agent/checkout` | `403` | `403` | 28.90 ms | **PASS** |
| **REV-01** | Revocation | Principal Issues Mandate Revocation | `POST /v1/mandates/revoke` | `200` | `200` | 9.72 ms | **PASS** |
| **REV-02** | Revocation | Block Rogue Checkout on Revoked Mandate | `POST /v1/agent/checkout` | `403` | `403` | 20.63 ms | **PASS** |
| **INPUT-01** | Input Validation| Reject Negative Item Quantity | `POST /v1/agent/checkout` | `400` | `400` | 4.09 ms | **PASS** |
| **INPUT-02** | Input Validation| Neutralize SQL Injection in SKU | `POST /v1/agent/checkout` | `400` | `400` | 23.50 ms | **PASS** |
| **AUDIT-01** | Audit Integrity | Verify Valid 92-Block Hash Chain | `GET /audit/integrity` | `200` | `200` | 4.10 ms | **PASS** |
| **AUDIT-02** | Audit Integrity | Detect Adversarial DB Row Tamper | `GET /audit/integrity` | `200` (Tamper Detected) | `Flag Block Integrity Mismatch` | 3.80 ms | **PASS** |
