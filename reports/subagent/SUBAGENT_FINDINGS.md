# MASTER CATALOG OF SECURITY & ARCHITECTURAL FINDINGS
**Document Identifier:** `reports/subagent/SUBAGENT_FINDINGS.md`  
**Evaluation:** ACG Independent Red Team / Architectural Review  
**Date:** 2026-09-04  
**Target Repository:** `B:\projects\RAZOR PAY- Buildathon`  
**Commit Hash:** `23ba7772a3bf69303930af93486970131326fd4c`  
**Integrity Mode:** READ-MOSTLY RED TEAM (Consolidated Multi-Track Master Audit)

---

## 1. Executive Summary & Synthesis Methodology

This document establishes the authoritative, consolidated master catalog of all security vulnerabilities, architectural boundaries, concurrency limitations, and documentation discrepancies discovered during the multi-track independent red-team review of the Agent Commerce Gateway (ACG).

The catalog synthesizes, correlates, and deduplicates the forensic findings generated across:
- **Track 2 (Worker Auth & Cryptography):** Workstreams A, B, C, D, E (`reports/subagent/findings_track2.json`)
- **Track 3 (Worker Rails, Protocols & Storage):** Workstreams F, G, H, I, J, K, L, M (`reports/subagent/findings_track3.json`)
- **Track 4 (Worker Resilience, Quality & Claims):** Workstreams N, O, P (`reports/subagent/findings_track4.json`)

### Core Verification Invariant
> **"The model can propose anything. It cannot authorize anything."**  
> **"NO FINANCIAL MUTATION WITHOUT SUCCESSFUL AUTHORIZATION."**

Across the core authorization pipeline (`/v1/agent/checkout`), the fundamental invariants are **intact**: LLM-proposed prices are stripped and re-resolved against merchant catalog truth, single-node SQLite transactions prevent double-spend races, and audit blocks are forward-chained with SHA-256. However, severe perimeter bypasses, webhook processing flaws, and governance plane disconnections were discovered in auxiliary control plane routes.

---

## 2. Findings Summary Tables

### 2.1 Findings by Severity

| Severity | Count | Primary Impact Areas |
| :--- | :---: | :--- |
| **CRITICAL** | 3 | Alternate endpoint reservation bypass, mandate budget restoration double-spend, webhook test signature bypass |
| **HIGH** | 5 | Ingress PDP governance disconnect, unauthenticated supervisor confirmation, webhook state machine bypass, body re-serialization, hardcoded admin tokens |
| **MEDIUM** | 4 | Delegation child agent validation omission, nonce replay omission, malformed rail null order ID, hardcoded telemetry metrics |
| **LOW** | 3 | Ed25519 canonical array serialization, webhook timestamp event ID fallback, CI workflow least-privilege permissions |
| **INFORMATIONAL** | 5 | Single-node SQLite distributed scaling limits, audit ledger SHA-256 tamper evidence, benchmark cold-boot qualification, test count metric drift (77 -> 102), Strix attribution disclosure |
| **TOTAL** | **20** | **15 Security / Quality Deficiencies + 5 Architectural / Documentation Disclosures** |

### 2.2 Findings by Workstream Matrix

| Workstream | Phase | Scope Domain | Critical | High | Medium | Low | Info | Total |
| :--- | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **WS-A: Authorization** | Phase 3 | Ingress & Control Plane Routes | 2 | 1 | 1 | 0 | 0 | **4** |
| **WS-B: Cryptography** | Phase 4 | Ed25519 Signatures & Mandates | 0 | 0 | 0 | 1 | 0 | **1** |
| **WS-C: Agent Identity** | Phase 5 | Agent Principals & Delegation | 0 | 0 | 1 | 0 | 0 | **1** |
| **WS-D: Policy Engine** | Phase 6 | PDP, Velocity & Confirmations | 0 | 2 | 0 | 0 | 0 | **2** |
| **WS-E: Resource Warfare** | Phase 7 | Budgets, Inventory & Double-Spend | 1 | 0 | 0 | 0 | 0 | **1** |
| **WS-F: State Machine** | Phase 8 | Payment Lifecycle & Transitions | 0 | 1 | 0 | 0 | 0 | **1** |
| **WS-G: Webhook Security** | Phase 9 | HMAC, Replay & Ingress Validation | 1 | 1 | 0 | 1 | 0 | **3** |
| **WS-H: API Auth & RBAC** | Phase 10 | Privileged Routes & Bearer Tokens | 1 | 1 | 0 | 0 | 0 | **2** |
| **WS-I: Protocols** | Phase 11 | MCP, A2A, ACP, AP2, UCP, TAP | 0 | 0 | 0 | 0 | 0 | **0** |
| **WS-J: Razorpay Rail** | Phase 12 | Sandbox, Orders & Refunds | 0 | 0 | 1 | 0 | 0 | **1** |
| **WS-K: Database / ACID** | Phase 13 | SQLite Transactions & Locks | 0 | 0 | 0 | 0 | 1 | **1** |
| **WS-L: Audit Ledger** | Phase 14 | Tamper-Evident SHA-256 Chains | 0 | 0 | 0 | 0 | 1 | **1** |
| **WS-M: Frontend Security** | Phase 15 | SPA API Contracts & Telemetry | 0 | 0 | 1 | 0 | 0 | **1** |
| **WS-N: Chaos & Failure** | Phase 16-17 | Fail-Closed Invariants & Resiliency | 0 | 1 | 0 | 0 | 0 | **1** |
| **WS-O: Performance** | Phase 18 | Benchmark Timing & Cold Boot | 0 | 0 | 0 | 0 | 1 | **1** |
| **WS-P: Quality & Claims** | Phase 19-22 | Test Suite, CI & Disclosures | 0 | 1 | 0 | 1 | 2 | **4** |

---

## 3. Deduplication & Cross-Reference Mapping

