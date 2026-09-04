# Razorpay Integration & Financial Rail Evidence

## Technical Deep-Dive & Execution Contracts

This document records the exact mechanics, idempotency controls, webhook state machine, and verified evidence of ACG's integration with the Razorpay API rails.

---

## 1. Razorpay Core Integration Summary

| Razorpay Interface | Endpoint / Method | Idempotency Mechanism | State Transition | Failure Recovery | Evidence Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **Order Creation** | `POST /v1/orders` | `receipt = intent_id` | `DUAL_RESERVATION_HELD` $\rightarrow$ `ORDER_CREATED` | Atomic release of dual reservation on rail error (502) | **VERIFIED** |
| **Payment Webhook** | `POST /webhooks/razorpay` | `x-razorpay-event-id` table deduplication | Monotonic (`PAYMENT_CAPTURED` / `PAYMENT_FAILED`) | HMAC SHA-256 validation; rollback on payment failure | **VERIFIED** |
| **Idempotent Refund** | `POST /v1/payments/{id}/refund` | `X-Refund-Idempotency: rfnd_{intentId}_{timestamp}` | `FULFILLMENT_FAILED` $\rightarrow$ `REFUND_PENDING` $\rightarrow$ `REFUNDED` | Pre-capture lockout; strict capture requisite | **VERIFIED** |
| **Payment Status Fetch** | `GET /v1/payments/{id}` | Direct read-only | Outbox / reconciliation sync | Fallback retry loop with exponential backoff | **VERIFIED** |

---

## 2. Order Creation Flow & Idempotency Guarantee

### Request Specification
* **Target Endpoint:** `https://api.razorpay.com/v1/orders`
* **Authentication:** HTTP Basic Auth (`RAZORPAY_KEY_ID:RAZORPAY_KEY_SECRET`)
* **Payload Structure:**
```json
{
  "amount": 413000,
  "currency": "INR",
  "receipt": "7b8f9e61-a4b2-4d5e-88c9-0123456789ab",
  "notes": {
    "mandate_id": "man_1725200000_alpha",
    "reservation_id": "res_9a8b7c6d-1234-5678-9abc-def012345678",
    "policy_version": "pol_v1.0.0",
    "vulcan_optimal_rail": "upi_intent"
  }
}
```

### Idempotency Contract
1. ACG binds `receipt` directly to the client's `intent_id`.
2. If the same `intent_id` is replayed to ACG, it is blocked at the session gate (`HTTP 409 DUPLICATE_INTENT_REPLAY`) before reaching Razorpay.
3. If an in-flight network retry occurs, Razorpay matches on `receipt` and returns the existing order rather than minting a duplicate.

### Failure Handling & Atomic Rollback
```typescript
try {
  const razorpayOrder = await railClient.createOrder(truthResult.totalAmount, intentId, notes);
  // Persist order_session in SQLite
} catch (railError) {
  // ATOMIC ROLLBACK: Release held stock units & restore mandate paise balance
  reservationEngine.releaseReservation(reservationResult.reservationId, "Razorpay API Order creation failed");
  auditLedger.logTransition(intentId, "RAIL_EXECUTION_FAILED", "DUAL_RESERVATION_HELD", "DUAL_RESERVATION_RELEASED", { error: railError.message });
  return reply.status(502).send({ error: "PAYMENT_RAIL_ERROR", message: railError.message });
}
```

---

## 3. Webhook Security & Monotonic State Machine

### Signature Verification Contract
* Header: `x-razorpay-signature`
* Algorithm: HMAC SHA-256 (`crypto.createHmac("sha256", secret).update(rawBody).digest("hex")`)
* Verification: Constant-time comparison via `crypto.timingSafeEqual` to eliminate timing attacks.

### Deduplication Guarantee
* Header: `x-razorpay-event-id`
* Verification: Query `processed_webhook_events` table before executing state mutations.
* Outcome on Duplicate: Immediate `200 OK` with `{ status: "DUPLICATE_IGNORED" }`. Zero duplicate state transitions or double commitments.

### State Transition Diagram
```text
                  ┌──────────────────────┐
                  │    INTENT_RECEIVED   │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ DUAL_RESERVATION_HELD│
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │    ORDER_CREATED     │
                  └──────────┬───────────┘
                             │
             ┌───────────────┴───────────────┐
             │                               │
             ▼                               ▼
  ┌──────────────────────┐        ┌──────────────────────┐
  │   PAYMENT_CAPTURED   │        │    PAYMENT_FAILED    │
  └──────────┬───────────┘        └──────────┬───────────┘
             │                               │
             ▼                               ▼
  ┌──────────────────────┐        ┌──────────────────────┐
  │FULFILLMENT_DISPATCHED│        │DUAL_RESERVATION_REL  │
  └──────────┬───────────┘        └──────────────────────┘
             │
      (Fulfillment Fault)
             │
             ▼
  ┌──────────────────────┐
  │       REFUNDED       │
  └──────────────────────┘
```

---

## 4. Refund Security & Capture Requisite

### Security Boundary: Capture Requisite
ACG strictly prevents pre-capture refunds. If an agent or operator attempts to trigger a refund on an order whose status is `ORDER_CREATED` or where `razorpay_payment_id` is null:
1. The refund rail call is blocked immediately.
2. The database state remains unchanged.
3. An audit record is written flagging the illegal transition attempt.

### Idempotent Refund Invocation
* Header: `X-Refund-Idempotency: rfnd_{intentId}_{timestamp}`
* Payload: `{ amount: amountPaise, notes: { reason: "Merchant fulfillment failure stockout" } }`
* Verification: Status updates to `REFUNDED` and dual-resource reservation is permanently marked closed.
