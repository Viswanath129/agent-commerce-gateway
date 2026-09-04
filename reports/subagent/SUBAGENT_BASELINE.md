# ACG INDEPENDENT RED TEAM: BASELINE ARCHITECTURAL RECONSTRUCTION
**Report Target:** `reports/subagent/SUBAGENT_BASELINE.md`  
**Worker ID:** `worker_baseline_1`  
**Phase:** Phase 1 (Independent Baseline)  
**Date:** 2026-09-04  
**Integrity Mode:** READ-MOSTLY RED TEAM (Forensic Source Verification)  
**Repository Path:** `B:\projects\RAZOR PAY- Buildathon`  
**Commit Hash:** `23ba7772a3bf69303930af93486970131326fd4c`  
**Node.js Runtime:** `v24.11.1` | **Package Manager:** `npm 11.14.1`  
**Authoritative Request:** `ORIGINAL_REQUEST.md` (Phase 1 & Phase 25)

---

## 1. Executive Summary & Verification Methodology

This baseline architecture reconstruction was conducted **independently** from first-principles source inspection across the entire repository (`src/`, `config/`, `frontend/`, `sdk/`, `data/`, `scripts/`). In strict adherence to the Red Team Integrity Mandate:
- **Zero reliance** was placed on `README.md`, marketing badges, documentation claims, previous pass statements, or test assertions.
- Every architectural boundary, database transaction, financial mutation, and protocol adapter was traced to its exact source file and line numbers.
- Code-level claims were compared directly against actual runtime implementations.

### Key Baseline Findings
1. **Dual-Plane Architecture Actually Present:** The repository contains a production-grade 6-phase atomic execution pipeline in `src/gateway/router.ts` (Phase 1-6) working in conjunction with an advanced Policy Decision Point (PDP) and Governance Plane in `src/core/pdp.ts`, `src/core/agent_principal.ts`, `src/core/kill_switch.ts`, `src/core/velocity.ts`, and `src/core/budget_hierarchy.ts`.
2. **Untrusted Model Invariant Strictly Enforced:** In `src/gateway/router.ts:759` and `src/core/truth.ts:86-153`, the LLM agent's price claims, tax arithmetic, and catalog assumptions are **completely discarded**. Authoritative prices and stock are resolved exclusively against the merchant's SQLite catalog table (`catalog_items`).
3. **Dual-Resource Locking is Truly ACID (Single-Node):** In `src/core/reservation.ts:72-167`, mandate budget deductions and inventory decrements execute inside a single serialized `BEGIN IMMEDIATE TRANSACTION;` block with immediate rollback on any precondition failure.
4. **Adapter Reality:** Out of the 6 multi-agent protocols plus native ACG, **1 is LIVE** (`ACG`), **5 are ADAPTER READY** (`MCP`, `A2A`, `ACP`, `AP2`, `UCP`), and **1 is DESIGN / SIMULATED** (`TAP`). All adapters normalize to a strict internal canonical intermediate representation (`CanonicalIntent`) and feed through the identical 6-phase authorization pipeline without bypassing controls.
5. **Razorpay Integration Reality:** Order creation uses the documented `receipt` idempotency parameter (`src/rails/razorpay.ts:50`). However, offline execution defaults to deterministic mock generators because credentials in `.env` are placeholders (`rzp_test_placeholder_key`). Live API execution is implemented and guarded by `isLiveCredentials`.
6. **Critical Security Findings Observed in Source:**
   - **Test Backdoor in Webhook Handler:** `src/gateway/router.ts:1174` explicitly bypasses HMAC verification if `x-razorpay-signature === "mock_signature"`.
   - **Webhook Payload Re-serialization Risk:** Webhook signature verification in `src/gateway/router.ts:1169` serializes `request.body` via `JSON.stringify(request.body)` rather than inspecting raw incoming request buffer bytes.
   - **Static Bearer Tokens:** `src/gateway/auth.ts:5-9` hardcodes static administrative bearer tokens for control-plane access.
   - **Dashboard Metric Hardcoding:** While GMV, intent counts, and audit block counts are queried live from SQLite, latency is hardcoded to `286.3 ms` (`src/gateway/router.ts:177`), health latency to `12 ms` (`line 266`), and `is_sandbox_connected` to `true` (`line 178`).

---

## 2. Architecture Actually Observed

### 2.1 Component Topology

