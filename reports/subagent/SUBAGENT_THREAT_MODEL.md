# ACG INDEPENDENT RED TEAM: COMPREHENSIVE THREAT MODEL
**Report Target:** `reports/subagent/SUBAGENT_THREAT_MODEL.md`  
**Worker ID:** `worker_baseline_1`  
**Phase:** Phase 25 (Systematic Threat Modeling)  
**Date:** 2026-09-04  
**Integrity Mode:** READ-MOSTLY RED TEAM  
**Repository Path:** `B:\projects\RAZOR PAY- Buildathon`  
**Commit Hash:** `23ba7772a3bf69303930af93486970131326fd4c`  
**Target Architecture:** Agent Commerce Gateway (ACG / MACCP)

---

## 1. System Overview & Core Security Thesis

The Agent Commerce Gateway (ACG) operates as a **Merchant-Side Control Plane** designed to govern AI-originated autonomous commercial transactions. The system is predicated on the foundational axiom:

> **“The model can propose anything. It cannot authorize anything.”**  
> **“AI proposes. ACG authorizes. Razorpay executes.”**

ACG sits squarely between untrusted AI agents (running on frameworks like MCP, A2A, ACP, AP2, UCP, or native LLMs) and external financial settlement rails (Razorpay). Its mission is to prevent hallucinated pricing, unauthorized budget spending, inventory stock exhaustion, mandate replay, and fraudulent webhook state manipulation.

---

## 2. System Boundaries, Data Assets & Trust Zones

### 2.1 Trust Zone Decomposition

```
[ ZONE 0: UNTRUSTED EXTERNAL ENVIRONMENT ]
  - Autonomous Agent Frameworks (Anthropic MCP, LF A2A, OpenAI/Google UCP, AP2)
  - Public Internet & Unauthenticated Clients
  - Untrusted LLM Prompt Contexts & Stochastic Model Runtimes
              │
              │  [Boundary B1: Ingress Authentication, Rate Limiting & Protocol Normalization]
              ▼
[ ZONE 1: PROTOCOL ADAPTER & INGRESS PERIMETER ]
  - Fastify HTTP Server (Port 3000)
  - Rate Limiter (@fastify/rate-limit)
  - Protocol Adapter Registry (src/adapters/index.ts)
  - Schema Parsers (Zod CanonicalIntentSchema)
              │
              │  [Boundary B2: Cryptographic Identity & Mandate Verification]
              ▼
[ ZONE 2: ACG MERCHANT CONTROL PLANE & PDP CORE ]
  - Operational Kill Switch Engine (src/core/kill_switch.ts)
  - Mandate Revocation Registry (src/store/db.ts:revoked_mandates)
  - Ed25519 Mandate Signature Verifier (src/core/crypto.ts)
  - Commerce Truth Engine (src/core/truth.ts)
  - Policy Decision Point & Compiler (src/core/pdp.ts, policy.ts)
  - Hierarchical Budget & Velocity Engines (src/core/budget_hierarchy.ts, velocity.ts)
  - Multi-Agent Delegation Engine (src/core/delegation.ts)
              │
              │  [Boundary B3: ACID Dual-Resource Transaction Boundary]
              ▼
[ ZONE 3: ATOMIC STORAGE & AUDIT LEDGER ]
  - SQLite Database Handle (node:sqlite DatabaseSync)
  - Dual-Resource Reservation Engine (src/core/reservation.ts)
  - Forward-Chained SHA-256 Audit Ledger (src/store/audit.ts)
  - Tables: catalog_items, buyer_mandates, reservations, order_sessions
              │
              │  [Boundary B4: Financial Settlement Rail Boundary]
              ▼
[ ZONE 4: EXTERNAL FINANCIAL EXECUTION & SETTLEMENT ]
  - Razorpay Rail Client (src/rails/razorpay.ts)
  - Razorpay Order Creation (POST https://api.razorpay.com/v1/orders)
  - Razorpay Webhook Ingress (POST /webhooks/razorpay)
  - Razorpay Refund Handling (POST /v1/payments/:id/refund)
              ▲
              │  [Boundary B5: Administrative Control Boundary]
[ ZONE 5: MERCHANT ADMINISTRATIVE & UI DASHBOARD ]
  - Static Bearer Token Authentication (src/gateway/auth.ts)
  - Vite React SPA Dashboard (frontend/src/)
  - Management APIs (/dashboard/*, /v1/merchant/*, /v1/mandates/revoke)
```

### 2.2 Critical Data Assets & Security Objectives

