# MASTER EVIDENCE INDEX
**Document Identifier:** `reports/subagent/SUBAGENT_EVIDENCE_INDEX.md`  
**Evaluation:** ACG Independent Red Team / Architectural Review  
**Phase:** Phase 25 (Required Evidence Index)  
**Date:** 2026-09-04  
**Target Repository:** `B:\projects\RAZOR PAY- Buildathon`  
**Commit Hash:** `23ba7772a3bf69303930af93486970131326fd4c`  
**Integrity Mode:** READ-MOSTLY RED TEAM (Direct Evidence Audit)

---

## 1. Index Architecture & Traceability Protocol

In strict compliance with **Phase 25** of the authoritative evaluation criteria (`ORIGINAL_REQUEST.md`), this evidence index establishes an unbreakable audit trail from repository claims to physical code artifacts and executed commands.

Every repository claim is evaluated against the mandatory 5-element evidence chain:
$$\text{CLAIM} \longrightarrow \text{TEST} \longrightarrow \text{COMMAND} \longrightarrow \text{ARTIFACT} \longrightarrow \text{RESULT}$$

---

## 2. Core Repository Claims Evidence Chains

### 1. Claim: 77 / 77 Automated Tests Passing (Expanded to 102 / 102)
- **CLAIM:** Repository README.md and AGENTS.md document "Automated Tests: 77 / 77 Passing".
- **TEST:** Full automated execution of all unit, integration, adversarial, and authority boundary test suites across 12 test files.
- **COMMAND:** `npm test` (invoking `vitest run`)
- **ARTIFACT:** Vitest execution summary stdout and test source files in `src/core/__tests__/*.test.ts`:
  - `src/core/__tests__/adversarial_suite.test.ts` (14 tests)
  - `src/core/__tests__/security_warfare.test.ts` (13 tests)
  - `src/core/__tests__/protocol_adapters.test.ts` (13 tests)
  - `src/core/__tests__/ui_dashboard_integration.test.ts` (11 tests)
  - `src/core/__tests__/v2_control_plane.test.ts` (10 tests)
  - `src/core/__tests__/typed_api_client.test.ts` (8 tests)
  - `src/core/__tests__/v4_universal_plane.test.ts` (8 tests)
  - `src/core/__tests__/authority_boundary.test.ts` (7 tests)
  - `src/core/__tests__/frontend_auth_integration.test.ts` (7 tests)
  - `src/core/__tests__/v3_security_infra.test.ts` (7 tests)
  - `src/core/__tests__/gateway.test.ts` (3 tests)
  - `src/core/__tests__/hooks.test.ts` (1 test)
- **RESULT:** **TESTED / OBSERVED (SUPERSEDED).** 102 / 102 tests passed across 12 files in 3.70s with 0 failures. The historical claim of 77 tests has been organically superseded by 25 additional tests covering the V2, V3, and V4 control planes.

---

### 2. Claim: 19 / 19 Live Penetration Scenarios Blocked / Passing
- **CLAIM:** Repository documents "Live Penetration Scenarios: 19 / 19 Blocked" in AGENTS.md and README.md.
- **TEST:** Execution of the hostile pentest runner exercising 19 adversarial scenarios (concurrency race conditions, duplicate intent replays, forged webhook HMAC signatures, illegal pre-capture refunds, dynamic policy mutations, mandate revocations, SQL injection, and audit ledger tampering).
- **COMMAND:** `npm run pentest` (invoking `tsx src/demo/pentest_runner.ts`)
- **ARTIFACT:** `reports/pentest/raw_results.json` and execution stdout recording pass/block for CONCUR-01, REPLAY-01, WEBHOOK-01, REFUND-01, POL-01, POL-02, REV-01, REV-02, INPUT-01, INPUT-02, AUDIT-01, AUDIT-02, and adversarial mandate checks.
- **RESULT:** **VERIFIED.** Exactly 19 / 19 hostile scenarios executed; all 19 scenarios passed by successfully intercepting and blocking adversarial payloads or proving detection capability.

---

