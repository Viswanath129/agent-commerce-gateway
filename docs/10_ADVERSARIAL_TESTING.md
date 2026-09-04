# ACG Adversarial & Penetration Testing Report

## 19 Live HTTP Vectors & 77 Automated Tests

---

## 1. Executive Testing Summary

* **Automated Unit & Integration Tests:** **77 / 77 Passing** across 9 test files.
* **Live Penetration Tests (`npm run pentest`):** **19 / 19 Vectors Passed** (100% Intercepted).
* **Unauthorized Financial-Impact Paths Observed:** **0**.

---

## 2. Live HTTP Penetration Test Matrix

| Test ID | Category | Attack Scenario | Expected HTTP | Observed HTTP | Financial Effect | Audit Status | Result |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **AUTH-01** | Cryptographic | Valid Ed25519 Mandate Signature | 201 | 201 | Authorized | `MANDATE_VERIFIED` | **PASS** |
| **AUTH-02** | Cryptographic | Tampered Mandate Budget | 401 | 401 | None | `SIGNATURE_VERIFICATION_FAILED`| **PASS** |
| **AUTH-03** | Temporal | Expired Buyer Mandate | 403 | 403 | None | `POLICY_VIOLATION` | **PASS** |
| **LOGIC-01**| Commerce Truth | Hallucinated Price (DB Price Wins) | 201 | 201 | Authorized (DB total)| `COMMERCE_TRUTH_RESOLVED` | **PASS** |
| **LOGIC-02**| Policy | Mandate Budget Limit Exceeded | 403 | 403 | None | `POLICY_VIOLATION` | **PASS** |
| **LOGIC-03**| Policy | Category Not Permitted in Mandate | 403 | 403 | None | `POLICY_VIOLATION` | **PASS** |
| **CONCUR-01**| Concurrency | 10 Parallel Subagents Competing | 1x201, 9x409| 1x201, 9x409| 1 Order Created | `DUAL_RESERVATION_HELD` | **PASS** |
| **REPLAY-01**| Replay Gate | Duplicate `intent_id` Submission | 409 | 409 | None | Blocked at Session Gate | **PASS** |
| **WEBHOOK-01**| Webhook | Forged HMAC SHA-256 Signature | 401 | 401 | None | Rejected before DB read | **PASS** |
| **REFUND-01**| Refund Safety | Pre-Capture Refund Attempt | 200 (Blocked)| 200 (Blocked)| None | State remained `ORDER_CREATED` | **PASS** |
| **POL-01** | Dynamic Policy| Real-Time Policy Update to v2.0.0 | 200 | 200 | None | Policy pinned to `pol_v2.0.0` | **PASS** |
| **POL-02** | Dynamic Policy| Over-Cap Checkout vs Mutated Policy | 403 | 403 | None | `POLICY_VIOLATION` | **PASS** |
| **REV-01** | Revocation | Principal Issues Mandate Revocation | 200 | 200 | None | Revocation logged in DB | **PASS** |
| **REV-02** | Revocation | Rogue Agent on Revoked Mandate | 403 | 403 | None | `MANDATE_REVOKED` | **PASS** |
| **INPUT-01**| Sanitization | Negative Item Quantity (`-5`) | 400 | 400 | None | Zod Schema Rejection | **PASS** |
| **INPUT-02**| Sanitization | SQL Injection in SKU Parameter | 400 | 400 | None | `COMMERCE_TRUTH_REJECTION` | **PASS** |
| **AUDIT-01**| Provenance | Verify Valid Cryptographic Hash Chain | 200 | 200 | None | 96 blocks verified intact | **PASS** |
| **AUDIT-02**| Provenance | Detect Adversarial Record Tampering | 200 (Tamper)| 200 (Tamper)| None | Broken hash chain detected | **PASS** |
| **AUTH-SCOPE**| API Auth | Viewer Token on Privileged Route | 403 | 403 | None | Blocked at Bearer Scope Gate | **PASS** |