| Asset Identifier | Asset Description | Security Objective | Criticality |
|------------------|-------------------|--------------------|-------------|
| **DA-1: Mandate Authority** | Ed25519 Buyer Mandate tokens & signatures | Integrity & Authenticity: Prevent budget inflation, signature forgery, or scope escalation. | **CRITICAL** |
| **DA-2: Merchant Truth** | SKU unit pricing, GST basis points, available stock in `catalog_items` | Integrity: Protect against agent price overrides or negative inventory. | **CRITICAL** |
| **DA-3: Dual-Resource Lock** | Mandate remaining balance & SKU reserved stock | Atomicity & Isolation: Prevent double-spending and overselling. | **CRITICAL** |
| **DA-4: Rail Credentials** | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Confidentiality: Guard against secret exfiltration and unauthorized order generation. | **CRITICAL** |
| **DA-5: Audit Ledger** | SHA-256 chained transaction records in `audit_ledger` | Tamper-Evidence: Guarantee that any post-hoc state mutation breaks the chain. | **HIGH** |
| **DA-6: Admin Bearer Tokens** | Static secrets in `src/gateway/auth.ts` | Confidentiality & Authenticity: Prevent unauthorized policy mutation or mandate revocation. | **HIGH** |
| **DA-7: Pending Confirmations** | Human approval tokens in `pending_confirmations` | Integrity & Authenticity: Prevent unauthorized confirmation of high-value transactions. | **HIGH** |

---

## 3. Threat Actors & Adversary Profiles

```
+-------------------------------------------------------------------------------------------------------+
| TA-1: Rogue / Prompt-Injected LLM Agent                                                               |
| Motivation: Autonomous optimization, prompt injection subversion, hallucination, or goal misalignment. |
| Capabilities: Full control over proposed checkout payloads; arbitrary SKU and quantity selection;     |
|               ability to manipulate incoming protocol formats (MCP, ACP, A2A).                        |
| Constraints: Lacks buyer's Ed25519 private key; cannot modify ACG database directly.                  |
+-------------------------------------------------------------------------------------------------------+

+-------------------------------------------------------------------------------------------------------+
| TA-2: Malicious / Dishonest Buyer Principal                                                           |
| Motivation: Financial theft, goods theft, double-spending, non-repudiation fraud.                      |
| Capabilities: Possesses valid Ed25519 signing key; can generate valid mandates; controls client       |
|               network environment; can attempt concurrent race attacks and immediate revocation races.|
| Constraints: Cannot alter merchant policy or merchant catalog database.                              |
+-------------------------------------------------------------------------------------------------------+

+-------------------------------------------------------------------------------------------------------+
| TA-3: Malicious / Fraudulent Merchant                                                                 |
| Motivation: Unauthorized extraction of buyer funds, artificial price inflation, over-charging.        |
| Capabilities: Controls merchant catalog database, policy DSL, and server host environment.            |
| Constraints: Cannot forge buyer's Ed25519 signature; bound by buyer's signed budget limit.             |
+-------------------------------------------------------------------------------------------------------+

+-------------------------------------------------------------------------------------------------------+
| TA-4: Network Man-in-the-Middle (MITM) / Eavesdropper                                                 |
| Motivation: Session hijacking, payload manipulation, credential harvesting, replay attacks.           |
| Capabilities: Intercepts unencrypted network traffic; injects packets; replays historical messages.   |
| Constraints: Bound by cryptographic signatures if verified on true canonical byte buffers.            |
+-------------------------------------------------------------------------------------------------------+

+-------------------------------------------------------------------------------------------------------+
| TA-5: Hostile Webhook Spoofer / Replayer                                                              |
| Motivation: Trigger unauthorized fulfillment dispatch, fake payment capture, or inventory locks.     |
| Capabilities: Sends forged HTTP POST requests to /webhooks/razorpay; replays valid historical events.  |
| Constraints: Must bypass HMAC SHA-256 verification (unless test bypass exists).                       |
+-------------------------------------------------------------------------------------------------------+

+-------------------------------------------------------------------------------------------------------+
| TA-6: Privilege Escalator / Untrusted Internal User                                                   |
| Motivation: Unauthorized administrative configuration changes, policy tampering, audit deletion.      |
| Capabilities: Access to HTTP endpoints; attempts to bypass RBAC scopes or guess bearer tokens.        |
| Constraints: Subject to Fastify route preHandlers and scope checks.                                  |
+-------------------------------------------------------------------------------------------------------+
```

