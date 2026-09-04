# ACG Protocol Compatibility & Adapter Matrix

## Merchant-Side Control Plane for AI-Originated Transactions

This document establishes the verified technical specifications, security models, normalization boundaries, and implementation status for all agentic protocols interfaced with the Agent Commerce Gateway (ACG / MACCP).

---

### Classification Legend

* **`LIVE`**: Fully implemented, tested in active pipeline, exercises real end-to-end authorization, resource reservation, and downstream order creation.
* **`ADAPTER READY`**: Structural protocol parser and validator implemented; normalizes to ACG Canonical Intermediate Representation (IR); verified in automated test suite.
* **`ARCHITECTURE READY / ADVISORY`**: Interface and behavioral contract modeled for upstream/downstream advisory signals; non-authoritative.
* **`DESIGN`**: Architectural specification and data contract designed; awaiting ecosystem standard ratification.
* **`RAIL`**: Downstream payment settlement rail interface.
* **`PLUGGABLE`**: Extension interface for third-party pluggable providers.

---

## 1. Summary Status Matrix

| Protocol / Standard | Classification | Spec Version | Input Structure | Canonical IR Transformation | Auth / Cryptographic Primitive | Test Status |
| :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| **Native ACG Protocol** | **`LIVE`** | `v1.0.0` | Canonical Intent JSON | Direct 1:1 Schema Mapping | Ed25519 Signed Mandates | **VERIFIED** (Automated & HTTP) |
| **REST Financial Action Ingress** | **`LIVE`** | `v1.0.0` | HTTP JSON Ingress | Standard Canonical Payload | Bearer Tokens / Ed25519 | **VERIFIED** (Automated & HTTP) |
| **Model Context Protocol (MCP)** | **`ADAPTER READY`** | `2024-11-05` | JSON-RPC `tools/call` (`acg_checkout`) | Argument extraction & metadata normalization | Ed25519 Mandate in arguments | **VERIFIED** (Automated Suite) |
| **Agent2Agent Protocol (A2A)** | **`ADAPTER READY`** | `2026.1-LF` | JSON-RPC 2.0 Task Message | Unwraps task message payload | DID/Agent Attestation + Ed25519 | **VERIFIED** (Automated Suite) |
| **Agentic Commerce Protocol (ACP)** | **`ADAPTER READY`** | `acp/1.0` | Cart & Order Envelope | Maps line items & buyer principal | Delegated Commerce Mandate | **VERIFIED** (Automated Suite) |
| **Agent Payments Protocol (AP2)** | **`ADAPTER READY`** | `v0.2.0` | AP2 Authorization Container | Maps AP2 cart & payer to ACG IR | Authorization Mandate Container | **VERIFIED** (Automated Suite) |
| **Universal Commerce Protocol (UCP)** | **`ADAPTER READY`** | `ucp-v1.2` | Assistant Journey Checkout | Extracts `order_lines` & journey context | Delegated Mandate Container | **VERIFIED** (Automated Suite) |
| **Visa Trusted Agent Protocol (TAP)** | **`DESIGN`** | `tap/1.0-draft` | TEE / Enclave Agent Attestation | Maps hardware-signed token & items | Hardware Enclave Attestation | **TESTED IN HARNESS** |
| **Razorpay Vulcan Intelligence** | **`ARCHITECTURE READY`** | `vulcan-v1.4` | Transaction Context & Routing Hints | Advisory risk scores & optimal rails | Non-authoritative Advisory | **VERIFIED** (Downstream Model) |
| **Razorpay Core Settlement Rail** | **`LIVE`** | `v1` | Order Creation / Webhook / Refund | Standard Razorpay REST API | Basic Auth / HMAC SHA-256 Webhook | **VERIFIED** (Sandbox & Live API) |

---

## 2. Adapter Specifications & Security Invariants

### 2.1 Native ACG Protocol (`LIVE`)
* **Ingress Route:** `POST /v1/agent/checkout`
* **Input Schema:** `CanonicalIntentSchema` (`intent_id`, `client_nonce`, `timestamp`, `mandate`, `proposed_items`, `agent_metadata`)
* **Security Model:** Ed25519 signature over deterministic canonical JSON of buyer mandate fields.
* **Invariant:** All prices, taxes, and catalog bounds are read exclusively from SQLite merchant truth. Agent price claims are ignored.

