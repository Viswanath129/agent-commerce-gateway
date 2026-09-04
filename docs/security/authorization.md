# Financial Authorization & Zero-Trust Boundary

## Why Agent $\neq$ Authority

---

## 1. The Core Invariant

In enterprise financial infrastructure, an autonomous software agent or neural network cannot possess signing or spending authority. It can only present a delegated mandate issued and cryptographically signed by a recognized human principal.

---

## 2. Authorization Decision Tree

```text
Incoming Canonical Intent
          │
          ▼
Is Mandate Revoked? ──► YES ──► HTTP 403 MANDATE_REVOKED
          │ NO
          ▼
Is Ed25519 Signature Valid? ──► NO ──► HTTP 401 INVALID_MANDATE_SIGNATURE
          │ YES
          ▼
Is SKU & Stock Valid in DB? ──► NO ──► HTTP 400 COMMERCE_TRUTH_REJECTION
          │ YES
          ▼
Does Order Comply with Policy? ──► NO ──► HTTP 403 POLICY_VIOLATION
          │ YES
          ▼
Acquire Dual Resource Locks ──► CONFLICT ──► HTTP 409 INSUFFICIENT_STOCK / BUDGET
          │ SUCCESS
          ▼
Execute Downstream Razorpay Order (HTTP 201 Created)
```

---

## 3. Negative Boundary Tests

Verified in [`src/core/__tests__/authority_boundary.test.ts`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/__tests__/authority_boundary.test.ts):
* Fake price injection rejected.
* Stockout rejected at truth lookup.
* Non-existent SKU rejected.
* Inactive product rejected.
* Cross-merchant reuse rejected.
* Zero direct execution on failed authorization.