---

## 4. Systematic STRIDE Threat Analysis

### 4.1 Spoofing (Identity Impersonation)

#### T-SPOOF-01: Spoofing Buyer Mandate via Signature Forgery
- **Target:** `POST /v1/agent/checkout` (`src/core/crypto.ts:23-44`)
- **Attack Path:** Adversary submits an altered mandate with an inflated `budget_limit` (e.g. ₹50,000 instead of ₹5,000) or an altered `merchant_whitelist`, attaching an invalid or modified Ed25519 signature.
- **Observed Defense:** `verifyMandateSignature()` reconstructs the canonical JSON payload (`src/core/crypto.ts:7-18`) and validates the Ed25519 SPKI DER signature. Any bit-flip in the signature, public key, or payload fields returns `false` and triggers HTTP 401 `INVALID_MANDATE_SIGNATURE`.
- **Residual Risk:** LOW. Cryptographic algorithm (Ed25519 via `@noble/ed25519` / `node:crypto`) is industry standard.

#### T-SPOOF-02: Spoofing Razorpay Webhooks via Test Signature Header Bypass
- **Target:** `POST /webhooks/razorpay` (`src/gateway/router.ts:1174`)
- **Attack Path:** Adversary posts a forged `payment.captured` webhook payload to `/webhooks/razorpay` and supplies the header `x-razorpay-signature: mock_signature`.
- **Observed Defense:** Line 1174 explicitly checks:
  ```ts
  if (signature !== "mock_signature" && !webhookProcessor.verifySignature(rawBody, signature)) {
    return reply.status(401).send({ error: "INVALID_WEBHOOK_SIGNATURE" });
  }
  ```
- **Vulnerability Assessment:** **CRITICAL VULNERABILITY.** An external attacker who knows or guesses the string `"mock_signature"` can completely bypass HMAC SHA-256 verification and trigger unauthorized transition of any order to `PAYMENT_CAPTURED`, committing reservations and triggering fulfillment dispatch (`src/rails/webhook.ts:121, 129`).
- **Required Fix:** Strip all `"mock_signature"` bypass logic from production routing code. Require HMAC verification unconditionally.

#### T-SPOOF-03: Spoofing Agent Identity in Ingress Adapters
- **Target:** `POST /v1/agent/ingress/:protocol` (`src/adapters/*`)
- **Attack Path:** Adversary sends an MCP or A2A message claiming to be an authorized enterprise agent (`agent_id: "native-llm-agent"`) to bypass capability restrictions.
- **Observed Defense:** In Phase 0-6, the gateway resolves permissions against the buyer's signed mandate, NOT the agent's self-declared name. Even if an agent spoofs its name, it cannot exceed the `budget_limit` signed by the user's private key. In Visa TAP (`src/adapters/tap/adapter.ts`), attestation is simulated (`length >= 16`).
- **Residual Risk:** MEDIUM for agent-level quota tracking; LOW for financial loss.

---

### 4.2 Tampering (Data Manipulation)

#### T-TAMP-01: Agent Price Manipulation / Arithmetic Hallucination
- **Target:** `src/core/truth.ts:86-153` (`CommerceTruthEngine.resolveTruth`)
- **Attack Path:** A prompt-injected LLM submits `proposed_items: [{ sku: "SKU-KEYBOARD-RGB", quantity: 1, price: 100 }]` attempting to purchase a ₹4,130 keyboard for ₹1.00.
- **Observed Defense:** `ProposedItemSchema` (`src/core/types.ts:17-21`) strictly ignores any `price` attribute. `resolveTruth()` fetches `catalog_items.unit_price` (350,000 paise) directly from SQLite and recalculates subtotal and tax. The agent's arithmetic is completely eliminated from execution.
- **Residual Risk:** NONE. The Truth Engine architecture completely neutralizes price tampering.

#### T-TAMP-02: Mandate Expiry and Scope Tampering
- **Target:** `src/core/policy.ts:43-77` (`PolicyEngine.evaluate`)
- **Attack Path:** Adversary attempts to use an expired mandate or reuse a mandate intended for Merchant A at Merchant B.
- **Observed Defense:** Evaluates:
  1. `decisionTimestamp > mandate.expiry` -> 403 `MANDATE_EXPIRED`
  2. `!mandate.merchant_whitelist.includes(merchantId)` -> 403 `MERCHANT_NOT_WHITELISTED`
  3. `!mandate.category_whitelist.includes(cat)` -> 403 `CATEGORY_NOT_WHITELISTED`