### 3. Claim: 307 Cryptographically Chained Blocks in Tamper-Evident Audit Ledger
- **CLAIM:** Repository documents "Verified Audit Blocks: 307 Blocks" chained via forward SHA-256 hashes.
- **TEST:** Cryptographic recalculation and verification of every audit block's forward hash chain: `sha256(auditId|intentId|timestamp|eventType|prevState|newState|detailsJson|prevHash)` across all SQLite databases.
- **COMMAND:** `npm run audit:verify` (invoking `tsx scripts/verify_audit.ts`)
- **ARTIFACT:** Three local SQLite databases and verification stdout:
  - `./data/acg_gateway.db`: 183 chained blocks verified
  - `./data/demo_simulation.db`: 28 chained blocks verified
  - `./data/live_pentest.db`: 96 chained blocks verified
- **RESULT:** **VERIFIED.** Total of 307 cryptographically chained blocks independently verified. Tamper detection verified in test AUDIT-02 (mutating a single block detail terminates chain verification).

---

### 4. Claim: 303.81 ms Canonical Cold-Start Benchmark Baseline
- **CLAIM:** Repository documents "Canonical Benchmark Baseline: 303.81 ms" for Time-to-First-AI-Transaction.
- **TEST:** Microsecond execution measurement across four distinct milestones: (1) Gateway Boot & Policy Engine initialization, (2) Merchant Catalog Ingestion, (3) Ed25519 Principal Mandate Signing, and (4) 6-Phase Zero-Trust Checkout Execution.
- **COMMAND:** `npm run benchmark` (invoking `tsx src/demo/benchmark.ts`)
- **ARTIFACT:** `src/demo/benchmark.ts` source code and empirical execution output:
  - Gateway Boot: 255.17 ms
  - Catalog Ingestion: 0.61 ms
  - Ed25519 Sign: 3.57 ms
  - 6-Phase Checkout: 43.25 ms
  - Total Empirical Cold-Start: **302.61 ms** (Previous runs: 301.98 ms, 282.96 ms; baseline: 303.81 ms)
- **RESULT:** **OBSERVED / TESTED.** Verified as a valid in-memory cold-start benchmark. Forensic audit establishes that ~83% (255 ms) represents Node.js/Fastify cold boot, while the core checkout transaction executes in 43 ms cold and 3 - 10 ms warm. Excludes external network hops to Razorpay.

---

### 5. Claim: Razorpay Sandbox Integration
- **CLAIM:** ACG integrates with Razorpay sandbox rails for payment order creation, refunds, and webhooks.
- **TEST:** Code-level inspection of credential branching, outbound HTTP dispatch, mock fallbacks, and webhook HMAC verification.
- **COMMAND:** Source inspection of `src/rails/razorpay.ts:40-70`, `src/rails/webhook.ts:40-60`, and execution of `vitest run src/core/__tests__/gateway.test.ts`.
- **ARTIFACT:** `.env` (`RAZORPAY_KEY_ID=rzp_test_placeholder_key`) and `src/rails/razorpay.ts:42`:
  ```typescript
  this.isLiveCredentials = this.keyId.startsWith("rzp_test_") &&
    this.keyId !== "rzp_test_placeholder_key" &&
    this.keyId !== "rzp_test_mock";
  ```
- **RESULT:** **TESTED (Contract Mock) / ADAPTER READY (Live).** When default placeholder credentials are used, execution routes to deterministic local mock generators. Live API client logic conforms to Razorpay API v1 specifications, but live outbound HTTP calls were not executed during default benchmark/test runs.

---

### 6. Claim: Multi-Agent Protocol Adapters (MCP, A2A, ACP, AP2, UCP, TAP)
- **CLAIM:** Gateway provides universal protocol interoperability across emerging agent commerce standards.
- **TEST:** Unit testing of protocol parsers, normalization functions, Canonical Intermediate Representation (`CanonicalIntent`) generation, and central authorization engine routing.
- **COMMAND:** `npm test` (specifically `src/core/__tests__/protocol_adapters.test.ts` and `src/core/__tests__/v4_universal_plane.test.ts`)
- **ARTIFACT:**
  - `src/core/mcp_surface.ts` & `src/adapters/mcp/adapter.ts`: **ADAPTER READY**
  - `src/adapters/a2a/adapter.ts`: **ADAPTER READY**
  - `src/adapters/acp/adapter.ts`: **ADAPTER READY**
  - `src/adapters/ap2/adapter.ts`: **ADAPTER READY**
  - `src/adapters/ucp/adapter.ts`: **ADAPTER READY**
  - `src/adapters/tap/adapter.ts`: **DESIGNED** (Abstract schema stub)
  - `src/adapters/acg/adapter.ts`: **LIVE** (Primary native ingress)
