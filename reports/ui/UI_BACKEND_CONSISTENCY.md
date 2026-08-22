# ACG — UI & BACKEND DATA CONSISTENCY PROOF

**Assessment Date:** August 22, 2026  
**Invariant Checked:** `UI Value == API Response == SQLite Database Record`

---

## 1. Data Mapping & Consistency Matrix

| Entity / Property | UI Display Element | API Source Endpoint | Authoritative SQLite Column / Table | Consistency Verification |
| :--- | :--- | :--- | :--- | :---: |
| **Intent Identifier** | `#detail-intent-id` | `GET /dashboard/transactions` | `order_sessions.intent_id` (TEXT PK) | **EXACT MATCH** |
| **Total Amount (INR)** | `#kpi-gmv`, `#detail-amount` | `GET /dashboard/metrics` | `order_sessions.amount / 100` | **EXACT MATCH** |
| **Active Policy Version**| `#sidebar-policy-version` | `GET /dashboard/policies` | `PolicyEngine.getPolicy().policy_version` | **EXACT MATCH** |
| **Reservation Status** | `#detail-status`, Tab 06 | `GET /dashboard/reservations` | `reservations.status` (`HELD`, `COMMITTED`) | **EXACT MATCH** |
| **Razorpay Order ID** | `#detail-order-id` | `GET /dashboard/transactions` | `order_sessions.razorpay_order_id` | **EXACT MATCH** |
| **Mandate Remaining** | Mandate Card (Tab 04) | `GET /dashboard/mandates` | `buyer_mandates.remaining_budget` | **EXACT MATCH** |
| **Revocation State** | Tab 04 Revocation List | `GET /dashboard/mandates` | `revoked_mandates.mandate_id` | **EXACT MATCH** |
| **Audit Block Hash** | Tab 07 Block List | `GET /dashboard/audit` | `audit_ledger.record_hash` (SHA-256) | **EXACT MATCH** |

---

## 2. Real User Flow Execution Walkthrough

```text
[Step A] Open Dashboard -> GET /dashboard/metrics -> Returns 0 intents, ₹0.00 GMV, 0 blocks.
[Step B] User triggers [01] Nominal Flow -> POST /dashboard/demo/run-scenario (happy-path)
         └── Generates Noble Ed25519 keypair
         └── Creates Mandate man_nominal_... (₹5,000.00 cap)
         └── Queries DB Catalog: SKU-MOUSE-PRO (₹1,800 + 18% GST = ₹2,124.00)
         └── Policy Evaluates ALLOW under pol_v1.0.0
         └── Dual-Resource Lock decrements remaining mandate budget to ₹2,876.00 and decrements stock
         └── Razorpay Rail generates order ID order_... with idempotent receipt
         └── Webhook processor records payment.captured event
         └── Appends transition blocks to SHA-256 chained audit ledger
[Step C] UI poller detects new database records -> KPI increments, Transaction appears in Activity Ledger table,
         Audit block #128 appears with cryptographic hash.
[Step D] User clicks [02] Budget Overstep -> POST /dashboard/demo/run-scenario (mandate-violation)
         └── Proposes SKU-CHAIR-ERGO (₹14,160.00) against ₹5,000.00 mandate
         └── Policy Engine halts with HTTP 403 MANDATE_BUDGET_EXCEEDED
         └── Razorpay rails NOT called
         └── UI logs real 403 error in execution trace.
[Step E] User triggers Concurrency Test -> POST /dashboard/demo/run-scenario (concurrent)
         └── Fires 2 parallel requests against ₹2,876.00 remaining
         └── Subagent A gets HTTP 201 Created
         └── Subagent B gets HTTP 409 MANDATE_EXHAUSTED
         └── UI shows exact 201 / 409 response codes.
[Step F] User revokes mandate via UI Console -> POST /v1/mandates/revoke
         └── Writes to revoked_mandates SQLite table
         └── Retrying checkout with same mandate returns HTTP 403 MANDATE_REVOKED.
```