```
+----------------------------------------------------------------------------------------------------+
|                                    ZONE 0: UNTRUSTED INGRESS                                       |
|  [Native LLM]    [MCP Client]    [A2A Agent]    [ACP Container]   [AP2 Client]   [Google UCP]     |
+----------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+----------------------------------------------------------------------------------------------------+
|                             ZONE 1: FASTIFY ROUTER & PROTOCOL ADAPTERS                             |
|  Fastify 5.2.1 (src/server.ts:24, src/gateway/router.ts:692-1163)                                  |
|  - Rate Limiter: @fastify/rate-limit (50 req/min ingress, 10/min policy, 200/min webhooks)         |
|  - Protocol Normalization Registry (src/adapters/index.ts:19-55):                                  |
|    * ACGNativeAdapter (src/adapters/acg/adapter.ts) -> LIVE                                        |
|    * McpProtocolAdapter (src/adapters/mcp/adapter.ts) -> ADAPTER READY                             |
|    * A2AProtocolAdapter (src/adapters/a2a/adapter.ts) -> ADAPTER READY                             |
|    * AcpProtocolAdapter (src/adapters/acp/adapter.ts) -> ADAPTER READY                             |
|    * Ap2ProtocolAdapter (src/adapters/ap2/adapter.ts) -> ADAPTER READY                             |
|    * UcpProtocolAdapter (src/adapters/ucp/adapter.ts) -> ADAPTER READY                             |
|    * VisaTapProtocolAdapter (src/adapters/tap/adapter.ts) -> DESIGN                                |
+----------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+----------------------------------------------------------------------------------------------------+
|                           ZONE 2: 6-PHASE MERCHANT CONTROL PLANE PIPELINE                          |
|  1. Ingress Replay Check: SELECT intent_id FROM order_sessions (router.ts:706)                     |
|  2. Operational Kill Switch: checkKillSwitch(GLOBAL, MERCHANT, AGENT) (core/kill_switch.ts:40)    |
|  3. Mandate Revocation: SELECT * FROM revoked_mandates (router.ts:729)                             |
|  4. Ed25519 Cryptographic Verification: verifyMandateSignature(mandate) (core/crypto.ts:23)       |
|  5. Commerce Truth Lookup: resolveTruth(proposed_items) against catalog_items (core/truth.ts:86)  |
|  6. Merchant Policy Evaluation: amount cap, category whitelist, expiry (core/policy.ts:30)        |
+----------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+----------------------------------------------------------------------------------------------------+
|                         ZONE 3: ATOMIC DUAL-RESOURCE RESERVATION ENGINE                            |
|  src/core/reservation.ts:72-167                                                                    |
|  - BEGIN IMMEDIATE TRANSACTION; (Single-Node Serialized SQLite Lock)                               |
|  - Check buyer_mandates.remaining_budget >= totalRequiredPaise                                     |
|  - Check catalog_items.available_stock >= requestedQty                                             |
|  - UPDATE buyer_mandates SET remaining_budget = remaining_budget - ?                               |
|  - UPDATE catalog_items SET available_stock = available_stock - ?                                  |
|  - INSERT INTO reservations (status = 'HELD', ttl = 300s)                                          |
|  - INSERT INTO reservation_items                                                                   |
|  - COMMIT; (or immediate ROLLBACK on any deficiency)                                               |
+----------------------------------------------------------------------------------------------------+
                                                  |
                        +-------------------------+-------------------------+
                        |                                                   |
                        v                                                   v
+-------------------------------------------------+ +------------------------------------------------+
|          ZONE 4: PAYMENT RAIL EXECUTION         | |           ZONE 5: AUDIT & STATE MACHINE        |
|  src/rails/razorpay.ts:48-91                    | |  src/store/audit.ts:15-55                      |
|  - RazorpayRailClient.createOrder()             | |  - SHA-256 Forward-Chained Ledger              |
|  - Idempotency: receipt = intent_id             | |  - Chaining: sha256(auditId|intentId|ts|event| |
|  - Order Session Created: order_sessions        | |              prevState|newState|details|prevHash)|
|  - Fail-Closed Rollback: releaseReservation()   | |  - Verification: verifyLedgerIntegrity()       |
|  - Webhook Processor: src/rails/webhook.ts:59   | |  - Formal State Machine: core/state_machine.ts |
+-------------------------------------------------+ +------------------------------------------------+
```

### 2.2 Reconstructed End-to-End Data Flow

Tracing an incoming checkout request from network arrival to final response:

```
[Agent HTTP POST /v1/agent/checkout OR /v1/agent/ingress/:protocol]
  │
  ├── 1. SCHEMA VALIDATION (router.ts:694 / router.ts:933)
  │      Payload validated against Zod CanonicalIntentSchema or protocol-specific adapter schema.
  │      Failure -> HTTP 400 INVALID_INTENT_SCHEMA / INVALID_<PROTOCOL>_PAYLOAD.
  │
  ├── 2. REPLAY DETECTION (router.ts:706 / router.ts:946)
  │      Query order_sessions WHERE intent_id = ?.
  │      If exists -> HTTP 409 DUPLICATE_INTENT_REPLAY.
  │      Audit Log -> INTENT_RECEIVED (audit.ts:15).
  │
  ├── 3. OPERATIONAL KILL SWITCH CHECK (router.ts:720 / router.ts:964)
  │      killSwitchEngine.checkKillSwitch(merchant_id, agent_id) (core/kill_switch.ts:40)
  │      Checks scopes: GLOBAL, MERCHANT:<id>, AGENT:<id>.
  │      If paused -> Audit Log KILL_SWITCH_BLOCKED -> HTTP 403 KILL_SWITCH_ENGAGED.
  │
  ├── 4. MANDATE REVOCATION REGISTRY CHECK (router.ts:728 / router.ts:971)
  │      Query revoked_mandates WHERE mandate_id = ?.
  │      If revoked -> Audit Log MANDATE_REVOKED -> HTTP 403 MANDATE_REVOKED.
  │
  ├── 5. CRYPTOGRAPHIC ED25519 VERIFICATION (router.ts:743 / router.ts:985)
  │      verifyMandateSignature(intent.mandate) (core/crypto.ts:23).
  │      Extracts canonical mandate fields: mandate_id, principal_public_key, budget_limit,
  │      currency, merchant_whitelist, category_whitelist, expiry.
  │      Verifies Ed25519 signature over canonical UTF-8 JSON buffer.
  │      If invalid -> Audit Log SIGNATURE_VERIFICATION_FAILED -> HTTP 401 INVALID_MANDATE_SIGNATURE.
  │      Audit Log -> MANDATE_VERIFIED.
  │
  ├── 6. COMMERCE TRUTH LOOKUP (router.ts:759 / router.ts:1003)
  │      truthEngine.resolveTruth(intent.proposed_items) (core/truth.ts:86).
  │      Query catalog_items WHERE sku = ? AND is_active = 1.
  │      Completely discards agent-submitted prices and tax figures.
  │      Authoritatively computes: subtotal = unit_price * qty; tax = (subtotal * tax_bps) / 10000.
  │      Checks available_stock >= qty.
  │      If inactive, missing, or out-of-stock -> Audit Log COMMERCE_TRUTH_FAILED -> HTTP 400 COMMERCE_TRUTH_REJECTION.
  │      Audit Log -> COMMERCE_TRUTH_RESOLVED.
  │
  ├── 7. MERCHANT POLICY EVALUATION (router.ts:783 / router.ts:1026)
  │      policyEngine.evaluate(mandate, totalAmount, categories, merchant_id) (core/policy.ts:30).
  │      Validates: mandate expiry, merchant whitelist, category whitelist, mandate budget limit,
  │      merchant max_transaction_amount, merchant allowed_categories.
  │      If violated -> Audit Log POLICY_VIOLATION (with policy_version) -> HTTP 403 <VIOLATION_CODE>.
  │      Audit Log -> POLICY_EVALUATED_ALLOWED.
  │
  ├── 8. ATOMIC DUAL-RESOURCE RESERVATION (router.ts:812 / router.ts:1050)
  │      reservationEngine.holdReservation(...) (core/reservation.ts:59).
  │      Executes inside BEGIN IMMEDIATE TRANSACTION;:
  │      - Re-checks buyer_mandates.remaining_budget >= totalAmount.
  │      - Re-checks catalog_items.available_stock >= requestedQty for all items.
  │      - Atomic decrement: buyer_mandates.remaining_budget -= totalAmount.
  │      - Atomic decrement: catalog_items.available_stock -= qty.
  │      - Inserts into reservations (status = 'HELD') and reservation_items.
  │      - COMMIT;
  │      If fails -> ROLLBACK -> Audit Log RESERVATION_FAILED -> HTTP 409 <ERROR_CODE>.
  │      Audit Log -> DUAL_RESERVATION_ACQUIRED.
  │
  ├── 9. PAYMENT INTELLIGENCE EVALUATION (router.ts:836 / router.ts:1074)
  │      defaultVulcanIntelligence.evaluate(...) (rails/intelligence.ts:16).
  │      Computes heuristic risk score, anomaly score, and routing hints (upi_reserve_pay, cards_v3, razorpay_direct).
  │      Explicitly labeled ARCHITECTURE READY / ADVISORY (disclaims authority; ACG retains binding decision).
  │      Audit Log -> VULCAN_INTELLIGENCE_EVALUATED.
  │
  ├── 10. RAZORPAY RAIL EXECUTION (router.ts:856 / router.ts:1093)
  │       railClient.createOrder(totalAmount, receipt = intentId, notes) (rails/razorpay.ts:48).
  │       If isLiveCredentials: POST https://api.razorpay.com/v1/orders with Basic Auth.
  │       If mock: Generates deterministic mock order (id = `order_${hex}`).
  │       On Rail Error -> Rollback reservationEngine.releaseReservation() -> Audit Log RAIL_EXECUTION_FAILED -> HTTP 502 PAYMENT_RAIL_ERROR.
  │       On Rail Success -> Insert order_sessions -> Audit Log RAZORPAY_ORDER_CREATED -> HTTP 201 Created.
```