### 2.2 Model Context Protocol (`ADAPTER READY`)
* **Ingress Route:** `POST /v1/agent/ingress/mcp`
* **Supported Methods:** `tools/call` with tool name `acg_checkout` or `razorpay_agentic_checkout`.
* **Normalization Logic:** Extracts tool arguments, generates cryptographic hash of raw JSON-RPC payload, binds tool call session to canonical intent.
* **Limitations:** Client transport over HTTP POST; stdio transport requires local sidecar bridge.

### 2.3 Agent2Agent Protocol (`ADAPTER READY`)
* **Ingress Route:** `POST /v1/agent/ingress/a2a`
* **Supported Methods:** `a2a.commerce.proposeTransaction`, `a2a.commerce.negotiateTerms`.
* **Normalization Logic:** Unwraps sender/recipient DIDs (`did:key:z6Mku...`), extracts embedded task payload into ACG Canonical IR.
* **Security Model:** DID authentication at transport layer + Ed25519 financial mandate at authorization layer.

### 2.4 Agent Payments Protocol (`ADAPTER READY`)
* **Ingress Route:** `POST /v1/agent/ingress/ap2`
* **Supported Structure:** `payment_intent_id`, `payer`, `authorization_mandate`, `cart`.
* **Normalization Logic:** Maps AP2 cart items to ACG proposed items; passes authorization mandate to ACG verification engine.
* **Distinction:** AP2 provides the protocol container; ACG enforces merchant-side authorization.

### 2.5 Universal Commerce Protocol (`ADAPTER READY`)
* **Ingress Route:** `POST /v1/agent/ingress/ucp`
* **Supported Structure:** `journey_id`, `surface`, `checkout_request`.
* **Normalization Logic:** Resolves UCP `order_lines` (SKU, title, requested quantity) to merchant catalog database items.

### 2.6 Visa Trusted Agent Protocol (`DESIGN`)
* **Ingress Route:** `POST /v1/agent/ingress/tap`
* **Supported Structure:** Hardware attestation token, reputation tier, commerce payload.
* **Security Model:** Designed for hardware security enclaves (TEE). ACG verifies attestation presence and applies risk tiers.

### 2.7 Razorpay Vulcan Payment Intelligence (`ARCHITECTURE READY / ADVISORY`)
* **Role:** Downstream intelligence provider (optimal rail selection, network tokenization hints, fraud probability estimation).
* **Authority Boundary:** **Advisory Only**. Vulcan cannot override merchant policy or bypass mandate budget constraints.
* **Contract:** If Vulcan reports elevated risk (risk score > 0.85), ACG can downgrade routing or mandate additional verification steps, but Vulcan cannot authorize a transaction that fails merchant policy.

---

## 3. Protocol Invariant Guarantees

```text
┌─────────────────────────────────────────────────────────────┐
│                 ANY AI MODEL / SUBAGENT                     │
│           (Claude, GPT-4o, Gemini, Cursor, A2A)             │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 PROTOCOL ADAPTER REGISTRY                   │
│        (MCP / A2A / ACP / AP2 / UCP / TAP / Native)          │
└──────────────────────────────┬──────────────────────────────┘
                               │ Normalizes to Canonical IR
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               ACG CONTROL PLANE (AUTHORIZATION)             │
│   • Cryptographic Mandate Verification (Ed25519)            │
│   • Merchant Catalog Truth Link (DB Price & Stock)          │
│   • Dynamic Policy Engine (Category, Margin, Cap)           │
│   • ACID Dual-Resource Reservation (Paise + Units)          │
└──────────────────────────────┬──────────────────────────────┘
                               │ Downstream Execution
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               RAZORPAY CORE SETTLEMENT RAILS                │
│    • Order Creation (receipt = intent_id)                   │
│    • Webhook Deduplication (x-razorpay-event-id)            │
│    • Idempotent Refunds (X-Refund-Idempotency)              │
└─────────────────────────────────────────────────────────────┘
```

1. **Deterministic Resolution:** Regardless of input protocol, all requests normalize to the identical internal `CanonicalIntent` structure.
2. **Authority Primacy:** No protocol adapter can bypass the Policy Engine, Commerce Truth Engine, or Dual-Resource Reservation Engine.
3. **Audit Immutability:** Ingress protocol code, agent DID/identifier, and raw payload SHA-256 hash are permanently recorded in the chained audit ledger.
