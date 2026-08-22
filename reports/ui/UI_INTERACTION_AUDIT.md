# ACG — FULL INTERACTIVE CONTROL & UI AUDIT

**Audit Date:** August 22, 2026  
**Auditor:** FinTech Application Security & Front-End Control Plane Team  
**Scope:** Complete interactive control inventory in `public/index.html` and backing router endpoints in `src/gateway/router.ts`.

---

## 1. Full Interactive Control Inventory

| Control Identifier | Screen / Tab | Trigger Type | Backend Endpoint | Expected Action | Actual Verified Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| `nav-tab-01` | Sidebar | Tab Click | `GET /dashboard/metrics` | Navigate to Overview, load live KPIs & activity table | Loads live counts (19 intents, ₹28,280 GMV) | **WORKING** |
| `nav-tab-02` | Sidebar | Tab Click | Static DOM / SVG | Navigate to Live Interactive Topology Stage | Renders dynamic SVG paths & scenario bar | **WORKING** |
| `nav-tab-03` | Sidebar | Tab Click | `GET /dashboard/transactions` | Navigate to Transaction Inspector | Displays latest persisted order sessions | **WORKING** |
| `nav-tab-04` | Sidebar | Tab Click | `GET /dashboard/mandates` | Navigate to Mandate Registry & Revocation Console | Queries `buyer_mandates` & `revoked_mandates` | **WORKING** |
| `nav-tab-05` | Sidebar | Tab Click | `GET /dashboard/policies`, `/catalog` | Navigate to Policy & Commerce Truth Engine | Queries active policy DSL and SQLite catalog | **WORKING** |
| `nav-tab-06` | Sidebar | Tab Click | `GET /dashboard/reservations` | Navigate to Atomic Dual-Lock Reservations | Queries active held / committed locks | **WORKING** |
| `nav-tab-07` | Sidebar | Tab Click | `GET /dashboard/audit` | Navigate to SHA-256 Chained Audit Ledger | Renders recent cryptographic blocks | **WORKING** |
| `nav-tab-08` | Sidebar | Tab Click | `GET /dashboard/health` | Navigate to System Health & Protocol Adapters | Probes DB, Policy, Rail & Ledger status | **WORKING** |
| `btn-sync-global` | Top Header | Button Click | All `/dashboard/*` endpoints | Refresh all UI components & display timestamp | Refreshes DOM with `SYNC COMPLETE HH:MM:SS` | **WORKING** |
| `btn-scenario-01` | Tab 02 (Demo) | Button Click | `POST /dashboard/demo/run-scenario` (`happy-path`) | Execute full 6-phase checkout + webhook capture | Returns `201 Created`, creates order, commits SHA-256 block | **WORKING** |
| `btn-scenario-02` | Tab 02 (Demo) | Button Click | `POST /dashboard/demo/run-scenario` (`mandate-violation`)| Submit ₹14,160 item against ₹5,000 mandate | Returns `403 MANDATE_BUDGET_EXCEEDED`; halts before rail | **WORKING** |
| `btn-scenario-03` | Tab 02 (Demo) | Button Click | `POST /dashboard/demo/run-scenario` (`concurrent`) | Fire 2 parallel checkouts against remaining balance | Returns 1x `201 Created` and 1x `409 MANDATE_EXHAUSTED` | **WORKING** |
| `btn-scenario-04` | Tab 02 (Demo) | Button Click | `POST /dashboard/demo/run-scenario` (`webhook-fail`) | Deliver forged HMAC webhook signature | Returns `401 INVALID_WEBHOOK_SIGNATURE` | **WORKING** |
| `btn-scenario-05` | Tab 02 (Demo) | Button Click | `POST /dashboard/demo/run-scenario` (`refund`) | Simulate stockout failure on captured order | Returns `REFUNDED` with audit trajectory | **WORKING** |
| `row-transaction` | Tab 01 / Tab 03 | Row Click | `GET /dashboard/transaction/:intentId` | Open single transaction inspector & trajectory | Loads full narrative decision steps & raw JSON | **WORKING** |
| `btn-revoke-mandate`| Tab 04 (Mandates) | Form Submit | `POST /v1/mandates/revoke` | Revoke mandate in SQLite database | Returns `200 REVOKED`; blocks subsequent checkouts (403) | **WORKING** |
| `btn-mutate-policy` | Tab 05 (Policies) | Modal / Prompt | `PUT /v1/merchant/policy` | Update merchant transaction limits in runtime | Returns `200 POLICY_UPDATED` with new policy version | **WORKING** |
| `btn-concurrency-run`| Tab 06 (Reserve) | Button Click | `POST /dashboard/demo/run-scenario` (`concurrent`) | Run live dual-subagent race test | Updates summary cards to `Admitted: 1`, `Blocked: 1` | **WORKING** |
| `btn-verify-audit` | Tab 07 (Audit) | Button Click | `GET /audit/integrity` | Re-compute full SHA-256 chain integrity | Returns `isValid: true/false` and checked blocks count | **WORKING** |

---

## 2. Summary of Verification

* **Total Controls Audited:** 19
* **Working Controls:** 19
* **Broken / Dead Controls:** 0
* **Frontend-Only State Mutations:** 0
* **Authority Model:** 100% Server Authoritative