- **RESULT:** **VERIFIED (CENTRAL PIPELINE INVARIANT INTACT).** All adapters successfully normalize external schemas to `CanonicalIntent`. Zero adapters bypass the central authorization engine.

---

### 7. Claim: Razorpay Vulcan AI Foundation Model (Payment Intelligence)
- **CLAIM:** ACG leverages downstream Razorpay Vulcan AI telemetry for intelligent routing and fraud assessment.
- **TEST:** Source code review of Vulcan integration modules and runtime advisory scoring.
- **COMMAND:** Source inspection of `src/rails/intelligence.ts:1-64` and `src/gateway/router.ts:805-825`.
- **ARTIFACT:** Code comment in `src/rails/intelligence.ts:12-16`:
  ```typescript
  // Architecture-ready downstream advisory telemetry.
  // No public developer inference API exists for Vulcan.
  // ACG enforces binding merchant authorization.
  ```
- **RESULT:** **DESIGNED / ADAPTER READY.** System implements an advisory telemetry mock adapter returning simulated risk scores and route optimizations. Code explicitly disclaims public inference API availability. Advisory scores do not authorize financial transactions.

---

### 8. Claim: Single-Node SQLite ACID Dual-Resource Locking vs Distributed Consistency
- **CLAIM:** ACG enforces atomic dual-resource locking (simultaneous budget deduction and stock decrement).
- **TEST:** Concurrency warfare test (10 parallel subagents competing for 1 stock unit) and chaos tests.
- **COMMAND:** `npm test` (specifically `src/core/__tests__/security_warfare.test.ts`) and `npm run pentest`.
- **ARTIFACT:** `src/core/reservation.ts:72-167`:
  ```typescript
  this.db.exec("BEGIN IMMEDIATE TRANSACTION;");
  // Check remaining_budget >= required
  // Check available_stock >= requestedQty
  // Decrement remaining_budget
  // Decrement available_stock
  // Commit;
  ```
- **RESULT:** **VERIFIED SINGLE-NODE ACID / PRODUCTION DISTRIBUTED BOUND.** Within a single Node.js operating system process, SQLite's `BEGIN IMMEDIATE TRANSACTION;` provides 100% serialized ACID isolation. Zero inventory oversell or budget double-spending occurred. However, SQLite file-locking does not provide distributed concurrency across multi-instance clusters (requires PostgreSQL migration as detailed in `FINDING-016`).

---

### 9. Claim: Tamper-Evident SHA-256 Audit Hash Chaining
- **CLAIM:** Audit ledger provides cryptographic forward-chaining guaranteeing tamper detection.
- **TEST:** Injection of tampered payload in historical audit block followed by execution of ledger verifier.
- **COMMAND:** Pentest scenario AUDIT-02 in `src/demo/pentest_runner.ts` and `npm run audit:verify`.
- **ARTIFACT:** `src/store/audit.ts:40-52` (`computeHash`) and `src/store/audit.ts:69-111` (`verifyLedgerIntegrity`).
- **RESULT:** **VERIFIED (TAMPER-EVIDENT SHA-256 HASH CHAIN).** Mutating any historical block (event, details JSON, previous hash) immediately causes `verifyLedgerIntegrity()` to throw a verification error identifying the exact tampered block. Correctly labeled as "Tamper-Evident Hash Chain" rather than "Tamper-Proof".

---

### 10. Claim: Untrusted Model Invariant (Merchant Catalog Truth Primacy)
- **CLAIM:** "The model can propose anything. It cannot authorize anything." Agent-claimed prices are ignored.
- **TEST:** Submit checkout requests where the agent proposes price ₹1.00 for a ₹3,500 keyboard.
- **COMMAND:** Pentest scenario PENTEST-PRICE-01 in `src/demo/pentest_runner.ts` and `npm test` (`authority_boundary.test.ts`).
- **ARTIFACT:** `src/gateway/router.ts:759` and `src/core/truth.ts:86-153`:
  ```typescript
  // Agent proposed amounts are discarded
  const truthResult = await this.truthResolver.resolveTruth(intent.items, merchantId);
  const totalAmountPaise = truthResult.totalAmount; // Authoritative price from DB
  ```
