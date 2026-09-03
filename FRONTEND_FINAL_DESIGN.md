# AGENT COMMERCE GATEWAY (ACG) — FINAL LUXURY REACT UI DESIGN SPECIFICATION

## Merchant-Side Control Plane for AI-Originated Financial Actions
**Razorpay AI Buildathon — Track 01**  
**Design Paradigm:** Luxury Editorial FinTech $\times$ Swiss Minimalist Precision $\times$ Zero-Mock Authoritative Control Plane

---

## 1. Executive Summary & Core Principle

> **"The model can propose anything. It cannot authorize anything."**  
> **"The agent decided what it wanted. The control plane decided whether it was allowed."**

Agent Commerce Gateway (ACG) provides deterministic, cryptographic, and merchant-controlled authorization between autonomous AI models and financial execution rails (Razorpay). 

The frontend is not a cosmetic dashboard or a passive analytics display; it is a **mission-critical financial control instrument**. Every figure, state transition, and cryptographic hash rendered in this interface is sourced in real-time from the backend SQLite state and Razorpay sandbox rails.

```
+---------------------------------------------------------------------------------------+
|                               SYSTEM ARCHITECTURAL PIPELINE                           |
|                                                                                       |
|   [ ANY AI MODEL ]                                                                    |
|    (GPT-4o, Claude, Gemini, DeepSeek, Local LLMs)  -->  PROPOSAL (Zero Authority)     |
|           |                                                                           |
|           v                                                                           |
|   [ PROTOCOL INGRESS ]                                                                |
|    (Native ACG, REST, MCP, A2A, ACP, AP2, UCP, TAP) --> CANONICAL IR NORMALIZATION   |
|           |                                                                           |
|           v                                                                           |
|   [ AGENT COMMERCE GATEWAY (ACG) ]                                                    |
|    (Mandate -> Commerce Truth -> Policy -> Dual Reservation -> Audit)                 |
|           |                                                                           |
|           v                                                                           |
|   [ PAYMENT INTELLIGENCE ]                                                            |
|    (Razorpay Vulcan Foundation Model Advisory)       --> ADVISORY ONLY                |
|           |                                                                           |
|           v                                                                           |
|   [ RAZORPAY SETTLEMENT RAILS ]                                                       |
|    (Orders API, Webhooks HMAC, Refunds, UPI Reserve) --> FINANCIAL EXECUTION          |
+---------------------------------------------------------------------------------------+
```

---

## 2. Visual Design System & Token Architecture

The ACG design system enforces a strict **90 / 7 / 3 color distribution ratio**:
- **90% Neutral Dominance:** Deep Obsidian blacks and muted slate-brown borders.
- **5–7% Luxury Warmth:** Noble Champagne Gold (`#C8B27A`) for identity, active indicators, and authoritative markers.
- **3–5% Technical Precision:** Muted Sage Green (`#6F9B83`) for verified commits, Ochre Amber (`#B28A52`) for warnings, and Wine Brick Red (`#A76565`) for deterministic policy blocks.

### 2.1 Color Palette Tokens
| Token Name | Hex Code | Semantic Role |
| :--- | :--- | :--- |
| `--bg-primary` | `#10100F` | Control plane canvas background (Dark Obsidian) |
| `--bg-surface` | `#181816` | Panel, table, and card surface |
| `--bg-elevated` | `#1E1E1B` | Active hover states, interactive focus |
| `--border-subtle` | `#302F2B` | Hairline linework dividers (1px solid) |
| `--text-primary` | `#F2EEE4` | Warm Ivory display typography |
| `--text-secondary`| `#B8B3A7` | Warm Muted body copy |
| `--text-muted` | `#77746C` | Low-priority metadata, timestamps |
| `--accent-gold` | `#C8B27A` | Champagne Gold: Primary identity & active border |
| `--accent-light` | `#E1D2A8` | Champagne Light: Interactive highlights |
| `--status-success`| `#6F9B83` | Muted Sage: Cryptographic verification, committed orders |
| `--status-danger` | `#A76565` | Wine Brick: Intercepted overspend, blocked attacks |
| `--status-warning`| `#B28A52` | Ochre Amber: Reservations held, budget warning |
| `--status-info` | `#73889A` | Slate Blue: Neutral system metadata |

### 2.2 Typography Hierarchy
- **Display & Section Headers:** `Cormorant Garamond`, `Bodoni Moda`, `Libre Baskerville` (Serif, High-contrast, Dignified).
- **Control Plane Interface & Labels:** `Inter`, `Geist` (Geometric sans-serif, 300/400/500/600 weight).
- **Financial Figures, Hashes & Code:** `IBM Plex Mono`, `JetBrains Mono` (Monospaced, tabular numerals, alignment precision).

---

## 3. The 9 Dedicated Feature Views

