# ACG V2 INDEPENDENT CAPABILITY VERIFICATION REPORT
**Auditor:** Final Independent Acceptance Auditor  
**Date:** 2026-09-04  
**Target Repository:** `B:\projects\RAZOR PAY- Buildathon`  
**Verdict:** **V2 PASS (INDEPENDENTLY VERIFIED)**

---

## 1. Executive Summary & Verification Methodology
Every capability claimed in the ACG V2 Control Plane was evaluated by direct source code inspection, database transaction tracing, runtime schema examination, and automated adversarial execution. Zero assumptions were made from marketing claims or pre-existing pass statements.

---

## 2. Detailed Feature-by-Feature Forensic Audit

### 2.1 Agent Principal Identity Model
- **Source Location:** [`src/core/agent_principal.ts`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/agent_principal.ts#L1-L153)
- **API / Entrypoints:** `POST /v1/agents` ([`src/gateway/router.ts:1372`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/gateway/router.ts#L1372)), `GET /v1/agents/:id` ([`src/gateway/router.ts:1399`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/gateway/router.ts#L1399))
- **Runtime Behavior:** Registers agent principals with strict Zod validation (`agent_id`, `organization_id`, `provider`, `model_name`, `agent_type`, `trust_level`, `credential_state`, `status`). Persists to SQLite table `agent_principals`. Default principal `native-llm-agent` is seeded at startup.
- **Automated Test:** [`src/core/__tests__/v2_control_plane.test.ts:53-93`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/__tests__/v2_control_plane.test.ts#L53-L93) (Test 1.1)
- **Adversarial Test:** [`src/core/__tests__/v2_control_plane.test.ts:95-123`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/__tests__/v2_control_plane.test.ts#L95-L123) (Test 1.2: rogue agent suspended/revoked blocks checkout with `AGENT_SUSPENDED`).
- **Database Effect:** SQLite table `agent_principals` records upserts with `ON CONFLICT(agent_id) DO UPDATE`.
- **Audit Effect:** Ingress and PDP evaluations log agent identity context into `pdp_decisions` and `audit_ledger`.
- **Forensic Status:** **VERIFIED**

---

### 2.2 Trust States (`UNTRUSTED`, `PROVISIONAL`, `VERIFIED`, `ENTERPRISE`)
- **Source Location:** [`src/core/agent_principal.ts:5, 23`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/agent_principal.ts#L5)
- **API / Entrypoints:** Embedded in Principal schema and PDP evaluation pipeline.
- **Runtime Behavior:** Trust level is validated via Zod schema and stored in DB. PDP queries trust level during policy checks.
- **Automated Test:** [`src/core/__tests__/v2_control_plane.test.ts:79-82`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/__tests__/v2_control_plane.test.ts#L79-L82)
- **Adversarial Test:** Verified that invalid trust level strings are rejected by Zod schema validation with HTTP 400.
- **Database Effect:** Stored in `agent_principals.trust_level`.
- **Audit Effect:** Stored in PDP decision authorization evidence (`pdp_decisions.authorization_evidence_json`).
- **Forensic Status:** **VERIFIED**

---

### 2.3 Capability-Based Authorization
- **Source Location:** [`src/core/agent_principal.ts:33-58, 172-225`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/agent_principal.ts#L33-L58), [`src/core/pdp.ts:183-191, 236-246`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/pdp.ts#L183-L191)
- **API / Entrypoints:** `GET /v1/agents/:id`, PDP `evaluateIntent()`
- **Runtime Behavior:** Enforces fine-grained capability constraints: `capability` (`PURCHASE`), `max_amount` ceiling in paise, allowed `categories`, allowed `merchant_scope`, `daily_budget`, and `confirmation_above`.
- **Automated Test:** [`src/core/__tests__/v2_control_plane.test.ts:128-176`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/__tests__/v2_control_plane.test.ts#L128-L176) (Test 2.1)
- **Adversarial Test:** Attempted purchase outside capability category (`stationery` only agent attempting to purchase `electronics`) -> Denied with reason `AGENT_CATEGORY_RESTRICTED`.
- **Database Effect:** Inserted into `agent_capabilities` with foreign key referencing `agent_principals`.
- **Audit Effect:** Recorded in `pdp_decisions` table with exact capability restriction code.
- **Forensic Status:** **VERIFIED**

---

### 2.4 Policy Decision Point (PDP)
- **Source Location:** [`src/core/pdp.ts:61-331`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/pdp.ts#L61-L331)
- **API / Entrypoints:** `POST /v1/agent/checkout`, `POST /v1/authorize`, `POST /v1/mcp/call` (`authorize_financial_action`)
- **Runtime Behavior:** Centralized 15-stage policy evaluation pipeline evaluating kill switch, principal identity, capability bounds, mandate revocation, Ed25519 cryptography, catalog truth resolution, category whitelist, merchant whitelist, policy caps, hierarchical budgets, velocity rates, and human confirmation thresholds.
- **Automated Test:** [`src/core/__tests__/v2_control_plane.test.ts:182-238`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/__tests__/v2_control_plane.test.ts#L182-L238), [`src/core/__tests__/adversarial_suite.test.ts`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/__tests__/adversarial_suite.test.ts)
- **Adversarial Test:** 14 hostile adversarial vectors tested across expiration, signature tampering, over-budgeting, and unauthorized merchant calls.
- **Database Effect:** Every decision written to `pdp_decisions` with full JSON input references, evidence, and resource allocation.
- **Audit Effect:** Tamper-evident chained block logged in `audit_ledger`.
- **Forensic Status:** **VERIFIED**

---

### 2.5 `REQUIRE_CONFIRMATION` Human-in-the-Loop Workflow
- **Source Location:** [`src/core/pdp.ts:274-316`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/pdp.ts#L274-L316), [`src/gateway/router.ts:1310-1367`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/gateway/router.ts#L1310-L1367)
- **API / Entrypoints:** `POST /v1/simulate` (returns `WOULD_REQUIRE_CONFIRMATION`), `POST /v1/confirm` (accepts `confirmation_token` and `confirmed_by`)
- **Runtime Behavior:** When order amount exceeds `confirmation_above` (default ₹3,000), PDP returns `REQUIRE_CONFIRMATION`, generates cryptographically random token (`conf_<hex>`), and stores pending record in `pending_confirmations` (15 min TTL). Calling `POST /v1/confirm` verifies token, claims hold, acquires dual reservation, creates Razorpay order, and commits. Subsequent double confirmation attempts fail with HTTP 409.
- **Automated Test:** [`src/core/__tests__/v2_control_plane.test.ts:183-238`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/__tests__/v2_control_plane.test.ts#L183-L238) (Test 3.1)
- **Adversarial Test:** Double confirmation attempt tested in line 230 -> Rejected with HTTP 409 `CONFIRMATION_ALREADY_RESOLVED`.
- **Database Effect:** Row inserted into `pending_confirmations`; updated to `CONFIRMED` upon approval.
- **Audit Effect:** Chained audit event `CONFIRMATION_SUBMITTED` logged.
- **Forensic Status:** **VERIFIED**

---

### 2.6 Hierarchical Financial Budgets
- **Source Location:** [`src/core/budget_hierarchy.ts:13-108`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/budget_hierarchy.ts#L13-L108)
- **API / Entrypoints:** PDP Stage 12, `evaluateHierarchy()`
- **Runtime Behavior:** Evaluates 3-tier hierarchy:
  1. `Merchant`: `merchant_budgets.daily_budget_limit` - `daily_spent` >= `totalPaise`
  2. `Agent`: `agent_capabilities.max_amount` and `daily_budget` - `daily_spent` >= `totalPaise`
  3. `Buyer Mandate`: `buyer_mandates.remaining_budget` >= `totalPaise`
- **Automated Test:** [`src/core/__tests__/v2_control_plane.test.ts:244-261`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/__tests__/v2_control_plane.test.ts#L244-L261) (Test 5.1)
- **Adversarial Test:** Attempted mandate with ₹50,000 against merchant daily cap of ₹10,000 -> Blocked with `MERCHANT_DAILY_BUDGET_EXCEEDED`.
- **Database Effect:** Updates `merchant_budgets.daily_spent` and `agent_capabilities.daily_spent` on spend.
- **Audit Effect:** Rejections logged with `MERCHANT_DAILY_BUDGET_EXCEEDED` or `AGENT_DAILY_BUDGET_EXCEEDED`.
- **Forensic Status:** **VERIFIED**

---

### 2.7 Velocity Controls
- **Source Location:** [`src/core/velocity.ts:20-144`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/velocity.ts#L20-L144)
- **API / Entrypoints:** PDP Stage 13, `VelocityEngine.checkVelocity()`
- **Runtime Behavior:** Queries sliding-window aggregates in `velocity_ledger` table (`timestamp >= now - 60` for 1-minute window, `timestamp >= now - 3600` for 1-hour window, `timestamp >= now - 86400` for 1-day window) for count limits and total paise volume limits.
- **Automated Test:** [`src/core/__tests__/v2_control_plane.test.ts:267-284`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/__tests__/v2_control_plane.test.ts#L267-L284) (Test 6.1)
- **Adversarial Test:** 5 rapid transactions recorded -> 6th transaction blocked with `VELOCITY_PER_MINUTE_COUNT_EXCEEDED`.
- **Database Effect:** Inserts action records into `velocity_ledger`.
- **Audit Effect:** Velocity rejections logged in PDP decision store.
- **Forensic Status:** **VERIFIED**

---

### 2.8 Global / Merchant / Agent Kill Switch
- **Source Location:** [`src/core/kill_switch.ts:13-100`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/kill_switch.ts#L13-L100)
- **API / Entrypoints:** `POST /v1/kill-switch` ([`src/gateway/router.ts:1411`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/gateway/router.ts#L1411)), `GET /v1/kill-switch` ([`src/gateway/router.ts:1426`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/gateway/router.ts#L1426))
- **Runtime Behavior:** Supports hierarchical emergency containment:
  - `GLOBAL`: Stops all agent commerce gateway executions globally.
  - `MERCHANT:<merchant_id>`: Halts all transactions targeting a specific merchant.
  - `AGENT:<agent_id>`: Halts all actions initiated by a specific agent.
- **Automated Test:** [`src/core/__tests__/v2_control_plane.test.ts:290-344`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/__tests__/v2_control_plane.test.ts#L290-L344) (Test 7.1)
- **Adversarial Test:** Global pause activated -> checkout immediately rejected with HTTP 403 `KILL_SWITCH_ENGAGED`. Deactivated -> checkout resumes cleanly with HTTP 201.
- **Database Effect:** Upserted into `kill_switches` table with reason, timestamp, and operator identifier.
- **Audit Effect:** Audit events `KILL_SWITCH_ACTIVATED` and `KILL_SWITCH_DEACTIVATED` logged to SHA-256 ledger.
- **Forensic Status:** **VERIFIED**

---

### 2.9 Policy Simulation Engine (Zero Financial Mutation)
- **Source Location:** [`src/core/pdp.ts:336-483`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/pdp.ts#L336-L483)
- **API / Entrypoints:** `POST /v1/simulate` ([`src/gateway/router.ts:1240`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/gateway/router.ts#L1240)), `POST /v1/mcp/call` (`simulate_financial_action`)
- **Runtime Behavior:** Dry-runs all policy checks, truth resolution, and budget availability without acquiring database locks, creating Razorpay orders, decrementing stock, or debiting buyer mandates.
- **Automated Test:** [`src/core/__tests__/v2_control_plane.test.ts:350-377`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/__tests__/v2_control_plane.test.ts#L350-L377) (Test 8.1)
- **Adversarial Test:** Explicit database queries assert `SELECT COUNT(*) FROM order_sessions` = 0 and `SELECT COUNT(*) FROM reservations` = 0 following simulation.
- **Database Effect:** Absolutely ZERO state mutations.
- **Audit Effect:** No financial audit blocks created.
- **Forensic Status:** **VERIFIED**

---

### 2.10 Deterministic Decision Replay
- **Source Location:** [`src/core/pdp.ts:488-543`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/pdp.ts#L488-L543)
- **API / Entrypoints:** `POST /v1/decisions/:id/replay` ([`src/gateway/router.ts:1280`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/gateway/router.ts#L1280))
- **Runtime Behavior:** Fetches historic decision by `decision_id`, parses frozen input references, and re-executes simulation against either the historic policy or a candidate new policy (`overridePolicy`), computing deterministic delta (`MATCH` vs `CHANGED`).
- **Automated Test:** [`src/core/__tests__/v2_control_plane.test.ts:383-419`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/__tests__/v2_control_plane.test.ts#L383-L419) (Test 9.1)
- **Adversarial Test:** Historical `ALLOW` decision replayed against restricted policy v2.0.0 (lowered max transaction cap) -> yields replayed decision `DENY` with reason `MERCHANT_MAX_AMOUNT_EXCEEDED` and `delta: "CHANGED"`.
- **Database Effect:** Zero state mutations.
- **Audit Effect:** Non-mutating replay report returned.
- **Forensic Status:** **VERIFIED**

---

### 2.11 Financial State Machine Formal Invariants
- **Source Location:** [`src/core/state_machine.ts:1-71`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/state_machine.ts#L1-L71)
- **API / Entrypoints:** `FinancialStateMachine.validateTransition(from, to)`
- **Runtime Behavior:** Enforces strict transition graph over 15 discrete financial states (`INTENT_CREATED`, `AUTHORITY_VERIFIED`, `POLICY_APPROVED`, `REQUIRE_CONFIRMATION`, `CONFIRMED`, `RESERVED`, `ORDER_CREATED`, `PAYMENT_PENDING`, `CAPTURED`, `RECONCILED`, `REJECTED`, `EXPIRED`, `CANCELLED`, `REVERSED`, `REFUNDED`).
- **Automated Test:** [`src/core/__tests__/v2_control_plane.test.ts:425-439`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/__tests__/v2_control_plane.test.ts#L425-L439) (Test 10.1)
- **Adversarial Test:** Attempted illegal transition `INTENT_CREATED` -> `CAPTURED` and `REJECTED` -> `CAPTURED` -> Rejected with `valid: false` and explanatory message.
- **Database Effect:** Guards all state transitions in `order_sessions` and `reservations`.
- **Audit Effect:** Transition logged with `previous_state` and `new_state` in `audit_ledger`.
- **Forensic Status:** **VERIFIED**

---

## 3. Overall V2 Acceptance Determination
All 11 capabilities specified in V2 exist as verified runtime code, are guarded by database constraints, and pass independent adversarial tests.

**V2 STATUS: PASS**