---

## 3. Financial Paths & Money Flow

### 3.1 Currency Denomination & Precision
Across the entire codebase, money is represented **strictly as integer paise** (1 INR = 100 paise).
- `catalog_items.unit_price`: INTEGER (e.g. `350000` = ₹3,500.00)
- `catalog_items.tax_rate_bps`: INTEGER (e.g. `1800` = 18.00% GST)
- `buyer_mandates.budget_limit`: INTEGER (e.g. `500000` = ₹5,000.00)
- `buyer_mandates.remaining_budget`: INTEGER
- `reservations.reserved_budget`: INTEGER
- `order_sessions.amount`: INTEGER
- `tax_amount` calculation: `Math.round((subtotal * item.tax_rate_bps) / 10000)` (`src/core/truth.ts:130`)

Floating-point currency manipulation does not exist in any authorization or settlement path. Divisions by 100 occur solely when serializing responses for human UI presentation (`router.ts:908-909`).

### 3.2 The 4 Financial Mutation Primitives

| Mutation Primitive | Database Mutation | Location | Trigger Condition | Rollback / Reversal |
|--------------------|-------------------|----------|-------------------|---------------------|
| **1. Budget Reservation** | `UPDATE buyer_mandates SET remaining_budget = remaining_budget - ?` | `src/core/reservation.ts:111` | Phase 5 checkout (inside `BEGIN IMMEDIATE TRANSACTION;`) | Restored by `releaseReservation()` (`src/core/reservation.ts:189`) |
| **2. Inventory Unit Reservation** | `UPDATE catalog_items SET available_stock = available_stock - ?` | `src/core/reservation.ts:117` | Phase 5 checkout (inside `BEGIN IMMEDIATE TRANSACTION;`) | Restored by `releaseReservation()` (`src/core/reservation.ts:200`) |
| **3. Downstream Order Creation** | `INSERT INTO order_sessions (...) VALUES (?, ?, ?, ?, ?, 'ORDER_CREATED', ...)` | `src/gateway/router.ts:870` | Phase 6 checkout after Razorpay API returns order ID | If rail creation fails, order session is not inserted and reservation is released (`router.ts:914`) |
| **4. Payment Capture / Settlement** | `UPDATE order_sessions SET status = 'PAYMENT_CAPTURED'` & `commitReservation()` (`reservations.status = 'COMMITTED'`) | `src/rails/webhook.ts:118, 121` | Razorpay webhook `payment.captured` | If post-capture fulfillment fails, triggers `createRefund()` (`webhook.ts:182`) |

### 3.3 Lifecycle State Progression of Paise

```
[Principal Authority]
       │
       ▼
[UNRESERVED PAISES IN MANDATE]
       │
       │ (Phase 5: holdReservation in BEGIN IMMEDIATE TRANSACTION)
       ▼
[HELD IN ESCROW / RESERVATIONS (status = 'HELD')]
       │
       ├── (Rail Creation Fails) ──────────────────────────► [RESTORED TO MANDATE (releaseReservation)]
       │
       ├── (Razorpay Order Created: status = 'ORDER_CREATED')
       │      │
       │      ├── (Webhook: payment.failed) ───────────────► [RESTORED TO MANDATE & STOCK RESTORED]
       │      │
       │      └── (Webhook: payment.captured)
       │             │
       │             ▼
       │     [COMMITTED PERMANENTLY (reservations.status = 'COMMITTED')]
       │             │
       │             ├── (Fulfillment Success) ────────────► [FINAL SETTLEMENT / GMV RECOGNIZED]
       │             │
       │             └── (Fulfillment Failure)
       │                    │
       │                    ▼
       │            [REFUND_PENDING]
       │                    │
       │                    ▼ (createRefund with X-Refund-Idempotency)
       │            [REFUNDED / RETURNED TO BUYER]
```

### 3.4 Zero Direct Financial Execution Guarantee
The codebase strictly satisfies the invariant: **"No financial mutation without successful authorization."**
- The Razorpay API client (`src/rails/razorpay.ts:48`) cannot be reached directly by an AI agent.
- `POST /v1/authorize` and `POST /v1/financial-actions` (`src/gateway/router.ts:1499-1518`) do not offer bypass shortcuts; they inject directly into `/v1/agent/checkout`.
- No route or method exists to invoke `createOrder()` or mutate balances without first obtaining a verified `reservationId` from `reservationEngine.holdReservation()`.

---

## 4. Trust Boundaries & Authorization Enforcement

### 4.1 Principal Disambiguation