| Master Finding ID | Raw Track Findings Merged | Primary Focus |
| :--- | :--- | :--- |
| **FINDING-001** | `SEC-TRK2-001`, `TRK3-RBAC-01` | Unauthenticated direct inventory lockup via `POST /v1/reservations` |
| **FINDING-002** | `SEC-TRK2-002` | Mandate budget restoration double-spend via `ON CONFLICT` clause in `POST /v1/mandates` |
| **FINDING-003** | `TRK3-WH-01` | Hardcoded `"mock_signature"` HMAC verification bypass in `/webhooks/razorpay` |
| **FINDING-004** | `SEC-TRK2-003`, `SEC-TRK4-002` | Disconnected governance plane: live checkout bypasses V2 PDP; unit tests test isolated PDP |
| **FINDING-005** | `SEC-TRK2-004` | Unauthenticated confirmation endpoint `/v1/confirm` and mandate revocation bypass |
| **FINDING-006** | `TRK3-SM-01`, `SEC-TRK4-001` | Webhook handler bypasses `FinancialStateMachine`, dispatching fulfillment on failed/released sessions |
| **FINDING-007** | `TRK3-WH-02` | Webhook HMAC verification computed over `JSON.stringify(request.body)` instead of raw socket bytes |
| **FINDING-008** | `TRK3-RBAC-02` | Static plaintext administrative bearer tokens in `src/gateway/auth.ts` |
| **FINDING-009** | `SEC-TRK2-005` | `MultiAgentDelegationEngine` omits status validation of child agents |
| **FINDING-010** | `SEC-TRK2-006` | Client nonce is not cached or deduplicated, permitting cross-intent replay attacks |
| **FINDING-011** | `SEC-TRK4-003` | Malformed payment rail response accepting null order ID and corrupting session reconciliation |
| **FINDING-012** | `TRK3-FE-01` | Static hardcoded latency and connection metrics returned in `/dashboard/metrics` and `/dashboard/health` |
| **FINDING-013** | `SEC-TRK2-007` | Canonical Ed25519 serialization discrepancy on optional arrays and missing domain prefix |
| **FINDING-014** | `TRK3-WH-03` | Webhook handler generates non-deterministic event IDs when header is omitted, bypassing deduplication |
| **FINDING-015** | `SEC-TRK4-004` | GitHub Actions workflow `.github/workflows/ci.yml` omits explicit permissions block |
| **FINDING-016** | `SEC-TRK2-008`, `TRK3-ACID-01` | Single-node synchronous SQLite file locks do not scale to distributed multi-instance clusters |
| **FINDING-017** | `TRK3-AUD-01` | Verified cryptographic forward-chain integrity of 307 SHA-256 audit blocks across 3 SQLite ledgers |
| **FINDING-018** | `SEC-TRK4-005` | Benchmark baseline (303.81 ms) measures single-iteration cold-start boot with in-memory mocks |
| **FINDING-019** | `SEC-TRK4-006` | Documentation metric drift: documented 77/77 tests superseded by 102/102 active passing tests |
| **FINDING-020** | `SEC-TRK4-007` | External tool attribution: assessment utilized Strix-informed methodology without independent binary scan |

---

## 4. Master Finding Catalog (Phase 24 Format)

### FINDING-001
ID: FINDING-001  
SEVERITY: CRITICAL  
TITLE: Alternate Endpoint Authorization Bypass in POST /v1/reservations Permitting Unauthenticated Inventory Depletion and Denial of Service  
LOCATION: `src/gateway/router.ts:1684-1701`  
OBSERVATION: Route `POST /v1/reservations` exposes direct access to the dual-resource reservation engine (`reservationEngine.holdReservation`). It accepts an unauthenticated JSON payload containing `intent_id`, `mandate`, and `items`. The endpoint performs zero Ed25519 cryptographic signature verification, zero mandate revocation checks against `revoked_mandates`, zero merchant policy evaluation, zero RBAC authentication preHandlers, and appends zero records to the tamper-evident audit ledger.  
ATTACK / REPRODUCTION:  
1. Send an anonymous HTTP POST to `/v1/reservations` with payload:  
```json
{
  "intent_id": "b3f94605-e408-41ce-83a3-b09e25d36b80",
  "mandate": {
    "mandate_id": "forged_mandate_001",
    "principal_public_key": "deadbeef0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c",
    "budget_limit": 10000000,
    "currency": "INR",
    "expiry": 9999999999,
    "signature": "invalid_garbage_signature"
  },
  "items": [{ "sku": "SKU-KEYBOARD-RGB", "quantity": 5 }]
}
```
2. Endpoint executes `registerMandateIfAbsent()` without validating signature.  
3. Endpoint executes `reservationEngine.holdReservation()` which decrements `catalog_items.available_stock` from 5 to 0 and inserts a `HELD` reservation.  
4. Endpoint responds with HTTP 201 Created.  
EXPECTED: Endpoint must enforce strict authentication (`requireScope('merchant:policy:write')`) or require requests to pass the full 6-phase cryptographic, revocation, and policy pipeline. Invariant: NO RESOURCE MUTATION WITHOUT AUTHORIZATION.  
ACTUAL: Any anonymous external client can forge an arbitrary mandate, bypass signature verification and policy checks, and deplete merchant product inventory to 0.  
IMPACT: CRITICAL. Complete authorization bypass, unauthenticated inventory lockup, and resource exhaustion without financial settlement or cryptographic authority.  
EVIDENCE: Source inspection of `src/gateway/router.ts:1684-1701` reveals no call to `verifyMandateSignature()`, no query to `revoked_mandates`, no check of `policyEngine.evaluate()`, and no `preHandler` authentication hook.  
RECOMMENDATION: Require administrative authentication (`preHandler: [requireScope('merchant:policy:write')]`) or remove `POST /v1/reservations` entirely. Ensure reservations can only be created via the canonical pipeline (`/v1/agent/checkout` or `/v1/agent/ingress/:protocol`).  
REGRESSION TEST REQUIRED: Submit forged signature to `POST /v1/reservations` and assert HTTP 401/403 rejection without database stock decrement.

---

