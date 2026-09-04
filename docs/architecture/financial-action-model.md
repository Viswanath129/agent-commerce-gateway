# Financial Action Model

## State Invariants & Transaction Lifecycle

ACG defines explicit financial action types and transitions that govern how money and inventory move through the system.

---

## 1. Action Types

* **`AUTHORIZE_AND_RESERVE`**: Evaluates intent against policy and locks budget and inventory.
* **`CREATE_PAYMENT_ORDER`**: Invokes Razorpay `POST /v1/orders` with `receipt = intent_id`.
* **`CAPTURE_PAYMENT`**: Processes Razorpay `payment.captured` webhook and commits dual-resource locks.
* **`RELEASE_RESERVATION`**: Aborts and rolls back reserved budget and inventory upon timeout, cancellation, or rail failure.
* **`EXECUTE_REFUND`**: Issues idempotent refund via `X-Refund-Idempotency` when post-capture fulfillment fails.

---

## 2. Monotonic State Machine

```text
[INTENT_RECEIVED]
       │
       ▼
[INTENT_VALIDATED] ──► [INTENT_REJECTED]
       │
       ▼
[DUAL_RESERVATION_HELD] ──► [RESERVATION_FAILED]
       │
       ▼
[ORDER_CREATED] ──► [DUAL_RESERVATION_RELEASED]
       │
       ├─────────────────────────┐
       ▼                         ▼
[PAYMENT_CAPTURED]        [PAYMENT_FAILED]
       │                         │
       ▼                         ▼
[FULFILLMENT_DISPATCHED]   [DUAL_RESERVATION_RELEASED]
       │
       ▼ (If warehouse failure)
[REFUND_PENDING]
       │
       ▼
   [REFUNDED]
```