| Principal Entity | Identification Attribute | Verification Mechanism | Code Location |
|------------------|--------------------------|------------------------|---------------|
| **Human User / Principal** | `principal_public_key` | Ed25519 cryptographic signature over canonical mandate payload | `src/core/crypto.ts:23-44` |
| **Buyer Mandate** | `mandate_id` | Signed token containing budget limit, currency, whitelist, and expiry | `src/core/types.ts:4-13` |
| **Autonomous Agent** | `agent_id` | Checked against `agent_principals` registry and `agent_capabilities` | `src/core/agent_principal.ts:135` |
| **Merchant Store** | `merchant_id` | Pinned in `MerchantPolicy`; enforced against mandate whitelist | `src/core/policy.ts:54-63` |
| **AI Foundation Model** | `model_name` / `provider` | Advisory telemetry; **strictly untrusted** | `src/core/truth.ts:86` |

### 4.2 The Untrusted Model Invariant
The model can propose anything; it cannot authorize anything:
- **Price Claims Discarded:** If the agent submits `proposed_items: [{ sku: "SKU-KEYBOARD-RGB", price: 100 }]`, the price attribute is not even in `ProposedItemSchema` (`src/core/types.ts:17-21`). Only `sku` and `quantity` are parsed.
- **Authoritative DB Fetch:** `truthEngine.resolveTruth()` looks up `catalog_items.unit_price` (350,000 paise) and computes the true total (`src/core/truth.ts:129-131`).
- **GST / Tax Isolation:** The model cannot claim tax exemption; tax is computed from merchant `tax_rate_bps`.
- **Stock Invariant:** The model cannot invent stock; `catalog_items.available_stock` is checked atomically.

### 4.3 Authorization Boundaries Summary

```
BOUNDARY 1: Ingress Authentication & Rate Limiting
            Enforced by: Fastify, @fastify/rate-limit
            Scope: 50 req/min for checkout; 10 req/min for policy update; 200 req/min for webhooks.

BOUNDARY 2: Identity & Mandate Cryptography (Ed25519)
            Enforced by: src/core/crypto.ts:verifyMandateSignature
            Scope: Canonical JSON serialization of mandate; Ed25519 signature verification.

BOUNDARY 3: Mandate Revocation Registry
            Enforced by: src/gateway/router.ts:728 (Control Plane DB)
            Scope: Immediate block if mandate_id appears in revoked_mandates table.

BOUNDARY 4: Commerce Truth & Catalog Integrity
            Enforced by: src/core/truth.ts:resolveTruth
            Scope: Authoritative SKU existence, unit pricing, GST calculation, stock check.

BOUNDARY 5: Merchant Policy & Governance Bounds
            Enforced by: src/core/policy.ts & src/core/pdp.ts
            Scope: Max transaction cap, category whitelist, merchant whitelist, temporal expiry.

BOUNDARY 6: ACID Dual-Resource Reservation (Budget + Stock)
            Enforced by: src/core/reservation.ts (BEGIN IMMEDIATE TRANSACTION;)
            Scope: Serialized dual decrement of paise and inventory units.

BOUNDARY 7: Downstream Execution & Idempotency
            Enforced by: src/rails/razorpay.ts (receipt = intent_id)
            Scope: Prevention of duplicate Razorpay order creation on network retries.

BOUNDARY 8: Webhook Authenticity & Deduplication
            Enforced by: src/rails/webhook.ts (timingSafeEqual HMAC & event_id logging)
            Scope: Constant-time signature check; deduplication via processed_webhook_events.
```

---

## 5. Database Transactions & Concurrency Mechanisms

### 5.1 Storage Architecture
The persistence layer is implemented via Node.js built-in `node:sqlite` (`DatabaseSync`) in `src/store/db.ts:15`.
- Database file path: `./data/acg_gateway.db` (or `:memory:` during automated tests).
- Foreign keys enabled: `db.exec("PRAGMA foreign_keys = ON;");` (`src/store/db.ts:18`).
- Schema initialization: 17 relational tables created in `src/store/db.ts:23-247`.

### 5.2 Transaction Semantics in Dual-Resource Locking
In `src/core/reservation.ts:72`, `holdReservation()` initiates:
```sql
BEGIN IMMEDIATE TRANSACTION;
```
1. **SQLite Locking Behavior:** `BEGIN IMMEDIATE` acquires a `RESERVED` lock on the database immediately. No other connection can execute a `BEGIN IMMEDIATE` or write to the database until the transaction commits or rolls back.
2. **Synchronous Execution:** `node:sqlite` executes synchronously, ensuring that between `BEGIN IMMEDIATE` and `COMMIT;`, no concurrent JavaScript turn in the event loop can interleave conflicting SQLite writes on the same handle.
3. **Atomic Dual-Decrement:**
   ```sql
   UPDATE buyer_mandates SET remaining_budget = remaining_budget - ? WHERE mandate_id = ?;
   UPDATE catalog_items SET available_stock = available_stock - ? WHERE sku = ?;
   INSERT INTO reservations (...) VALUES (...);
   INSERT INTO reservation_items (...) VALUES (...);
   COMMIT;
   ```
