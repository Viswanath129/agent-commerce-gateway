# ACG Adversarial & Penetration Testing Report

## 19 Live HTTP Vectors & 77 Automated Tests

---

## 1. Executive Testing Summary

* **Automated Unit & Integration Tests:** **77 / 77 Passing** across 9 test files.
* **Live Penetration Tests (`npm run pentest`):** **19 / 19 Vectors Passed** (100% Intercepted).
* **Unauthorized Financial-Impact Paths Observed:** **0**.

---

## 2. Live HTTP Penetration Test Matrix

| Test ID | Category | Attack Scenario | Expected HTTP | Observed HTTP | Financial Effect | Result |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **AUTH-01** | Cryptographic | Valid Ed25519 Mandate Signature | 201 | 201 | Authorized | **PASS** |
| **AUTH-02** | Cryptographic | Tampered Mandate Budget | 401 | 401 | None | **PASS** |
| **AUTH-03** | Temporal | Expired Buyer Mandate | 403 | 403 | None | **PASS** |
| **LOGIC-01**| Commerce Truth | Hallucinated Price (DB Price Wins) | 201 | 201 | Authorized (DB total)| **PASS** |
| **LOGIC-02**| Policy | Mandate Budget Limit Exceeded | 403 | 403 | None | **PASS** |
| **LOGIC-03**| Policy | Category Not Permitted in Mandate | 403 | 403 | None | **PASS** |
| **CONCUR-01**| Concurrency | 10 Parallel Subagents Competing | 1x201, 9x409| 1x201, 9x409| 1 Order Created | **PASS** |
| **REPLAY-01**| Replay Gate | Duplicate `intent_id` Submission | 409 | 409 | None | **PASS** |
| **WEBHOOK-01**| Webhook | Forged HMAC SHA-256 Signature | 401 | 401 | None | **PASS** |
| **REFUND-01**| Refund Safety | Pre-Capture Refund Attempt | 200 (Blocked)| 200 (Blocked)| None | **PASS** |
| **POL-01** | Dynamic Policy| Real-Time Policy Update to v2.0.0 | 200 | 200 | None | **PASS** |
| **POL-02** | Dynamic Policy| Over-Cap Checkout vs Mutated Policy | 403 | 403 | None | **PASS** |
| **REV-01** | Revocation | Principal Issues Mandate Revocation | 200 | 200 | None | **PASS** |
| **REV-02** | Revocation | Rogue Agent on Revoked Mandate | 403 | 403 | None | **PASS** |
| **INPUT-01**| Sanitization | Negative Item Quantity (`-5`) | 400 | 400 | None | **PASS** |
| **INPUT-02**| Sanitization | SQL Injection in SKU Parameter | 400 | 400 | None | **PASS** |
| **AUDIT-01**| Provenance | Verify Valid Cryptographic Hash Chain | 200 | 200 | None | **PASS** |
| **AUDIT-02**| Provenance | Detect Adversarial Record Tampering | 200 (Tamper)| 200 (Tamper)| None | **PASS** |
| **AUTH-SCOPE**| API Auth | Viewer Token on Privileged Route | 403 | 403 | None | **PASS** |