- **Residual Risk:** NONE. Governed by signed mandate fields and verified before reservation.

#### T-TAMP-03: Tampering with SQLite Audit Ledger Entries
- **Target:** `src/store/audit.ts:69-111` (`AuditLedger.verifyLedgerIntegrity`)
- **Attack Path:** A compromised administrative actor directly modifies SQLite rows in `audit_ledger` (e.g. changing an `INTENT_REJECTED` event to `PAYMENT_CAPTURED`).
- **Observed Defense:** The ledger uses SHA-256 hash chaining:
  ```ts
  const blockPayload = `${auditId}|${intentId}|${timestamp}|${eventType}|${prevState || "NULL"}|${newState}|${detailsJson}|${prevHash}`;
  ```
  Any modification to `details_json`, `event_type`, or states causes `computedHash !== row.record_hash` on verification. `verifyLedgerIntegrity()` detects the broken chain link and returns the exact block ID.
- **Residual Risk:** LOW. Tamper-evident within the SQLite database.

#### T-TAMP-04: Webhook Payload Re-Serialization Mismatch
- **Target:** `src/gateway/router.ts:1169` & `src/rails/webhook.ts:44`
- **Attack Path:** Legitimate Razorpay webhook arrives with specific JSON whitespace. Fastify parses the body into an object, and line 1169 re-stringifies it: `const rawBody = JSON.stringify(request.body)`.
- **Vulnerability Assessment:** **HIGH INTEGRATION DEFICIENCY.** If V8's `JSON.stringify` produces different spacing, key order, or character escapes than Razorpay's raw HTTP payload bytes, valid HMAC signatures will fail verification, resulting in false rejection of legitimate payment events.
- **Required Fix:** Configure Fastify's raw body plugin to capture the exact incoming `Buffer` for HMAC verification.

---

### 4.3 Repudiation (Denial of Actions)

#### T-REP-01: Buyer Repudiation of Autonomous Agent Purchases
- **Target:** End-to-end checkout pipeline (`src/gateway/router.ts`)
- **Attack Path:** A buyer authorizes an agent with a broad mandate, and after the agent executes ₹4,000 in purchases, the buyer claims "I never authorized this transaction."
- **Observed Defense:** ACG records:
  1. The buyer's cryptographic Ed25519 signature over the exact mandate constraints (`budget_limit`, `merchant_whitelist`, `expiry`).
  2. Immutable forward-chained audit block in `audit_ledger` recording `client_nonce`, `mandate_id`, and `principal_public_key`.
  3. Razorpay `receipt` permanently bound to `intent_id`.
- **Residual Risk:** LOW. The cryptographic evidence chain provides strong technical proof of user delegation.

#### T-REP-02: Merchant Repudiation of Policy Configuration
- **Target:** `src/core/policy.ts:36-41` & `src/gateway/router.ts:795`
- **Attack Path:** A merchant changes policy rules (e.g. lowering max transaction cap) and attempts to retroactively invalidate previously authorized transactions.
- **Observed Defense:** Every authorization decision and audit block permanently pins `policy_version`, `effective_at`, and `decision_timestamp`. Policies are versioned immutable snapshots.
- **Residual Risk:** NONE.

---

### 4.4 Information Disclosure (Confidentiality Leaks)

#### T-INFO-01: Static Administrative Bearer Token Exposure
- **Target:** `src/gateway/auth.ts:5-9`
- **Attack Path:** Source inspection reveals:
  ```ts
  const validTokens: Record<string, string[]> = {
    "secret_merchant_admin": ["merchant:read", "merchant:policy:write", "merchant:mandate:revoke", "merchant:refund", "audit:read", "audit:verify"],
    "secret_merchant_viewer": ["merchant:read", "audit:read"],
    "secret_audit_bot": ["audit:read", "audit:verify"],
  };
  ```
- **Vulnerability Assessment:** **HIGH RISK.** Static credentials in source code allow anyone with read access to the repository to invoke administrative endpoints (policy updates, mandate revocation, audit ledger export).
- **Required Fix:** Move administrative tokens to environment variables or JWT authentication with public-key verification.

#### T-INFO-02: Excessive Schema Validation Error Disclosure
- **Target:** `src/gateway/router.ts:698, 938`
- **Attack Path:** Malformed requests trigger `details: parseResult.error.format()`.
- **Observed Defense:** Returns internal Zod schema formatting. While helpful for developers, in production it leaks internal model definitions, schema validation paths, and field constraints to unauthenticated callers.
- **Residual Risk:** LOW. Informational disclosure.