### FINDING-002
ID: FINDING-002  
SEVERITY: CRITICAL  
TITLE: Mandate Budget Restoration and Double-Spending Flaw in POST /v1/mandates via ON CONFLICT Clause  
LOCATION: `src/gateway/router.ts:1663-1667`  
OBSERVATION: In `POST /v1/mandates`, the SQL registration query uses `ON CONFLICT(mandate_id) DO UPDATE SET budget_limit = excluded.budget_limit, remaining_budget = excluded.remaining_budget, expiry = excluded.expiry`. Because `excluded.remaining_budget` is bound to `mandate.budget_limit` (lines 1670-1671), re-submitting an existing, partially or fully spent mandate completely resets `remaining_budget` back to its initial maximum budget limit.  
ATTACK / REPRODUCTION:  
1. User principal signs a valid mandate for ₹5,000 (500,000 paise).  
2. Agent executes checkout for ₹4,130 (`SKU-KEYBOARD-RGB`). Mandate `remaining_budget` in `buyer_mandates` is decremented to ₹870.  
3. Malicious agent or client sends `POST /v1/mandates` with the original signed mandate payload.  
4. Database executes `ON CONFLICT` clause and sets `remaining_budget = 500000` paise.  
5. Agent executes a second checkout for ₹4,130, effectively double-spending and exceeding the signed ₹5,000 authority by ₹3,260.  
EXPECTED: Re-registration of an existing mandate must NOT reset spent balances. `ON CONFLICT` should reject the request, preserve existing `remaining_budget` (e.g. `remaining_budget = buyer_mandates.remaining_budget`), or require cryptographic proof of supplemental funding.  
ACTUAL: Submitting the original valid mandate restores `remaining_budget` to 100% capacity regardless of previous spend history.  
IMPACT: CRITICAL. Financial double-spending and unauthorized budget inflation beyond the cryptographic spending authority granted by the buyer principal.  
EVIDENCE: `src/gateway/router.ts:1663-1667`: `ON CONFLICT(mandate_id) DO UPDATE SET budget_limit = excluded.budget_limit, remaining_budget = excluded.remaining_budget, expiry = excluded.expiry`. The fourth parameter passed to `run()` is `mandate.budget_limit`.  
RECOMMENDATION: Modify SQL to: `ON CONFLICT(mandate_id) DO UPDATE SET expiry = excluded.expiry` and omit resetting `remaining_budget`, or return HTTP 409 `MANDATE_ALREADY_EXISTS`.  
REGRESSION TEST REQUIRED: Register mandate, spend 80% of budget, re-register mandate via `POST /v1/mandates`, and assert `remaining_budget` remains at 20%.

---

### FINDING-003
ID: FINDING-003  
SEVERITY: CRITICAL  
TITLE: Hardcoded Test Signature Bypass in Razorpay Webhook Ingress  
LOCATION: `src/gateway/router.ts:1174`  
OBSERVATION: Line 1174 in `src/gateway/router.ts` contains: `if (signature !== "mock_signature" && !webhookProcessor.verifySignature(rawBody, signature))`. Supplying the literal string `"mock_signature"` in the `x-razorpay-signature` HTTP header completely bypasses HMAC SHA-256 verification unconditionally.  
ATTACK / REPRODUCTION:  
1. Attacker sends HTTP POST to `/webhooks/razorpay` with header `x-razorpay-signature: mock_signature`.  
2. Payload contains forged capture event:  
```json
{
  "event": "payment.captured",
  "payload": {
    "order": { "entity": { "id": "order_target_123" } },
    "payment": { "entity": { "id": "pay_fake_999", "amount": 413000 } }
  }
}
```
3. Router bypasses HMAC check and executes `webhookProcessor.processEvent()`.  
4. Order session is marked `PAYMENT_CAPTURED` and physical fulfillment is triggered without valid bank settlement.  
EXPECTED: HMAC SHA-256 signature verification must be enforced unconditionally on every incoming webhook payload.  
ACTUAL: Supplying `"mock_signature"` satisfies the signature gate and processes unauthenticated webhook events.  
IMPACT: CRITICAL. Remote unauthorized financial settlement manipulation: An external attacker can fake payment captures, commit reservations, and trigger fulfillment dispatches without paying.  
EVIDENCE: Source code inspection of `src/gateway/router.ts:1174` confirms the short-circuit bypass.  
RECOMMENDATION: Remove `signature !== "mock_signature"` from routing code immediately. In automated unit tests, generate valid HMAC SHA-256 signatures using `crypto.createHmac('sha256', secret)` instead of embedding bypasses in runtime logic.  
REGRESSION TEST REQUIRED: Assert that `POST /webhooks/razorpay` with `x-razorpay-signature: mock_signature` returns HTTP 401 `INVALID_WEBHOOK_SIGNATURE`.

---

### FINDING-004
ID: FINDING-004  
SEVERITY: HIGH  
TITLE: Disconnected Governance Plane: Live Ingress Checkout Bypasses Advanced PDP, Agent Identity, Capability Limits, and Confirmation Thresholds  
LOCATION: `src/gateway/router.ts:692-923, 928-1165` and `src/core/__tests__/v2_control_plane.test.ts:95-122`  
OBSERVATION: The live ingress endpoints (`POST /v1/agent/checkout` and `POST /v1/agent/ingress/:protocol`) invoke legacy `policyEngine.evaluate()` rather than the advanced Policy Decision Point (`pdp.evaluateIntent()`). Consequently, agent principal status in `agent_principals` (`ACTIVE`, `SUSPENDED`, `REVOKED`), agent purchase capability ceilings (`max_amount`), agent daily budgets (`daily_budget`), hierarchical merchant budgets (`merchant_budgets`), velocity limits (`VelocityEngine`), and autonomous confirmation thresholds (`confirmation_above`) are completely bypassed during live checkout. Furthermore, unit test `v2_control_plane.test.ts:95-122` tests `pdp.evaluateIntent()` in isolation, reporting green while the live HTTP ingress remains vulnerable.  
ATTACK / REPRODUCTION:  
1. Admin sets `agent_principals` status for `agent_rogue_01` to `REVOKED`.  
2. Agent submits checkout request for ₹4,130 to `POST /v1/agent/checkout`.  
3. Router evaluates `policyEngine.evaluate()`, which only checks mandate expiry, whitelist, and merchant max amount.  
4. Router acquires dual reservation and executes Razorpay order creation, returning HTTP 201 Created.  
5. In contrast, calling `pdp.evaluateIntent()` directly returns DENY (`AGENT_REVOKED`).  
EXPECTED: Live ingress checkout must execute through `pdp.evaluateIntent(intent, activePolicy, agentId)` so that agent identities, capabilities, velocity limits, and human confirmation thresholds are strictly enforced prior to reservation.  
ACTUAL: Gateway creates live financial orders for revoked agents and bypasses confirmation thresholds for transactions exceeding ₹3,000.  
IMPACT: HIGH. Defeats multi-agent governance and agent principal isolation claims; rogue or revoked agents can execute commercial transactions if they possess a valid buyer mandate. False-pass risk in test suite.  
EVIDENCE: Grep search confirms `pdp.evaluateIntent()` is only called in unit tests and `mcp_surface.ts`, but never in `router.ts` checkout routes lines 692-1165.  
RECOMMENDATION: Wire `router.ts` checkout routes to invoke `pdp.evaluateIntent()` in Phase 4. If decision is `REQUIRE_CONFIRMATION`, return HTTP 202 Accepted with `confirmation_token` rather than creating orders. Refactor test 1.2 to execute over HTTP.  
REGRESSION TEST REQUIRED: Submit HTTP checkout with revoked agent principal or amount > `confirmation_above` and assert HTTP 403 / 202 confirmation response.

