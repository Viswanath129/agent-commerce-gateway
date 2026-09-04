# ACG Control Plane Architecture

## Authoritative Merchant Authorization Boundary

The ACG Control Plane acts as the stateful, policy-enforcing intermediary between untrusted agent proposals and downstream financial rails.

---

## 1. Pipeline Execution Phases

1. **Phase 1: Canonical Ingress & Nonce Validation:** Parses and validates incoming payloads against `CanonicalIntentSchema` using Zod. Replayed `intent_id` values are rejected with `HTTP 409 DUPLICATE_INTENT_REPLAY`.
2. **Phase 2a: Revocation Registry Check:** Queries the `revoked_mandates` table. If the human principal has revoked the mandate, checkout is rejected with `HTTP 403 MANDATE_REVOKED`.
3. **Phase 2b: Cryptographic Signature Verification:** Verifies the Ed25519 signature across canonical mandate byte representations. Tampered amounts or public keys fail with `HTTP 401 INVALID_MANDATE_SIGNATURE`.
4. **Phase 3: Merchant Truth Resolution:** Resolves line items against `catalog_items`. Computes exact GST (1800 bps) and total paise. Stockouts fail with `HTTP 400 COMMERCE_TRUTH_REJECTION`.
5. **Phase 4: Policy Engine Evaluation:** Evaluates active versioned policy (`pol_v1.0.0`). Checks maximum transaction amount and allowed merchant categories. Violations fail with `HTTP 403`.
6. **Phase 5: Atomic Dual-Resource Reservation:** Deducts mandate budget and decrements inventory stock in a serialized SQLite transaction. Conflicts fail with `HTTP 409`.
7. **Phase 6: Downstream Rail Order Creation:** Creates the Razorpay order with `receipt = intent_id`. If downstream creation fails, reservations are rolled back immediately.
