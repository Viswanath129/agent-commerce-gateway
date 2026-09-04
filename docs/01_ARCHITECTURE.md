# ACG Architecture & System Design

## Merchant-Side Control Plane for AI-Originated Transactions

---

## 1. System Pipeline & Core Boundaries

The Agent Commerce Gateway operates as an explicit, 6-phase zero-trust pipeline. No financial action can proceed directly from an AI model to a payment rail without passing all authorization gates.

```text
ANY AI MODEL / AGENT (Proposer)
              │
              ▼
PROTOCOL / AGENT ADAPTER (Normalizer)
              │
              ▼
CANONICAL FINANCIAL INTENT (Intermediate Representation)
              │
              ▼
MANDATE VERIFICATION (Ed25519 & Revocation Registry)
              │
              ▼
MERCHANT TRUTH (Authoritative Catalog Price & Stock)
              │
              ▼
MERCHANT POLICY (Versioned Policy DSL Evaluation)
              │
              ▼
ATOMIC DUAL-RESOURCE RESERVATION (Budget Paise + Stock Units)
              │
              ▼
AUTHORIZATION DECISION (Permit / Block with Deterministic Code)
              │
              ▼
RAZORPAY EXECUTION (Order Creation with receipt = intent_id)
              │
              ▼
WEBHOOK RECONCILIATION (HMAC SHA-256 & Event Deduplication)
              │
              ▼
TAMPER-EVIDENT SHA-256 AUDIT LEDGER (Provenance & Verification)
```

---

## 2. Separation of Concerns

1. **AI Proposer (Zero Authority):** AI agents, LLMs, and subagents synthesize buyer intent and propose items, quantities, and client nonces. They possess **zero authority** to set prices, modify taxes, or self-authorize execution.
2. **ACG Control Plane (Deterministic Authorizer):** ACG inspects cryptographic delegation, validates against merchant database truth, applies active merchant policy, and acquires ACID locks across budget and stock.
3. **Razorpay Rails (Financial Executor):** Razorpay receives pre-authorized, idempotent orders, captures customer funds, executes refunds, and dispatches HMAC-signed webhook notifications.

---

## 3. Financial Action Types

ACG models explicit financial action types:

* **`AUTHORIZE_AND_RESERVE`**: Evaluates intent against policy and locks budget and inventory.
* **`CREATE_PAYMENT_ORDER`**: Invokes Razorpay `POST /v1/orders` with `receipt = intent_id`.
* **`CAPTURE_PAYMENT`**: Processes Razorpay `payment.captured` webhook and commits dual-resource locks.
* **`RELEASE_RESERVATION`**: Aborts and rolls back reserved budget and inventory upon timeout, cancellation, or rail failure.
* **`EXECUTE_REFUND`**: Issues idempotent refund via `X-Refund-Idempotency` when post-capture fulfillment fails.

---

## 4. State Transition Machine

```text
[INTENT_RECEIVED]
       │
       ▼
[INTENT_VALIDATED] ──► [INTENT_REJECTED] (If signature/truth/policy fails)
       │
       ▼
[DUAL_RESERVATION_HELD] ──► [RESERVATION_FAILED] (If stock/budget exhausted)
       │
       ▼
[ORDER_CREATED] ──► [DUAL_RESERVATION_RELEASED] (If Razorpay order API fails)
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