---

### FINDING-005
ID: FINDING-005  
SEVERITY: HIGH  
TITLE: Supervisor Authentication Omission and Revocation Race in Human Confirmation Endpoint (/v1/confirm)  
LOCATION: `src/gateway/router.ts:1251-1344`  
OBSERVATION: Route `POST /v1/confirm` is unauthenticated (lacks `preHandler: [requireScope('merchant:policy:write')]`). Any client that acquires or guesses the 32-character hex `confirmation_token` can approve a high-value purchase. Furthermore, `/v1/confirm` re-executes `holdReservation` and `createOrder` without checking if the buyer mandate was revoked in `revoked_mandates` or expired during the confirmation window.  
ATTACK / REPRODUCTION:  
1. High-value checkout intent is submitted; pending confirmation record is created.  
2. Buyer principal realizes unauthorized activity and revokes mandate via `POST /v1/mandates/revoke`.  
3. Attacker or rogue agent sends `POST /v1/confirm` with `confirmation_token`.  
4. Endpoint updates `pending_confirmations` to `APPROVED` without querying `revoked_mandates`.  
5. `holdReservation()` succeeds and Razorpay order is created, executing the financial transaction despite mandate revocation.  
EXPECTED: `POST /v1/confirm` must require supervisory authentication with role-based scope (`merchant:policy:write`). Before executing reservation and payment, it must re-verify that the mandate is not revoked, has not expired, and that the agent principal remains active.  
ACTUAL: Any network actor can confirm high-value orders without credentials, and confirmed orders completely bypass mandate revocation checks committed after intent creation.  
IMPACT: HIGH. Revoked buyer mandates can be financially executed post-revocation, and unauthenticated users can approve pending high-value transactions.  
EVIDENCE: `src/gateway/router.ts:1251-1287`: No scope `preHandler`, no query against `revoked_mandates`, and no check on `intent.mandate.expiry`.  
RECOMMENDATION: Add authentication `preHandler` to `/v1/confirm` and insert Phase 2a mandate revocation check (`SELECT * FROM revoked_mandates WHERE mandate_id = ?`) and temporal expiry check before holding the reservation.  
REGRESSION TEST REQUIRED: Create pending confirmation, revoke mandate, attempt `POST /v1/confirm`, and verify HTTP 403 `MANDATE_REVOKED`.

---

### FINDING-006
ID: FINDING-006  
SEVERITY: HIGH  
TITLE: Webhook Processing Runtime Bypass of Payment State Machine and Delayed Fulfillment Dispatch on Released/Failed Sessions  
LOCATION: `src/rails/webhook.ts:106-130` and `src/gateway/router.ts:19`  
OBSERVATION: `FinancialStateMachine` is defined in `src/core/state_machine.ts` and imported in `src/gateway/router.ts:19`, but `FinancialStateMachine.validateTransition()` is never invoked in `router.ts` or `webhook.ts` before mutating `order_sessions.status`. When an order receives a `payment.failed` event, the processor releases the reservation (restoring budget and stock). If a delayed or out-of-order `payment.captured` event arrives afterwards with a new event ID, the processor executes raw SQL `UPDATE order_sessions SET status = 'PAYMENT_CAPTURED'` and immediately invokes `triggerFulfillment()`, even though the reservation is `RELEASED` and stock has returned to the shelf.  
ATTACK / REPRODUCTION:  
1. Complete a checkout for `SKU-MOUSE-PRO` (reservation `HELD`).  
2. Dispatch a `payment.failed` webhook with event ID `evt_fail_01`. Database updates session to `PAYMENT_FAILED` and sets reservation to `RELEASED`.  
3. Dispatch a delayed `payment.captured` webhook with event ID `evt_late_cap_02`.  
4. Database accepts the webhook (HTTP 200 PROCESSED), sets session status to `PAYMENT_CAPTURED`, and triggers fulfillment dispatch, while the underlying reservation remains in `RELEASED` status.  
EXPECTED: Webhook processing must enforce monotonic transitions via `FinancialStateMachine.validateTransition` and reject transitions from terminal states (`PAYMENT_FAILED`, `REFUNDED`, `CANCELLED`). Fulfillment dispatch must abort if `commitReservation` fails.  
ACTUAL: Runtime accepts `payment.captured` after `payment.failed`, transitions session to `PAYMENT_CAPTURED`, and dispatches fulfillment without holding an active inventory reservation.  
IMPACT: HIGH. Phantom order fulfillment, physical dispatch of unbacked inventory, and financial/physical ledger divergence.  
EVIDENCE: Empirical chaos test CHAOS-07 confirmed reservation status remained `RELEASED` while `order_sessions` transitioned to `PAYMENT_CAPTURED`.  
RECOMMENDATION: Validate state transition using `FinancialStateMachine.validateTransition(orderSession.status, 'PAYMENT_CAPTURED')`. Reject illegal transitions with error. Require `reservationEngine.commitReservation` to return true before calling `triggerFulfillment`.  
REGRESSION TEST REQUIRED: Send `payment.captured` webhook for an order with status `PAYMENT_FAILED`; assert transition is rejected and fulfillment is blocked.

---

