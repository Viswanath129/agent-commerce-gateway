# ACG Architecture Overview

## Merchant Control Plane for Agent-Originated Transactions

The **Agent Commerce Gateway (ACG / MACCP)** provides an authoritative, merchant-side control boundary for financial actions proposed by autonomous AI agents.

---

## 1. The High-Level Flow

```text
ANY AI AGENT (Claude, GPT, Gemini, A2A)
               │
               ▼
   PROTOCOL ADAPTER LAYER (MCP / A2A / ACP / AP2 / UCP / REST)
               │  Normalizes payload to Canonical IR
               ▼
   ACG CONTROL PLANE BOUNDARY
   ├── 1. Cryptographic Mandate Verification (Ed25519)
   ├── 2. Merchant Database Truth Link (DB Price & Stock)
   ├── 3. Dynamic Policy Engine (Versioned Limits & Category Caps)
   └── 4. Atomic Dual-Resource Reservation (Paise + Stock Lock)
               │
               ▼
   RAZORPAY EXECUTION RAILS
   ├── • Order Creation (receipt = intent_id)
   ├── • Webhook Processing (HMAC SHA-256 & Event Deduplication)
   └── • Safe Idempotent Refunds (X-Refund-Idempotency)
               │
               ▼
   TAMPER-EVIDENT SHA-256 AUDIT LEDGER
```

---

## 2. Core Architectural Principles

1. **AI Proposes, ACG Authorizes, Razorpay Executes:** The upstream AI model is strictly an intent proposer. It cannot dictate prices, manipulate taxes, or bypass merchant business policies.
2. **Merchant Truth Isolation:** The gateway queries the authoritative merchant catalog database for prices and tax calculations, completely ignoring any price arithmetic claimed by the LLM.
3. **Atomic Dual-Resource Locking:** Budget paise and physical inventory units are locked in a single atomic transaction before any external payment rail is invoked.
4. **Deterministic Fail-Closed Semantics:** Any verification failure, expired mandate, or downstream rail error immediately aborts the transaction with zero financial or inventory leakage.