4. **Rollback Behavior:** If `remainingBudget < totalRequiredAmount` or `availableStock < resItem.quantity` or any SQL execution throws, `this.db.exec("ROLLBACK;");` executes immediately (`lines 84, 100, 160`).

### 5.3 Concurrency Limitations (Single-Node vs Distributed)
- **Single-Node Serialized ACID: VERIFIED.** Within a single Node.js process, race conditions on inventory stock or mandate budget are completely eliminated by SQLite's serialized transaction mechanism.
- **Distributed Concurrency: NOT VERIFIED / NOT SUPPORTED IN CODE.** The current implementation relies on local SQLite file locking. If deployed across multiple server instances or containers sharing a network disk, SQLite locking cannot guarantee high-throughput ACID consistency.
- **PostgreSQL Schema Reference:** `src/store/postgres_schema.sql` defines enterprise PostgreSQL equivalents, but no PostgreSQL driver (`pg`, `prisma`, `typeorm`) is installed in `package.json` or imported in application code.

---

## 6. Protocol Adapter Comprehensive Matrix

The repository contains 7 protocol adapters under `src/adapters/`. Each adapter was inspected line-by-line:

| Protocol | Specification Version | Internal Adapter Class | Source Path | Declared Status | Audited Technical Status | External Interoperability Mechanism |
|----------|-----------------------|------------------------|-------------|-----------------|--------------------------|-------------------------------------|
| **ACG** | `v1.0.0-verified` | `ACGNativeAdapter` | `src/adapters/acg/adapter.ts:5` | `LIVE` | **LIVE** | Parses native canonical JSON payload with Ed25519 mandate. |
| **MCP** | `2024-11-05/v1` | `McpProtocolAdapter` | `src/adapters/mcp/adapter.ts:33` | `ADAPTER READY` | **ADAPTER READY** | Validates `tools/call` for `acg_checkout`, `execute_purchase`, `checkout_cart`. Normalizes to `CanonicalIntent`. |
| **A2A** | `2026.1-LF` | `A2AProtocolAdapter` | `src/adapters/a2a/adapter.ts:37` | `ADAPTER READY` | **ADAPTER READY** | Validates JSON-RPC 2.0 with `method: "a2a.commerce.*"`, `taskId`, and `senderAgent`. Normalizes to `CanonicalIntent`. |
| **ACP** | `acp/1.0` | `AcpProtocolAdapter` | `src/adapters/acp/adapter.ts:31` | `ADAPTER READY` | **ADAPTER READY** | Validates `protocol_version: "acp/*"`, `buyer_principal`, and `commerce_mandate`. Normalizes to `CanonicalIntent`. |
| **AP2** | `v0.2.0` | `Ap2ProtocolAdapter` | `src/adapters/ap2/adapter.ts:28` | `ADAPTER READY` | **ADAPTER READY** | Validates `ap2_version: "0.2*"`, `payer`, and `authorization_mandate`. Notes non-deterministic ECDSA JWT adaptation. |
| **UCP** | `ucp-v1.2` | `UcpProtocolAdapter` | `src/adapters/ucp/adapter.ts:27` | `ADAPTER READY` | **ADAPTER READY** | Validates `ucp_standard: "ucp*"`, `journey_id`, and `checkout_request`. Normalizes to `CanonicalIntent`. |
| **TAP** | `tap/1.0-draft` | `VisaTapProtocolAdapter` | `src/adapters/tap/adapter.ts:29` | `DESIGN` | **DESIGN / SIMULATED** | Validates `VisaTapEnvelopeSchema` with simulated check: `attestation_token.length >= 16`. |

### Technical Verification of Protocol Isolation
- In `src/gateway/router.ts:928-1163`, all protocol ingress routes (`POST /v1/agent/ingress/:protocol`) execute:
  ```ts
  const adapterResult = await defaultAdapterRegistry.normalize(protocol, request.body, activePolicy.merchant_id);
  ```
- **No adapter bypasses central authorization:** After normalization, the extracted `intent` is fed into the exact same 6-phase pipeline (replay check, kill switch check, revocation registry, Ed25519 signature check, truth engine, merchant policy engine, dual reservation engine).

---

## 7. Razorpay Integration Truth

### 7.1 Order Creation & Idempotency
- Implemented in `src/rails/razorpay.ts:48-91`.
- **Receipt Idempotency:** Line 50 explicitly maps `receipt: receiptIntentId` (where `receiptIntentId` is the unique `intent_id`). Razorpay's API guarantees that if an order with the same receipt is created again within the merchant account, it does not generate a second active order.
- **Environment Detection:** Line 42 checks:
  ```ts
  this.isLiveCredentials = this.keyId.startsWith("rzp_test_") && 
                           this.keyId !== "rzp_test_placeholder_key" && 
                           this.keyId !== "rzp_test_mock";
  ```
  When placeholder credentials are present, it returns an immediate mock order object (`id: order_<hex>`, `amount_due: amountPaise`, `status: created`).