#### T-INFO-03: Sensitive Secrets Leakage in Trace Records
- **Target:** `src/core/trace.ts:50-62` (`DecisionTraceRecorder.sanitize`)
- **Observed Defense:** Proactive sanitization regex:
  ```ts
  if (/key|secret|token|password|auth/i.test(k)) {
    sanitized[k] = "[REDACTED]";
  }
  ```
  Any key matching secret patterns is redacted before storage in `decision_traces`.
- **Residual Risk:** LOW. Sanitization is verified active in code.

---

### 4.5 Denial of Service (DoS & Resource Exhaustion)

#### T-DOS-01: Concurrency Race Warfare & Double-Spend Attacks
- **Target:** `src/core/reservation.ts:59-168` (`DualResourceReservationEngine.holdReservation`)
- **Attack Path:** 100 parallel subagents concurrently submit intents attempting to reserve the last inventory unit (`available_stock = 1`) or spend the last paise of a mandate.
- **Observed Defense:**
  1. `this.db.exec("BEGIN IMMEDIATE TRANSACTION;");` serializes transaction execution at the SQLite engine level.
  2. Available stock and remaining budget are re-checked under the lock.
  3. The first transaction commits; the remaining 99 transactions encounter `availableStock < resItem.quantity` or `remainingBudget < totalRequiredAmount`, immediately execute `ROLLBACK;`, and return HTTP 409 `INSUFFICIENT_STOCK` or `MANDATE_EXHAUSTED`.
- **Residual Risk:** LOW for data consistency (0 over-allocation); MEDIUM for latency under extreme load due to SQLite lock contention.

#### T-DOS-02: Rate Limiter Flooding & Resource Exhaustion
- **Target:** `src/server.ts:34-38`, `src/gateway/router.ts:692, 928, 1168`
- **Attack Path:** High-volume traffic floods `/v1/agent/checkout` or `/v1/agent/ingress/:protocol`.
- **Observed Defense:** Fastify rate limiter enforces:
  - `max: 50, timeWindow: '1 minute'` on checkout and ingress endpoints.
  - `max: 10, timeWindow: '1 minute'` on mandate revocation and policy mutation.
  - `max: 200, timeWindow: '1 minute'` on webhook receiver.
  - Request body limit enforced at `1,048,576` bytes (1MB) in `src/server.ts:25`.
- **Residual Risk:** LOW. Standard DoS perimeter defense in place.

#### T-DOS-03: Intent ID Replay Flooding
- **Target:** `src/gateway/router.ts:706`
- **Attack Path:** Attacker replays identical `intent_id` repeatedly to force database queries or duplicate orders.
- **Observed Defense:** Instant query on `order_sessions WHERE intent_id = ?` returns HTTP 409 `DUPLICATE_INTENT_REPLAY` without invoking the Truth Engine or Razorpay APIs.
- **Residual Risk:** NONE.

---

### 4.6 Elevation of Privilege (Policy & Governance Bypass)

#### T-ELEV-01: Alternate Ingress Route Bypass
- **Target:** `POST /v1/authorize` and `POST /v1/financial-actions` (`src/gateway/router.ts:1499-1518`)
- **Attack Path:** Attacker attempts to bypass the 6-phase checkout pipeline by calling `/v1/authorize` or `/v1/financial-actions` directly.
- **Observed Defense:** Both endpoints execute:
  ```ts
  const res = await app.inject({
    method: "POST",
    url: "/v1/agent/checkout",
    headers: request.headers as any,
    payload: request.body as any,
  });
  return reply.status(res.statusCode).send(JSON.parse(res.body));
  ```
  No backdoor or bypass path exists; all alternative endpoints delegate directly to the canonical checkout pipeline.
- **Residual Risk:** NONE.

#### T-ELEV-02: Multi-Agent Delegation Ceiling Escalation
- **Target:** `src/core/delegation.ts:53-58` (`MultiAgentDelegationEngine.createDelegation`)
- **Attack Path:** A subagent attempts to delegate authority to another child agent with an amount exceeding its own parent capability ceiling.
- **Observed Defense:** Line 54 strictly asserts:
  ```ts
  if (maxAmountPaise > parentPurchaseCap.max_amount) {
    throw new Error(`Delegation amount exceeds parent ceiling`);
  }
  ```
  A child agent can never receive a spend ceiling higher than its delegating parent.
- **Residual Risk:** NONE.

