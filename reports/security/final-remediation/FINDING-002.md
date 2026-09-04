# Security Remediation Report: FINDING-002

## Vulnerability Classification
- **ID:** FINDING-002
- **Severity:** CRITICAL
- **Title:** `POST /v1/mandates` Budget Restoration / Double-Spend Attack
- **CWE:** CWE-840: Business Logic Errors / CWE-670: Always-Incorrect Control Flow Implementation

---

## 1. Original Vulnerability
When a mandate was re-registered via `POST /v1/mandates`, the database `ON CONFLICT(mandate_id) DO UPDATE` query overwrote `remaining_budget = excluded.remaining_budget`. An autonomous agent that had spent ₹4,130 out of a ₹5,000 mandate could re-register the same mandate and reset `remaining_budget` back to ₹5,000, enabling an infinite double-spending loop.

---

## 2. Original Reproduction
```bash
# Spend ₹4,130 from ₹5,000 mandate -> Remaining ₹870
curl -X POST http://localhost:3000/v1/agent/checkout -d '{...}'

# Re-register mandate
curl -X POST http://localhost:3000/v1/mandates -d '{ "mandate_id": "mandate_01", "budget_limit": 500000, ... }'

# Query balance -> Was restored to ₹5,000.00
```

---

## 3. Remediation Applied
1. Updated `POST /v1/mandates` to check if `buyer_mandates` already contains `mandate_id`.
2. On conflict/re-registration, the engine updates metadata (e.g. signature/expiry) but strictly **preserves existing `remaining_budget`** without restoring spent balance.
3. Added check against `revoked_mandates` registry to reject re-registration of revoked mandates with **HTTP 403 MANDATE_REVOKED**.

---

## 4. New Behavior & Verification
- Initial Budget: ₹5,000.00 (500,000 paise)
- Spent Amount: ₹4,130.00 (413,000 paise)
- Balance Before Re-registration: ₹870.00 (87,000 paise)
- Re-registration Result: HTTP 200 `MANDATE_UPDATED` with `remaining_budget = 87000`.
- Subsequent attempt to spend ₹4,130: Intercepted with **HTTP 409 MANDATE_EXHAUSTED**.

---

## 5. Regression Test Evidence
- Test Files:
  - [`src/core/__tests__/v4_universal_plane.test.ts`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/__tests__/v4_universal_plane.test.ts)
  - [`src/core/__tests__/security_warfare.test.ts`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/__tests__/security_warfare.test.ts)
- Verification: Passed (Zero budget restoration observed).

---

## 6. Final Status
- **Status:** **REMEDIATED & INDEPENDENTLY VERIFIED**
- **Residual Risk:** None (Monotonic balance reduction enforced at DB ledger level).