### FINDING-007
ID: FINDING-007  
SEVERITY: HIGH  
TITLE: HMAC Verification Computed over Re-Serialized JSON String Instead of Raw Request Byte Buffer  
LOCATION: `src/gateway/router.ts:1169` and `src/rails/webhook.ts:44-56`  
OBSERVATION: `router.ts:1169` executes `const rawBody = JSON.stringify(request.body);` and passes `rawBody` to `webhookProcessor.verifySignature`. Fastify parses incoming JSON streams into JavaScript objects prior to route handler invocation. Re-serializing via `JSON.stringify()` does not preserve original wire whitespace, newline characters, or object key ordering transmitted by Razorpay servers.  
ATTACK / REPRODUCTION:  
1. Send a legitimate Razorpay webhook where JSON body contains indentation, extra whitespace, or specific key order.  
2. HMAC computed by ACG over `JSON.stringify(request.body)` differs from the HMAC SHA-256 signature generated by Razorpay over wire bytes.  
3. ACG rejects valid webhook with HTTP 401 `INVALID_WEBHOOK_SIGNATURE`.  
EXPECTED: Webhook signature verification must be computed directly against the unparsed raw incoming byte `Buffer` received from the TCP socket.  
ACTUAL: Verification operates on re-serialized JSON string derived from parsed object.  
IMPACT: HIGH. Production integration failure: Valid payment notifications from Razorpay will fail signature verification and be dropped, leaving merchant orders uncaptured and inventory stuck in `HELD` status.  
EVIDENCE: Source inspection of `src/gateway/router.ts:1169`: `const rawBody = JSON.stringify(request.body);`.  
RECOMMENDATION: Configure Fastify to capture and attach the raw byte buffer using `fastify-raw-body` or a custom `preParsing` hook, passing `request.rawBody` Buffer directly to `crypto.createHmac()`.  
REGRESSION TEST REQUIRED: Verify webhook signature validation succeeds when incoming payload includes non-standard JSON formatting (extra spaces, newlines, rearranged keys).

---

### FINDING-008
ID: FINDING-008  
SEVERITY: HIGH  
TITLE: Static Plaintext Administrative Bearer Tokens Embedded in Source Code  
LOCATION: `src/gateway/auth.ts:5-9`  
OBSERVATION: Static administrative bearer tokens are hardcoded in source code:  
```typescript
const VALID_TOKENS: Record<string, AuthPrincipal> = {
  secret_merchant_admin: { id: "admin-1", role: "merchant_admin", scopes: [...] },
  secret_merchant_viewer: { id: "viewer-1", role: "merchant_viewer", scopes: [...] },
  secret_audit_bot: { id: "auditor-1", role: "auditor", scopes: [...] },
};
```
ATTACK / REPRODUCTION:  
1. Attacker reads `src/gateway/auth.ts` from repository or decompiled container image.  
2. Attacker issues HTTP request with header `Authorization: Bearer secret_merchant_admin` to privileged routes (`PUT /v1/merchant/policy`, `POST /v1/mandates/revoke`, `GET /v1/audit/ledger`).  
3. Router grants full administrative privileges.  
EXPECTED: Administrative credentials must be loaded from secure environment variables or verified via asymmetric signed JWTs with strict expiration.  
ACTUAL: Permanent, hardcoded plaintext bearer tokens provide full control-plane access.  
IMPACT: HIGH. Total control-plane compromise: Anyone with source or image access can alter merchant spending policies, revoke mandates, and tamper with control settings.  
EVIDENCE: Source code in `src/gateway/auth.ts:5-9`.  
RECOMMENDATION: Migrate authentication to environment-configured API keys (`process.env.ACG_ADMIN_TOKEN`) or asymmetric JWTs. Ensure fallback tokens are rejected in non-test environments.  
REGRESSION TEST REQUIRED: Assert that default tokens like `secret_merchant_admin` are strictly rejected when `NODE_ENV === "production"`.

---

### FINDING-009
ID: FINDING-009  
SEVERITY: MEDIUM  
TITLE: Multi-Agent Delegation Engine Fails to Validate Child Agent Status, Permitting Revoked Agents to Transact  
LOCATION: `src/core/delegation.ts:42-58, 124-133`  
OBSERVATION: In `MultiAgentDelegationEngine`, `createDelegation()` checks `parentAgentId` against `principalRegistry`, but does not verify whether `childAgentId` exists or is active. Similarly, `validateDelegation()` verifies that the delegating parent agent is `ACTIVE` (lines 125-132), but completely omits checking the child agent's status (`principalRegistry.getPrincipal(row.child_agent_id)`).  
ATTACK / REPRODUCTION:  
1. Parent agent `agent_parent_alpha` delegates ₹20,000 authority to child agent `agent_compromised`.  
2. Admin discovers `agent_compromised` is rogue and revokes its credentials via `principalRegistry.setAgentStatus('agent_compromised', 'REVOKED')`.  
3. `agent_compromised` calls `validateDelegation()` with delegation grant ID.  
4. `validateDelegation()` verifies parent is `ACTIVE`, checks amount and merchant scope, and returns `{ valid: true, delegation }`.  
5. Revoked child agent successfully validates and exercises delegated financial authority.  
EXPECTED: `validateDelegation()` must verify that both the delegating parent AND delegatee child agent are `ACTIVE` and not revoked or suspended.  
ACTUAL: Revoked, suspended, or deleted child agents can continue exercising delegated authority as long as parent remains active.  
IMPACT: MEDIUM. Undermines agent credential revocation; compromised subagents cannot be isolated without revoking the entire parent agent tree.  
EVIDENCE: `src/core/delegation.ts:125-132` inspects `this.principalRegistry.getPrincipal(row.parent_agent_id)` but contains no check for `row.child_agent_id`.  
RECOMMENDATION: In `validateDelegation()`, add:  
```typescript
const child = this.principalRegistry.getPrincipal(childAgentId);
if (!child || child.status !== "ACTIVE") {
  return { valid: false, code: "CHILD_AGENT_INACTIVE", reason: "Child agent is inactive or revoked" };
}
```
REGRESSION TEST REQUIRED: Revoke child agent principal and assert `validateDelegation` returns `valid: false` with code `CHILD_AGENT_INACTIVE`.

---

