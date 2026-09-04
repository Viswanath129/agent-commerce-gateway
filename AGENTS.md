# AGY Desktop Agent — Repository Rules & Operating Guidelines

## Core Thesis
> **“The model can propose anything. It cannot authorize anything.”**  
> **“AI proposes. ACG authorizes. Razorpay executes.”**

---

## 1. Operating Rules & Non-Negotiable Invariants

1. **Zero Direct Financial Execution:** AI models or autonomous agents can NEVER directly trigger financial execution without passing the complete 6-phase authorization pipeline.
2. **Merchant Truth Primacy:** Authoritative prices, GST rates, and inventory stock must be read exclusively from the merchant database. Never trust agent-provided arithmetic or price claims.
3. **Mandate Revocation Checked at Authorization:** Always query the revocation registry in Phase 2a before evaluating policy or locking resources.
4. **Atomic Dual-Resource Locking:** Budget paise deductions and inventory unit stock decrements must occur in a single serialized ACID transaction.
5. **HMAC Webhook Verification:** Webhook payloads must be verified with constant-time HMAC SHA-256 before any state transition occurs.
6. **Fail-Closed Principle:** If any validation, policy check, or rail execution fails, all reservations must be immediately rolled back.
7. **Tamper-Evident Ledger:** All state transitions must append to the SHA-256 forward-chained audit ledger.

---

## 2. Essential Commands

* **Run Tests:** `npm test`
* **Run Adversarial Pentest:** `npm run pentest`
* **Run Benchmark:** `npm run benchmark`
* **Verify Audit Ledger:** `npm run audit:verify`
* **Production Build:** `npm run build`

---

## 3. Documentation & Evidence Sources of Truth

* **Canonical Benchmark Baseline:** **303.81 ms**
* **Automated Tests:** **77 / 77 Passing**
* **Live Penetration Scenarios:** **19 / 19 Blocked**
* **Verified Audit Blocks:** **307 Blocks**
* **Documentation Root:** [`docs/`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/docs)
* **Evidence Directory:** [`evidence/`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/evidence)
* **Release Reports & PDFs:** [`reports/pdf/`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/reports/pdf)