### Screen 01 — Overview (`OverviewView.tsx`)
- **Header:** "AGENT COMMERCE CONTROL PLANE" with subtitle "Deterministic control between AI intent and financial execution."
- **Live System Pipeline:** 7-stage linework progression (`01 INTENT` $\rightarrow$ `02 AUTHORITY` $\rightarrow$ `03 TRUTH` $\rightarrow$ `04 POLICY` $\rightarrow$ `05 RESERVE` $\rightarrow$ `06 RAZORPAY` $\rightarrow$ `07 RECONCILIATION`).
- **Live Metrics (Zero-Mock):**
  - `AI INTENTS`: Exact count of intents evaluated by SQLite ledger.
  - `AUTHORIZED GMV`: Cumulative INR amount of truth-grounded transactions.
  - `BLOCKED ATTEMPTS`: Precise tally of adversarial, over-budget, or schema-violating submissions.
  - `ACTIVE RESERVATIONS`: Number of currently held dual-resource ACID locks.
- **Live Activity Table:** Displays persisted transactions with real-time UTC timestamps, agent identities, order IDs, and status badges. Clicking any row navigates directly to the Transaction Inspector.

### Screen 02 — Live Demo (`LiveDemoView.tsx`)
- **Hero Presentation:** "THE MODEL CAN PROPOSE ANYTHING. IT CANNOT AUTHORIZE ANYTHING."
- **Scenario Controls (5 Real Backend Dispatches):**
  1. `01 Nominal Flow`: Optical Gaming Mouse checkout with Razorpay sandbox order generation and webhook reconciliation.
  2. `02 Budget Overstep`: Executive Ergonomic Chair (₹14,160.00) vs ₹5,000.00 mandate $\rightarrow$ Intercepted at Policy Engine with HTTP 403. Razorpay rails never touched.
  3. `03 Double-Spend Race`: Two parallel subagents attacking a remaining ₹2,876.00 pool $\rightarrow$ ACID lock admits 1, rejects 1 with HTTP 409.
  4. `04 Webhook Reconciliation`: Simulated payment confirmation with HMAC verification and idempotency protection.
  5. `05 Safe Reversal`: Post-capture warehouse stockout handling with idempotent refund dispatch.
- **Framer Motion Causality Transitions:** Pipeline stages illuminate and update state *only* after authoritative backend responses arrive.
- **Live Response Inspector:** Full JSON payload alongside an active UTC gateway trace log.

### Screen 03 — Transactions (`TransactionsView.tsx`)
- **Persisted Registry:** Comprehensive table of all historical order sessions joined with reservation metadata.
- **Transaction Detail View (`/transactions/:intentId`):**
  - Grand typography showing transaction amount (e.g. `₹2,124.00`).
  - **9-Stage Editorial Decision Timeline:**
    `01 AGENT INTENT` $\rightarrow$ `02 AUTHORITY` $\rightarrow$ `03 COMMERCE TRUTH` $\rightarrow$ `04 POLICY` $\rightarrow$ `05 RESERVATION` $\rightarrow$ `06 RAZORPAY` $\rightarrow$ `07 WEBHOOK` $\rightarrow$ `08 RECONCILIATION` $\rightarrow$ `09 AUDIT`.
  - Displays actual state transitions (`DUAL_RESERVATION_HELD` $\rightarrow$ `ORDER_CREATED` $\rightarrow$ `PAYMENT_CAPTURED`), individual step record hashes, and raw database session JSON.

### Screen 04 — Mandates & Authority (`MandatesView.tsx`)
- **Title:** "SPEND MANDATES" // "CRYPTOGRAPHIC BUYER DELEGATION"
- **Authority Cards:**
  - Principal Public Key (truncated with full tooltip)
  - Mandate ID (`man_nominal_default`, `man_adversarial_overspend`)
  - Maximum Limit & Remaining Balance (formatted in ₹ INR)
  - Visual Budget Consumed progress bar
  - Signature status: `Ed25519 VERIFIED`
- **Revocation Action:** Modal confirmation directly invokes `POST /v1/mandates/revoke`. The backend writes to `revoked_mandates`, instantly invalidating downstream agent checkouts with HTTP 403.

### Screen 05 — Policies & Truth (`PoliciesView.tsx`)
- **Split Enforcement Architecture:**
  - **Left (Merchant Policy):** Versioned operational DSL (`pol_v1.0.0`). Contains transaction limits, allowed categories (`electronics`, `furniture`), auto-refund rules, and effective timestamps.
  - **Real Backend Mutation:** "MUTATE POLICY (PUT)" allows the merchant to dynamically alter limits. Submits `PUT /v1/merchant/policy`, creating `pol_v2.0.0` live in memory and SQLite.
  - **Right (Commerce Truth):** Authoritative SQLite catalog table (SKU, Item Name, Unit Price, Stock, GST Tax Rate).
  - **Comparison Card:** "Agent Proposal (Probabilistic ₹1.00)" vs "Merchant Truth (Deterministic ₹14,160.00)" highlighting ACG's price-grounding principle.