### FINDING-010
ID: FINDING-010  
SEVERITY: MEDIUM  
TITLE: Client Nonce Deduplication Omission Permitting Cross-Intent Automated Replay Attacks  
LOCATION: `src/gateway/router.ts:706-712`  
OBSERVATION: Replay protection in `POST /v1/agent/checkout` only checks `order_sessions` for duplicate `intent_id`. The `client_nonce` parameter, while validated by Zod schema (min 16 characters) and recorded in audit logs, is not indexed or checked in a deduplication table. An adversary can replay identical transactions by preserving `client_nonce` and rotating `intent_id` (UUID).  
ATTACK / REPRODUCTION:  
1. Submit checkout request with `intent_id_1` and `client_nonce` `"nonce_abc_1234567890"`. Order succeeds.  
2. Submit identical checkout request with `intent_id_2` (new UUID) and the same `client_nonce`.  
3. Router queries `order_sessions` for `intent_id_2`, finds no collision, and proceeds to create a second order.  
EXPECTED: Client nonces should be bound to the mandate and tracked in a deduplication table with a sliding TTL window (e.g. 24 hours) to reject replayed payloads even if intent ID is mutated.  
ACTUAL: Replay protection is strictly keyed to `intent_id`, allowing adversaries to cycle intent IDs while reusing nonces.  
IMPACT: MEDIUM. Weakened idempotency guarantees against automated replay attacks when clients experience network timeouts or retransmissions.  
EVIDENCE: `src/gateway/router.ts:706`: `SELECT intent_id FROM order_sessions WHERE intent_id = ?`. No table exists for client nonces.  
RECOMMENDATION: Create a `client_nonces` table (`nonce TEXT PRIMARY KEY, mandate_id TEXT, created_at INTEGER`) and reject incoming intents if `(client_nonce, mandate_id)` has been seen within the validity window.  
REGRESSION TEST REQUIRED: Submit two distinct `intent_id`s with identical `client_nonce` within TTL and verify second is rejected.

---

### FINDING-011
ID: FINDING-011  
SEVERITY: MEDIUM  
TITLE: Malformed Payment Rail Response Handling Accepts Null Order ID Corrupting Session Reconciliation  
LOCATION: `src/gateway/router.ts:867-882` and `src/store/db.ts:82`  
OBSERVATION: In `router.ts:856`, the gateway invokes `railClient.createOrder()`. If the payment rail returns a malformed response where `id` is null or undefined, the router does not validate that `razorpayOrder.id` is a non-empty string. It executes `INSERT INTO order_sessions (...) VALUES (?, ?, ?, ...)` with `razorpay_order_id = null`. In `src/store/db.ts:82`, `razorpay_order_id` has a `UNIQUE` constraint but lacks `NOT NULL`. The gateway returns HTTP 201 Created with `razorpay_order_id: null`.  
ATTACK / REPRODUCTION:  
1. Mock or intercept `railClient.createOrder` to return `{ id: null, entity: "order", amount: 350000, status: "created" }`.  
2. Submit a valid checkout request to `POST /v1/agent/checkout`.  
3. Gateway commits order session to database with `razorpay_order_id = null` and returns HTTP 201 Created.  
4. Subsequent webhooks from Razorpay cannot be matched to the session.  
EXPECTED: Fail-closed. Gateway must validate that provider response contains a non-empty string identifier. If missing, it must roll back reservations, log `RAIL_RESPONSE_MALFORMED`, and return HTTP 502 `PAYMENT_RAIL_ERROR`.  
ACTUAL: Gateway accepts malformed response with null order ID, retains dual reservations, and returns HTTP 201 Created.  
IMPACT: MEDIUM. Ghost orders, unreconcilable database state, and failure of subsequent webhook matching.  
EVIDENCE: Empirical chaos test CHAOS-08 confirmed status 201 returned with `razorpay_order_id` recorded as null.  
RECOMMENDATION: Add assertion in `router.ts:867`: `if (!razorpayOrder?.id || typeof razorpayOrder.id !== "string") throw new Error("Payment rail returned malformed response: missing order ID");`. Alter schema in `db.ts`: `razorpay_order_id TEXT UNIQUE NOT NULL`.  
REGRESSION TEST REQUIRED: Mock `railClient` to return null ID, assert HTTP 502 response, and assert reservation is `RELEASED`.

---

### FINDING-012
ID: FINDING-012  
SEVERITY: MEDIUM  
TITLE: Hardcoded Latency and Telemetry Metrics in Gateway Dashboard and Health API Routes  
LOCATION: `src/gateway/router.ts:177-178, 266, 270, 273`  
OBSERVATION: Endpoints `/dashboard/metrics` and `/dashboard/health` return static literal values for several performance and status indicators: `measured_cold_run_ms: 286.3`, `is_sandbox_connected: true`, `latency_ms: 12`, `mode: "Sandbox"`, and `payment_intelligence.model: "vulcan-v1.4-live-transformer"`. While GMV and intent counters are dynamically queried from SQLite, latency metrics are completely static.  
ATTACK / REPRODUCTION:  
1. Send queries to `GET /dashboard/metrics` and `GET /dashboard/health`.  
2. Latency is always reported as exactly 286.3 ms and 12 ms, regardless of actual execution duration or system load.  
EXPECTED: Operational dashboards must display real-time measured latencies computed from recent execution traces (e.g. rolling p50/p95 from `decision_traces`).  
ACTUAL: Hardcoded static literals are presented as live telemetry.  
IMPACT: MEDIUM. Misleading operational observability: Operators cannot detect latency degradation or disconnection from health endpoints.  
EVIDENCE: Source code in `src/gateway/router.ts:177, 178, 266, 270, 273`.  
RECOMMENDATION: Compute rolling latency metrics from the `decision_traces` SQLite table and actively probe Razorpay sandbox connectivity.  
REGRESSION TEST REQUIRED: Assert that `/dashboard/metrics` measured latency fluctuates based on actual execution durations.

---

### FINDING-013
ID: FINDING-013  
SEVERITY: LOW  
TITLE: Ed25519 Canonical Serialization Ambiguity on Optional Arrays and Missing Domain Separation  
LOCATION: `src/core/crypto.ts:7-18`  
OBSERVATION: In `getCanonicalMandateBytes()`, `merchant_whitelist` and `category_whitelist` are mapped to `undefined` when absent, causing `JSON.stringify()` to omit those keys entirely from the canonical string. If an external client library encodes empty arrays `[]` or `null`, `JSON.stringify` outputs `"merchant_whitelist":[]` or `"merchant_whitelist":null`, resulting in signature verification failure. Furthermore, canonical mandate bytes do not include a domain separation prefix.  
ATTACK / REPRODUCTION:  
1. Client library signs mandate JSON with `merchant_whitelist: []`.  
2. ACG verifier receives mandate, normalizes to `undefined` if omitted, or keeps `[]` if empty.  
3. Subtleties between `undefined`, `null`, and empty array representations across different programming languages cause cross-platform verification failures.  
EXPECTED: Strict RFC 8785 (JSON Canonicalization Scheme - JCS) or explicit strict canonical schema should be enforced with a domain separation prefix (e.g. `"ACG-BUYER-MANDATE-V1:"`).  
ACTUAL: Relying on standard V8 `JSON.stringify()` with ternary `undefined` mapping creates potential cross-language serialization discrepancies.  
IMPACT: LOW. Cross-platform client signing fragility and lack of cryptographic domain separation.  
EVIDENCE: `src/core/crypto.ts:13-14`: `merchant_whitelist: mandate.merchant_whitelist ? [...mandate.merchant_whitelist].sort() : undefined`.  
RECOMMENDATION: Adopt a formal JCS canonicalizer (`fast-json-stable-stringify`) and prepend a domain separation header prior to Ed25519 hashing/verification.  
REGRESSION TEST REQUIRED: Test canonical equivalence across omitted, empty, and sorted array representations.