### 7.2 Webhook Security & Monotonic Transitions
- Implemented in `src/rails/webhook.ts:59-153`.
- **Constant-Time Verification:** Line 44 uses `crypto.timingSafeEqual(expectedBuf, actualBuf)` preventing timing attacks.
- **Event Deduplication:** Line 76 checks `SELECT event_id FROM processed_webhook_events WHERE event_id = ?`. If found, returns `{ status: "DUPLICATE_IGNORED" }`.
- **Monotonic State Machine:**
  - `payment.authorized` -> transitions `order_sessions.status` to `PAYMENT_AUTHORIZED`.
  - `payment.captured` -> transitions `order_sessions.status` to `PAYMENT_CAPTURED` and permanently commits reservation via `reservationEngine.commitReservation()`.
  - `payment.failed` -> transitions `order_sessions.status` to `PAYMENT_FAILED` and releases held resources via `reservationEngine.releaseReservation()`.

### 7.3 Post-Capture Failure & Safe Refund
- Implemented in `src/rails/webhook.ts:162-206`.
- If post-capture fulfillment fails (e.g. physical stockout discovered after payment), `handlePostCaptureFulfillmentFailure()` checks `policy.auto_refund_on_fulfillment_failure`.
- If true, it calls `railClient.createRefund()` with a generated idempotency key `rfnd_${intentId}_${Date.now()}` and `X-Refund-Idempotency` header (`src/rails/razorpay.ts:121`).
- Transitions order session to `REFUNDED`.
- If policy disables auto-refund, escalates to `MANUAL_REVIEW` (`webhook.ts:199`).

### 7.4 Critical Observations & Integration Deficiencies
1. **Signature Bypass Header:** `src/gateway/router.ts:1174`:
   ```ts
   if (signature !== "mock_signature" && !webhookProcessor.verifySignature(rawBody, signature)) {
     return reply.status(401).send({ error: "INVALID_WEBHOOK_SIGNATURE" });
   }
   ```
   An attacker who supplies `x-razorpay-signature: mock_signature` bypasses HMAC verification completely.
2. **Body Re-serialization:** `const rawBody = JSON.stringify(request.body);` (`router.ts:1169`). In Fastify, if JSON body parsing alters key ordering or spacing, HMAC calculation will fail against genuine Razorpay webhooks unless raw buffer parsing is enabled.

---

## 8. Frontend Behavior & Metrics Classification

The luxury dashboard is implemented as a React 19 single-page application built with Vite and Tailwind CSS (`frontend/src/`).

### 8.1 Routes and Navigation
Hash-based client-side routing (`frontend/src/app/router.tsx:17-27`):
- `overview`: Metrics cards, recent activity, system status.
- `live-demo`: Interactive agent execution simulator.
- `transactions`: Grid of 50 most recent order sessions with status badges.
- `mandates`: Active buyer mandates and revocation registry view.
- `policies`: Active JSON Merchant Policy DSL inspector and compiler.
- `reservations`: Active and released dual-resource reservations.
- `audit-ledger`: Full SHA-256 block-by-block hash trajectory inspector.
- `system-health`: Component health status and integrity verification.
- `agent-compatibility`: Protocol matrix and adapter test runner.

### 8.2 Frontend Authentication
- `frontend/src/lib/api/apiClient.ts:37` reads `VITE_ACG_MERCHANT_TOKEN`.
- Lines 82-84 attach `Authorization: Bearer <token>` to all requests targeting `/dashboard/*`, `/v1/merchant/*`, and `/v1/mandates/revoke`.
- If no token is configured, requests fail with 401 Unauthorized because backend routes enforce `requireScope("merchant:read")`.

### 8.3 Metric Authenticity Classification

