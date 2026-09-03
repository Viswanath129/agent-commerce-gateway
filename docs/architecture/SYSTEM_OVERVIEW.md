# ACG — System Architecture & Defense Specification

**Target:** Razorpay AI Buildathon — Track 01  
**Architecture:** Merchant-Side Control Plane for AI-Originated Transactions on Razorpay  

---

## 1. The Core Invariants

> **“The model can propose anything. It cannot authorize anything.”**  
> **“The agent decided what it wanted. The control plane decided whether it was allowed.”**

ACG normalizes untrusted incoming AI intents (MCP, ACP, REST) into a canonical IR and enforces 7 deterministic layers of merchant defense before invoking Razorpay payment rails.

---

## 2. 7 Layers of Deterministic Defense

```text
1. INTENT NORMALIZATION:   Zod runtime parsing, nonces, strict schema validation.
2. MANDATE AUTHENTICATION: Noble Ed25519 asymmetric signature checks & instant SQLite revocations.
3. COMMERCE TRUTH:         Re-evaluates prices, taxes, and stock from SQLite; ignores LLM claims.
4. POLICY ENGINE:          Versioned merchant rules DSL (max ticket, allowed categories).
5. DUAL-RESOURCE LOCK:     Atomic BEGIN IMMEDIATE lock on mandate budget & SKU inventory.
6. RAZORPAY RAILS:         Idempotent Order creation (receipt = intent_id) & policy auto-refund.
7. TAMPER-EVIDENT AUDIT:   Backwards-chained SHA-256 ledger recording every state transition.
```

---

## 3. High-Concurrency & Reversal Protections

* **Concurrency Race Isolation:** SQLite single-writer serialization (`BEGIN IMMEDIATE`) ensures that when parallel subagents race for remaining mandate budget or inventory stock, exactly one request is admitted (`HTTP 201 Created`) and subsequent requests are safely rejected (`HTTP 409 MANDATE_EXHAUSTED`).
* **Post-Capture Reversal:** When merchant warehouse stockouts occur after payment capture, the system checks `policy.auto_refund_on_fulfillment_failure` and executes an idempotent refund on Razorpay (`X-Refund-Idempotency: rfnd_${intentId}_${timestamp}`).