---

### FINDING-014
ID: FINDING-014  
SEVERITY: LOW  
TITLE: Auto-Generated Event ID on Missing Header Bypasses Webhook Deduplication  
LOCATION: `src/gateway/router.ts:1171`  
OBSERVATION: If an incoming webhook omits the `x-razorpay-event-id` header, line 1171 defaults `eventId` to `event_${Date.now()}`.  
ATTACK / REPRODUCTION:  
1. Attacker submits the same webhook payload repeatedly without the `x-razorpay-event-id` header.  
2. Each submission receives a new `eventId` timestamp, completely bypassing `processed_webhook_events` deduplication.  
EXPECTED: Missing `x-razorpay-event-id` should either reject with HTTP 400 Bad Request or derive a deterministic `eventId` from `sha256(rawBody)`.  
ACTUAL: Non-deterministic event ID generation on missing header allows replay.  
IMPACT: LOW. Missing header allows identical payloads to be processed repeatedly if signature check is satisfied.  
EVIDENCE: `src/gateway/router.ts:1171`: `const eventId = (request.headers["x-razorpay-event-id"] as string) || \`event_\${Date.now()}\`;`.  
RECOMMENDATION: Require `x-razorpay-event-id` header or derive `eventId` deterministically via `sha256(rawBody)`.  
REGRESSION TEST REQUIRED: Assert that webhook POST without `x-razorpay-event-id` is rejected or deduplicated deterministically.

---

### FINDING-015
ID: FINDING-015  
SEVERITY: LOW  
TITLE: Continuous Integration Workflow Omits Explicit Least-Privilege Permissions Block  
LOCATION: `.github/workflows/ci.yml:1-41`  
OBSERVATION: In `.github/workflows/ci.yml`, the workflow defines the `verify` job running build, test, pentest, audit, and benchmark steps. However, it completely omits a top-level or job-level `permissions:` directive. By default in GitHub Actions, workflows without explicit permissions inherit repository-default write permissions for `GITHUB_TOKEN`, creating supply chain escalation risks if dependencies or build scripts are compromised.  
ATTACK / REPRODUCTION:  
1. Inspect `.github/workflows/ci.yml` lines 9-14: Job `verify` specifies `runs-on: ubuntu-latest` and proceeds directly to `steps:` without declaring permissions.  
EXPECTED: Workflows must adhere to OpenSSF / SLSA least privilege standards by declaring top-level: `permissions: contents: read`.  
ACTUAL: Permissions directive is omitted, relying on implicit GitHub repository defaults.  
IMPACT: LOW. Security posture weakness and violation of GitHub Actions supply chain best practices.  
EVIDENCE: Source review of `.github/workflows/ci.yml:1-15`.  
RECOMMENDATION: Add explicit top-level permissions block:  
```yaml
permissions:
  contents: read
```
REGRESSION TEST REQUIRED: Workflow schema validation checking for explicit permissions block in all `.github/workflows/*.yml` files.

---

### FINDING-016
ID: FINDING-016  
SEVERITY: INFORMATIONAL  
TITLE: Single-Process SQLite Locking Model Requires Distributed Synchronization for Multi-Node Scaling  
LOCATION: `src/core/reservation.ts:72` and `src/store/db.ts:15-18`  
OBSERVATION: The dual-resource reservation engine relies on SQLite's `BEGIN IMMEDIATE TRANSACTION;` via `node:sqlite DatabaseSync`. While this provides serialized ACID isolation within a single Node.js operating system process, SQLite file-locking does not provide distributed concurrency guarantees across multiple container replicas or horizontally scaled gateway nodes.  
ATTACK / REPRODUCTION:  
1. Deploy two ACG gateway instances behind an HTTP round-robin load balancer pointing to a shared NFS SQLite database file.  
2. Execute concurrent checkout requests across both instances; file lock contention can lead to `SQLITE_BUSY` or inconsistent isolation behavior.  
EXPECTED: Horizontal scaling requires migrating the dual-resource reservation transaction to PostgreSQL (using `SELECT ... FOR UPDATE`) or implementing distributed locking via Redis Redlock as outlined in the enterprise architectural roadmap.  
ACTUAL: System is currently bounded to single-node deployments for ACID dual-resource guarantees.  
IMPACT: INFORMATIONAL. Architectural scaling constraint; single-node operation is strictly safe, but multi-node scaling requires distributed coordination.  
EVIDENCE: `src/core/reservation.ts:72` executes `db.exec("BEGIN IMMEDIATE TRANSACTION;");` against local `node:sqlite` instance.  
RECOMMENDATION: Implement PostgreSQL adapter using the schema in `src/store/postgres_schema.sql` for production clustered deployments.  
REGRESSION TEST REQUIRED: Document single-node constraint in deployment topology guidelines.

---

