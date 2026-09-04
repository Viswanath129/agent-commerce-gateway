# ACG Financial Authorization & Control Boundary

## Proving the Invariant: "Agent $\neq$ Authority"

---

## 1. The Financial Control Boundary

The fundamental tenet of ACG is that an AI model or autonomous agent is solely an **intent proposer**. Authority is derived exclusively from human buyer cryptographic delegation and merchant business policy.

```text
AGENT PROPOSAL
      │  (Proposed SKU, Qty, Nonce)
      ▼
CANONICALIZATION
      │  (Normalizes Protocol & Generates Canonical Byte Buffer)
      ▼
AUTHORITY VERIFICATION
      │  (Ed25519 Signature Verification & Revocation Registry Check)
      ▼
MERCHANT TRUTH
      │  (Authoritative Catalog Price & Active Stock Lookup)
      ▼
POLICY EVALUATION
      │  (Versioned Merchant Policy DSL Limits & Category Bounds)
      ▼
DUAL-RESOURCE RESERVATION
      │  (Atomic Deduction of Budget Paise & Inventory Stock Units)
      ▼
AUTHORIZATION GRANTED
      │  (Downstream Payment Order Created on Razorpay)
      ▼
EXECUTION
```

---

## 2. Forensic Negative Proofs: `AUTHORITY_BOUNDARY_TEST`

The `AUTHORITY_BOUNDARY_TEST` suite executes seven deterministic negative proofs confirming that agent claims can never bypass merchant truth:

1. **Fake Price Injection:** When an agent proposes buying `SKU-KEYBOARD-RGB` for ₹1.00, ACG ignores the claim and computes the exact database total of **₹4,130.00** (₹3,500 base + 18% GST).
2. **Fake Stock Claims:** When an agent requests 50 units of an item with only 5 units in stock, ACG rejects the request with `HTTP 400 COMMERCE_TRUTH_REJECTION`.
3. **Hallucinated SKU:** When an agent invents a non-existent product identifier, ACG aborts before reservation (`HTTP 400`).
4. **Inactive / Discontinued Product:** Inactive catalog records (`is_active = 0`) cannot be purchased.
5. **Real-Time Catalog Price Adjustments:** Direct price changes in the merchant database take immediate effect on subsequent checkouts.
6. **Cross-Merchant Target Isolation:** Mandates pinned to specific merchant whitelists are rejected if presented to other stores (`HTTP 403`).
7. **Zero Direct Execution:** When authorization fails at any step, the downstream Razorpay API is **never invoked**, resulting in zero side effects.