- **RESULT:** **VERIFIED.** Under-priced and forged agent arithmetic is unconditionally stripped. The system charges the authoritative merchant catalog price (or rejects the order if mandate budget is insufficient).

---

### 11. Claim: Fail-Closed Principle on Railway / Infrastructure Failures
- **CLAIM:** If any downstream provider, database lock, or policy check fails, all reservations roll back immediately.
- **TEST:** Controlled injection of database locks, 5000ms rail timeouts, 503 HTTP responses, and catalog errors.
- **COMMAND:** Execution of Phase 16 Chaos Harness (`.agents/worker_resilience_quality_2/phase16_chaos_harness.ts`).
- **ARTIFACT:** Execution logs verifying atomic execution of `reservationEngine.releaseReservation(reservationId)` upon error.
- **RESULT:** **VERIFIED.** On infrastructure, provider, and catalog failures, the gateway rolls back budget deductions and stock decrements, returning HTTP 500 or 502 with zero financial mutation. (Exception: Webhook delayed capture defect documented in `FINDING-006`).

---

### 12. Claim: Multi-Level Operational Kill Switch Governance
- **CLAIM:** Gateway supports real-time global, per-merchant, and per-agent operational kill switches.
- **TEST:** Activation of global and agent-level kill switches followed by checkout attempts.
- **COMMAND:** `npm test` (`src/core/__tests__/v2_control_plane.test.ts`) and `npm test` (`src/core/__tests__/v3_security_infra.test.ts`).
- **ARTIFACT:** `src/core/kill_switch.ts:35-65` and `src/gateway/router.ts:714-727`:
  ```typescript
  const killCheck = this.killSwitchService.isBlocked(merchantId, agentId);
  if (killCheck.blocked) {
    return reply.status(503).send({ error: "SERVICE_UNAVAILABLE", reason: killCheck.reason });
  }
  ```
- **RESULT:** **VERIFIED.** Active kill switches immediately intercept incoming requests in Phase 1 before cryptographic or catalog operations are initiated.

---

## 3. Evidence Mapping Summary Table

| Claim # | Subject Matter | Formal Classification | Independent Audit Result | Primary Verification Artifact |
| :---: | :--- | :--- | :--- | :--- |
| **1** | 77 / 77 Automated Tests Passing | **TESTED / OBSERVED** | **SUPERSEDED (102 / 102 PASS)** | `npm test` stdout / 12 test files |
| **2** | 19 / 19 Live Pentests Blocked | **VERIFIED** | **CONFIRMED (19 / 19 BLOCKED)** | `reports/pentest/raw_results.json` |
| **3** | 307 Chained Audit Blocks | **VERIFIED** | **CONFIRMED (307 BLOCKS SOUND)** | `scripts/verify_audit.ts` stdout |
| **4** | 303.81 ms Benchmark Baseline | **OBSERVED / TESTED** | **CONFIRMED (302.61 ms COLD BOOT)** | `src/demo/benchmark.ts` stdout |
| **5** | Razorpay Sandbox Integration | **TESTED (Mock) / ADAPTER READY**| **CONFIRMED CONTRACT MOCK** | `src/rails/razorpay.ts:42` |
| **6** | Multi-Agent Protocol Adapters | **ADAPTER READY / DESIGNED** | **CONFIRMED ZERO BYPASS** | `src/core/__tests__/protocol_adapters.test.ts` |
| **7** | Razorpay Vulcan AI Model | **DESIGNED / ADAPTER READY** | **CONFIRMED ADVISORY TELEMETRY** | `src/rails/intelligence.ts:12` |
| **8** | Single-Node ACID Locking | **VERIFIED SINGLE-NODE ACID** | **CONFIRMED ZERO OVERSOLD** | `src/core/reservation.ts:72` |
| **9** | Tamper-Evident SHA-256 Ledger | **VERIFIED** | **CONFIRMED TAMPER-EVIDENT** | `src/store/audit.ts:69` |
| **10** | Untrusted Model Invariant | **VERIFIED** | **CONFIRMED PRICE STRIPPED** | `src/core/truth.ts:86` |
| **11** | Fail-Closed Rollback Invariant | **VERIFIED** | **CONFIRMED DUAL ROLLBACK** | Chaos Test Harness logs |
| **12** | Operational Kill Switch | **VERIFIED** | **CONFIRMED HTTP 503 SHUTDOWN**| `src/core/kill_switch.ts:35` |