### FINDING-017
ID: FINDING-017  
SEVERITY: INFORMATIONAL  
TITLE: Audit Ledger Cryptographic Forward-Chain Integrity Verified (Tamper-Evident SHA-256 Chain Across 307 Blocks)  
LOCATION: `src/store/audit.ts:23-55, 69-111` and `scripts/verify_audit.ts`  
OBSERVATION: Audit records are forward-chained via SHA-256: `sha256(auditId|intentId|timestamp|eventType|prevState|newState|detailsJson|prevHash)`. `verifyLedgerIntegrity()` validates 307 blocks across `./data/acg_gateway.db` (183), `./data/demo_simulation.db` (28), and `./data/live_pentest.db` (96). Any post-hoc mutation of details, event type, or hashes is immediately detected.  
ATTACK / REPRODUCTION:  
1. Modify any row in `audit_ledger` (e.g. `UPDATE audit_ledger SET details_json = '{"tampered":true}' WHERE rowid = 2`).  
2. Running `npm run audit:verify` immediately terminates with `Tampered hash at block <audit_id>`.  
EXPECTED: Immediate detection of any post-hoc state mutation.  
ACTUAL: Verified tamper-evidence across all 307 historical ledger blocks.  
IMPACT: INFORMATIONAL. Cryptographic assurance: ACG's audit chain is demonstrably tamper-evident within the storage layer.  
EVIDENCE: Verification output from `scripts/verify_audit.ts` and pentest runner test AUDIT-02.  
RECOMMENDATION: Retain term "TAMPER-EVIDENT SHA-256 HASH CHAIN". Avoid claiming "tamper-proof" or legal immutability since local filesystem administrator could recalculate forward hashes.  
REGRESSION TEST REQUIRED: `npm run audit:verify`.

---

### FINDING-018
ID: FINDING-018  
SEVERITY: INFORMATIONAL  
TITLE: Performance Benchmark Baseline (303.81 ms) Evaluates Framework Cold-Boot with In-Memory Mock Rather than Live End-to-End Latency  
LOCATION: `src/demo/benchmark.ts:1-94` and `AGENTS.md:23`  
OBSERVATION: The canonical repository benchmark metric (303.81 ms baseline; empirically reproduced at 302.61 ms, 301.98 ms, and 282.96 ms) measures a single cold-start iteration using Fastify in-memory injection (`app.inject`), an in-memory SQLite database (`:memory:`), and an offline deterministic mock Razorpay order generator (`isLiveCredentials == false`). Framework boot and plugin initialization account for ~250 ms (~83%) of the duration, while the actual checkout transaction takes 41 - 47 ms cold and 3 - 10 ms warm. Crucially, it does not include OS TCP/TLS network stack overhead or external HTTP roundtrips to Razorpay sandbox endpoints (which typically add 200 - 500 ms).  
ATTACK / REPRODUCTION:  
1. Run `npm run benchmark`. Milestones printed: 1. Gateway Boot & Policy Engine: 255.17 ms; 2. Catalog Ingestion: 0.61 ms; 3. Ed25519 Mandate Sign: 3.57 ms; 4. 6-Phase Agent Checkout: 43.25 ms; Total: 302.61 ms.  
EXPECTED: Performance documentation should explicitly distinguish framework cold-start boot latency from warm transaction processing latency, and state that external bank rail network latency is excluded.  
ACTUAL: Documentation presents 303.81 ms as a single monolithic metric without qualifying that 83% of the time is Node.js/Fastify cold-start initialization.  
IMPACT: INFORMATIONAL. Potential misinterpretation of architectural throughput and latency characteristics.  
EVIDENCE: Source review of `src/demo/benchmark.ts` lines 17, 28, 64 and empirical benchmark stdout.  
RECOMMENDATION: Publish separate metrics: (1) Cold-Start Initialization: ~250 ms, (2) Core Authorization Engine Latency (p50: ~4 ms, p95: ~8 ms, p99: ~15 ms), and (3) Projected Live Network Transaction Latency (~300 - 550 ms).  
REGRESSION TEST REQUIRED: Documentation clarification.

---

### FINDING-019
ID: FINDING-019  
SEVERITY: INFORMATIONAL  
TITLE: Documentation Metric Drift: Documented 77/77 Test Count Superseded by 102/102 Active Passing Tests  
LOCATION: `AGENTS.md:24`, `README.md`, `docs/RELEASE_NOTES.md`  
OBSERVATION: Repository documentation, including `AGENTS.md` and `README.md`, documents "Automated Tests: 77 / 77 Passing". Active execution of `npm test` executes 102 tests across 12 test files with 100% pass rate in ~3.70s. The test suite expanded by 25 tests due to the introduction of V2 control plane, V3 security infra, and V4 universal plane test suites in `src/core/__tests__/`.  
ATTACK / REPRODUCTION:  
1. Run `npm test`. Vitest reports: "Test Files: 12 passed (12), Tests: 102 passed (102)". Compare with `AGENTS.md` line 24.  
EXPECTED: Documentation claims should accurately reflect current test suite counts.  
ACTUAL: Documentation cites 77 tests; active runner executes 102 tests.  
IMPACT: INFORMATIONAL. Documentation discrepancy.  
EVIDENCE: `vitest` output: 102 passed (102).  
RECOMMENDATION: Update `AGENTS.md`, `README.md`, and test matrices to document 102 / 102 passing tests.  
REGRESSION TEST REQUIRED: None.

---

### FINDING-020
ID: FINDING-020  
SEVERITY: INFORMATIONAL  
TITLE: External Tool Attribution: Assessment Utilized Strix-Informed Methodology Without Independent Strix Binary Execution  
LOCATION: `reports/pentest/PENTEST_REPORT.md:60` and `reports/pentest/SECURITY_CONTROL_MATRIX.md:3`  
OBSERVATION: Penetration test reports cite Strix priorities across 14 security invariants. In-depth inspection confirms that no Strix binary, CLI agent, or automated scanning tool was executed against the repository. The pentest suite was implemented and executed entirely through custom TypeScript code in `src/demo/pentest_runner.ts`.  
ATTACK / REPRODUCTION:  
1. Search repository for Strix executable, CLI invocation, or scan artifact outputs. None exist.  
EXPECTED: External tool citations must strictly adhere to Phase 21 labeling: STRIX-INFORMED METHODOLOGY vs INDEPENDENT STRIX SCAN.  
ACTUAL: Footnotes in `PENTEST_REPORT.md` correctly mention methodology-informed assessment, but summary tables and headers must maintain consistent labeling to avoid auditor ambiguity.  
IMPACT: INFORMATIONAL. Transparency and attribution accuracy.  
EVIDENCE: `PENTEST_REPORT.md:60`: "(methodology-driven assessment; external binary agent not independently executed)".  
RECOMMENDATION: Enforce standardized label across all audit documentation: "STRIX-INFORMED METHODOLOGY (Independent external scanner binary was not executed)".  
REGRESSION TEST REQUIRED: None.
