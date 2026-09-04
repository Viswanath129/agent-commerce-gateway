# ACG Security Evidence & Threat Model Verification

## Zero-Trust Authorization & Hostile Environment Defenses

This document provides structured evidence and threat mitigation proofs for the Agent Commerce Gateway (ACG / MACCP).

---

## 1. Threat Model & Defense Matrix

| Threat ID | Adversarial Vector | Attack Mechanism | ACG Defense Layer | HTTP Outcome | Verified Status |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **THREAT-01** | **Subagent Budget Overstep** | LLM generates order exceeding human principal's mandate limit | Policy Engine Phase 4 evaluation | **`403 Forbidden`** | **VERIFIED** |
| **THREAT-02** | **Hallucinated / Injected Price** | LLM claims expensive item costs ₹1.00 | Commerce Truth Engine ignores LLM claims, resolves DB truth | **`201 Created`** (DB price) | **VERIFIED** |
| **THREAT-03** | **High-Concurrency Double Spend** | 10 subagents concurrently race against residual budget | SQLite `BEGIN IMMEDIATE` ACID transaction boundary | **`1 Allowed (201), 9 Blocked (409)`** | **VERIFIED** |
| **THREAT-04** | **Replayed Financial Intent** | Adversary resends identical `intent_id` payload | Pre-execution `order_sessions` session gate | **`409 Conflict`** | **VERIFIED** |
| **THREAT-05** | **Cryptographic Signature Forgery** | Attacker modifies budget or public key post-signing | `crypto.verify` on canonical Ed25519 byte buffer | **`401 Unauthorized`** | **VERIFIED** |
| **THREAT-06** | **Rogue Agent on Revoked Mandate** | Agent uses mathematically valid signature for revoked mandate | Revoked Mandate Registry check in Phase 2a | **`403 Forbidden`** | **VERIFIED** |
| **THREAT-07** | **Webhook Forgery / Replay** | Attacker sends fabricated Razorpay payment notification | Constant-time HMAC SHA-256 + Event ID deduplication | **`401 / 200 IGNORED`** | **VERIFIED** |
| **THREAT-08** | **SQL Injection in SKU / Params** | Attacker passes `' OR '1'='1` in SKU string | Prepared SQL statements (`db.prepare(..).get(..)`) | **`400 Bad Request`** | **VERIFIED** |
| **THREAT-09** | **Cross-Merchant Mandate Reuse** | Agent presents mandate approved for Merchant A to Merchant B | Whitelist verification in Policy Engine | **`403 Forbidden`** | **VERIFIED** |
| **THREAT-10** | **Audit Ledger Record Tampering** | Database administrator or attacker mutates audit record | Forward SHA-256 hash chaining detection | **Tamper Detected** | **VERIFIED** |

---

## 2. Cryptographic Specifications

### 2.1 Ed25519 Canonical Mandate Byte Representation
To guarantee that JSON serialization differences do not cause false signature failures or malleability attacks:
```typescript
export function getCanonicalMandateBytes(mandate: Omit<BuyerMandate, "signature">): Buffer {
  const canonicalObject = {
    mandate_id: mandate.mandate_id,
    principal_public_key: mandate.principal_public_key,
    budget_limit: mandate.budget_limit,
    currency: mandate.currency,
    merchant_whitelist: mandate.merchant_whitelist ? [...mandate.merchant_whitelist].sort() : undefined,
    category_whitelist: mandate.category_whitelist ? [...mandate.category_whitelist].sort() : undefined,
    expiry: mandate.expiry,
  };
  return Buffer.from(JSON.stringify(canonicalObject));
}
```

### 2.2 Tamper-Evident SHA-256 Audit Hash Chain
Each audit event block $B_i$ is computed deterministically over the previous block hash $H_{i-1}$ and canonical payload:
$$H_i = \text{SHA256}(\text{audit\_id} \parallel \text{intent\_id} \parallel \text{timestamp} \parallel \text{event\_type} \parallel \text{prev\_state} \parallel \text{new\_state} \parallel \text{details\_json} \parallel H_{i-1})$$

Any modification, insertion, deletion, or reordering of records causes an immediate broken chain exception during `verifyLedgerIntegrity()` or `npm run audit:verify`.

---

## 3. Concurrency Invariant Proofs

Under high-concurrency load testing (10 parallel subagents concurrently executing against a constrained budget of ₹2,876.00 with cart values of ₹2,124.00):
* Total Requests: 10
* Allowed Checkouts: 1 (HTTP 201)
* Blocked Overspends: 9 (HTTP 409)
* Ending Mandate Balance: ₹752.00 ($\ge 0$)
* Ending Inventory: Exact expected unit decrement ($\ge 0$)
* Duplicate Orders: 0