### Screen 06 — Atomic Reservations (`ReservationsView.tsx`)
- **Title:** "ATOMIC RESERVATION" // "HIGH-CONCURRENCY FINANCIAL PROTECTION"
- **Dual-Resource Locking Explanation:** Visually illustrates why budget allocation and inventory decrements must occur simultaneously within SQLite transactions before contacting Razorpay.
- **Parallel Race Visualizer:**
  - Shared Available Balance: `₹2,876.00`
  - Subagent A: `₹2,124.00` $\rightarrow$ `ALLOW (HTTP 201)`
  - Subagent B: `₹2,124.00` $\rightarrow$ `BLOCK (HTTP 409 MANDATE_EXHAUSTED)`
- **"RUN LIVE CONCURRENCY TEST" Action:** Spawns two concurrent requests to `/dashboard/demo/run-scenario`. Framer Motion renders the real serialized race outcome.
- **Active Reservations Table:** Lists real held and committed reservations.

### Screen 07 — Audit Ledger (`AuditLedgerView.tsx`)
- **Title:** "AUDIT LEDGER" // "TAMPER-EVIDENT TRANSACTION PROVENANCE"
- **Cryptographic Chaining:** Blocks rendered along a continuous vertical hairline rule. Each card shows:
  - Block index (`BLOCK #084`)
  - Event type (`MANDATE_VERIFIED`, `COMMERCE_TRUTH_RESOLVED`, `RAZORPAY_ORDER_CREATED`)
  - Timestamp (UTC)
  - Current SHA-256 Record Hash
  - Backwards-linked Previous Record Hash
- **"RUN BACKEND VERIFICATION" Action:** Invokes `GET /audit/integrity`. Scans entire database block sequence and reports `HASH CHAIN VALID` or flags tampering.

### Screen 08 — System Health (`SystemHealthView.tsx`)
- **Operational Index:** Evaluates 7 core subsystems directly from `GET /dashboard/health`:
  1. `01 GATEWAY INGRESS`: Live round-trip response time (ms)
  2. `02 DATABASE STORE`: SQLite persistent engine connection
  3. `03 POLICY ENGINE`: Active DSL version state
  4. `04 RESERVATION ENGINE`: Dual-resource ACID lock status
  5. `05 RAZORPAY SANDBOX`: Active settlement rail configuration
  6. `06 WEBHOOK PROCESSOR`: HMAC SHA-256 verification readiness
  7. `07 AUDIT LEDGER`: SHA-256 hash-chain integrity verification
- Displays raw telemetry JSON for inspection.

### Screen 09 — Agent Compatibility (`AgentCompatibilityView.tsx`)
- **Strategic Vision:** "One deterministic control plane. Many agent ecosystems."
- **Architectural Flow Visualization:**
  `ANY AI MODEL` $\rightarrow` `AGENT / PROTOCOL` $\rightarrow$ `ACG` $\rightarrow$ `PAYMENT INTELLIGENCE` $\rightarrow$ `RAZORPAY`
- **Compatibility Matrix Across 4 Domains:**
  1. *Model Surfaces:* OpenAI, Anthropic Claude, Google Gemini, Open Models (Cursor/Windsurf), Custom Enterprise Agents (All labeled: Role: Proposer / Authority: NONE).
  2. *Protocol Ingress Adapters:* Native ACG (`LIVE`), REST (`LIVE`), MCP (`ADAPTER READY`), A2A (`ADAPTER READY`), ACP (`ADAPTER READY`), AP2 (`ADAPTER READY`), UCP (`ADAPTER READY`), Visa TAP (`DESIGN`). *Only tested live protocols receive green status.*
  3. *Payment Intelligence Layer:* Heuristic Risk (`LIVE`), Razorpay Vulcan Foundation Model (`ARCHITECTURE READY` - explicitly marked as advisory, non-authoritative).
  4. *Payment Settlement Rails:* Razorpay Sandbox (`LIVE`), UPI Reserve Pay (`RAIL`), Cards (`RAIL`), x402 / MPP (`PLUGGABLE`).
- **Interactive Protocol Testbench:** Merchants can click any protocol button (e.g. `MCP`, `A2A`, `ACP`) to trigger real backend normalization via `POST /dashboard/compatibility/test-adapter`.

---

## 4. Zero-Mock Contract & Truth Grounding

Every value presented in the user interface obeys the following governance rules:
1. **Never fabricate metrics:** If SQLite has 0 transactions, the UI displays `0` and empty states.
2. **Never hardcode financial figures:** All INR amounts are converted from authoritative database paise using `formatInr()`.
3. **No cosmetic delays:** Spinners and processing animations are strictly tied to real `Promise` lifecycle states.
4. **Authoritative Backend Truth:** If an agent sends an intent specifying `price: 1`, ACG overwrites it with the catalog price `1416000` paise and calculates tax via the merchant's configured rate. The UI clearly visualizes this exact decision.