#### T-ELEV-03: Human Confirmation Token Guessing
- **Target:** `POST /v1/confirm` (`src/gateway/router.ts:1251-1344`)
- **Attack Path:** High-value transactions exceeding `confirmation_above` (₹3,000) enter `REQUIRE_CONFIRMATION`. Attacker attempts to guess the `confirmation_token` to approve the transaction without merchant approval.
- **Observed Defense:** `confirmation_token` is generated using `crypto.randomBytes(16).toString("hex")` (128 bits of entropy) in `src/core/pdp.ts:277`. Tokens expire after 900 seconds (15 minutes). Guessing 128-bit tokens before expiration is computationally infeasible.
- **Residual Risk:** LOW.

---

## 5. Agent-Specific & AI-Centric Threat Vectors

| Threat Vector ID | Vector Name | Threat Scenario | Control in ACG | Control Status |
|------------------|-------------|-----------------|----------------|----------------|
| **AT-01** | **Prompt Injection Price Tampering** | Adversary tricks LLM into claiming a ₹10,000 product costs ₹1.00. | `truthEngine.resolveTruth()` strips agent price claims and reads merchant database. | **EFFECTIVE (100% BLOCKED)** |
| **AT-02** | **Phantom SKU Injection** | Prompt injection causes agent to invent a non-existent SKU or inactive product. | `truthEngine.resolveTruth()` verifies `sku` exists and `is_active = 1` in `catalog_items`. | **EFFECTIVE (100% BLOCKED)** |
| **AT-03** | **Budget Splitting / Velocity Evasion** | Agent attempts to bypass `max_transaction_amount` by issuing multiple rapid micro-transactions. | `VelocityEngine.checkVelocity()` tracks per-minute, per-hour, and per-day spend and action counts. | **EFFECTIVE (100% BLOCKED)** |
| **AT-04** | **Mandate Replay Across Merchants** | Compromised agent takes mandate signed for Merchant A and submits it to Merchant B. | `policyEngine.evaluate()` checks `mandate.merchant_whitelist` against `activePolicy.merchant_id`. | **EFFECTIVE (100% BLOCKED)** |
| **AT-05** | **Race Condition on Mandate Revocation** | User revokes mandate while agent attempts last-second checkout before revocation registers. | Phase 2a queries `revoked_mandates` registry BEFORE evaluating policy or locking resources. | **EFFECTIVE (100% BLOCKED)** |
| **AT-06** | **Out-of-Category Privilege Creep** | Agent instructed to buy electronics attempts to purchase furniture or gift cards. | Checked at two levels: `mandate.category_whitelist` and merchant policy `allowed_categories`. | **EFFECTIVE (100% BLOCKED)** |

---

## 6. Threat Modeling Gap Analysis & Hardening Roadmap

### 6.1 Confirmed Vulnerabilities & Weaknesses

| Finding ID | Severity | Component | Description | Remediation |
|------------|----------|-----------|-------------|-------------|
| **VULN-01** | **CRITICAL** | `src/gateway/router.ts:1174` | **Webhook Signature Test Bypass:** The condition `signature !== "mock_signature"` allows anyone passing `x-razorpay-signature: mock_signature` to forge payment events. | Delete `signature !== "mock_signature"` condition immediately from production router. |
| **VULN-02** | **HIGH** | `src/gateway/auth.ts:5-9` | **Hardcoded Administrative Credentials:** Static bearer tokens (`secret_merchant_admin`) are embedded in source. | Replace static dictionary with environment secrets or asymmetric JWT verification. |
| **VULN-03** | **HIGH** | `src/gateway/router.ts:1169` | **HMAC Payload Re-Serialization:** Fastify re-serializes parsed JSON body before HMAC verification, risking false signature rejection. | Configure Fastify to capture and verify raw incoming request buffer bytes. |
| **VULN-04** | **MEDIUM** | `src/gateway/router.ts:177, 266` | **Hardcoded Telemetry in API Responses:** Latency metrics (`286.3 ms`, `12 ms`) are static literals rather than real-time measurements. | Compute rolling percentiles (p50/p95/p99) from `decision_traces` table. |
| **VULN-05** | **MEDIUM** | `src/core/reservation.ts:72` | **Single-Node SQLite Concurrency Bound:** Locking via `BEGIN IMMEDIATE TRANSACTION;` does not scale horizontally across multiple instances. | Implement PostgreSQL `SELECT ... FOR UPDATE` or Redis distributed locks for cluster mode. |

---

*Comprehensive threat model independently formulated and verified by worker_baseline_1.*