| Displayed Metric / Field | Value / Source | Code Location | Forensic Classification | Audit Assessment |
|--------------------------|----------------|---------------|-------------------------|------------------|
| **AI Intents Processed** | `COUNT(*) FROM audit_ledger WHERE event_type = 'INTENT_RECEIVED'` | `src/gateway/router.ts:162` | **REAL** | Live SQLite query reflecting actual ingested intents. |
| **Authorized GMV (₹)** | `COALESCE(SUM(amount), 0) FROM order_sessions WHERE status IN (...)` | `src/gateway/router.ts:163` | **REAL / DERIVED** | Live SQLite query summing paise converted to INR. |
| **Blocked Attempts** | `COUNT(*) FROM audit_ledger WHERE event_type IN (...)` | `src/gateway/router.ts:164` | **REAL** | Live SQLite query counting policy, revocation, and signature rejections. |
| **Active Reservations** | `COUNT(*) FROM reservations WHERE status = 'HELD'` | `src/gateway/router.ts:165` | **REAL** | Live SQLite query tracking dual-resource locks currently held. |
| **Audit Ledger Blocks** | `COUNT(*) FROM audit_ledger` | `src/gateway/router.ts:166` | **REAL** | Live SQLite query tracking chained audit records. |
| **Cold-Start Run Time** | `measured_cold_run_ms: 286.3` | `src/gateway/router.ts:177` | **HARDCODED** | Static float returned in metrics endpoint payload. |
| **Sandbox Connected** | `is_sandbox_connected: true` | `src/gateway/router.ts:178` | **HARDCODED** | Static boolean returned without checking external network connectivity. |
| **Gateway Latency** | `latency_ms: 12` | `src/gateway/router.ts:266` | **HARDCODED** | Static integer in `/dashboard/health` response. |
| **Razorpay Rails Status** | `mode: "Sandbox"` | `src/gateway/router.ts:270` | **HARDCODED** | Static string in `/dashboard/health` response. |

---

## 9. Audit Mechanism & SHA-256 Ledger

### 9.1 Implementation
Implemented in `src/store/audit.ts` backed by SQLite table `audit_ledger` (`src/store/db.ts:104`).

### 9.2 Cryptographic Forward-Chaining Algorithm
1. **Chain Linking:** In `logTransition()` (`src/store/audit.ts:23-25`), the latest hash is retrieved:
   ```sql
   SELECT record_hash FROM audit_ledger ORDER BY rowid DESC LIMIT 1;
   ```
   If no previous row exists, `prevHash = "GENESIS_BLOCK_0000000000000000"`.
2. **Payload Formulation:** Line 33 computes:
   ```ts
   const blockPayload = `${auditId}|${intentId}|${timestamp}|${eventType}|${prevState || "NULL"}|${newState}|${detailsJson}|${prevHash}`;
   ```
3. **Digest Computation:** Line 34 computes `crypto.createHash("sha256").update(blockPayload).digest("hex")`.
4. **Insertion:** Row is inserted with `record_hash` and `previous_record_hash`.

### 9.3 Ledger Verification Logic
In `verifyLedgerIntegrity()` (`src/store/audit.ts:69-111`):
1. Queries `SELECT * FROM audit_ledger ORDER BY rowid ASC`.
2. For block 0, checks `previous_record_hash === "GENESIS_BLOCK_0000000000000000"`.
3. For block `i > 0`, checks `row.previous_record_hash === rows[i - 1].record_hash`.
4. Re-computes the SHA-256 digest over the block payload and verifies equality with `row.record_hash`.
5. If any bit in `intent_id`, `event_type`, `previous_state`, `new_state`, `details_json`, or hashes is modified, verification terminates immediately with `{ isValid: false, checkedBlocks: i, error: ... }`.

### 9.4 Terminology & Non-Repudiation Nuance
- **Tamper-Evident SHA-256 Hash Chain: VERIFIED.** Any post-hoc mutation to an existing record or insertion of an out-of-sequence record invalidates all subsequent block hashes.
- **Not "Tamper-Proof":** The database is a local SQLite file. An administrator with write access to the filesystem could recalculate all subsequent hashes from the point of modification forward. It provides tamper-evidence, not hardware-level legal non-repudiation.

---

## 10. Unknown / Unverified Areas & Residual Gaps

1. **Multi-Process Concurrency / Horizontal Scale:**
   Because SQLite is used via `node:sqlite`, clustering across multiple Node.js instances or Kubernetes pods is unverified and structurally unsupported by SQLite's file-locking model.
2. **Live Razorpay Network Roundtrips:**
   All default test and benchmark executions use offline mock responses. Error codes, network timeouts, and HTTP status codes from live Razorpay API servers (`api.razorpay.com`) were not exercised with live credentials during baseline audit.
3. **Webhook Raw Payload Buffer Preservation:**
   Fastify parses JSON bodies before the route handler runs. `router.ts:1169` uses `JSON.stringify(request.body)` to compute the HMAC signature. If Razorpay sends JSON formatting that differs from V8's `JSON.stringify` (e.g. whitespace, floating-point formatting, key order), real webhook verification would fail in production.
4. **Static Bearer Token Storage:**
   `src/gateway/auth.ts:5` stores administrative credentials in an in-memory dictionary. Credential revocation, token rotation, and per-user audit attribution are not supported in the current auth layer.
5. **PostgreSQL Production Schema:**
   `src/store/postgres_schema.sql` is present in the repository, but no code connects to or tests PostgreSQL.

---

*Baseline architectural reconstruction independently verified and authored by worker_baseline_1.*
