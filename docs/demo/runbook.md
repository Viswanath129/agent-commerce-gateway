# ACG 4-Minute Live Demonstration Runbook

## "The model decided what it wanted. The control plane decided whether it was allowed."

---

## ⏱️ Live Demonstration Sequence (Exactly 4 Minutes)

### 0:00 – 0:30 | The Core Problem & Central Thesis
* **Presenter:** *"Autonomous AI agents can discover products, negotiate carts, and propose purchases. But in enterprise commerce, an AI model cannot authorize financial actions. Razorpay provides downstream payment rails and AI intelligence. ACG provides the merchant-side control boundary: cryptographic buyer mandates, catalog truth grounding, and atomic resource locks."*
* **Core Thesis:** *"The model can propose anything. It cannot authorize anything."*

---

### 0:30 – 1:10 | Phase 1: Nominal Authorized Checkout
* **Action:** Launch an agent checkout for `SKU-MOUSE-PRO` with an Ed25519-signed mandate.
* **Observation:**
  1. Mandate verified in `< 4 ms`.
  2. Database computes authoritative total of ₹2,124.00 (₹1,800 + 18% GST).
  3. Dual-resource engine locks 1 unit and ₹2,124.00 budget.
  4. Razorpay Order created (`order_...`).
  5. SHA-256 audit block committed.

---

### 1:10 – 1:50 | Phase 2: Autonomous Budget Overstep
* **Action:** Agent attempts to buy an Executive Chair (₹14,160.00) against a ₹5,000.00 mandate cap.
* **Observation:**
  1. Intercepted at Phase 4 with **`HTTP 403 MANDATE_BUDGET_EXCEEDED`**.
  2. Zero inventory or budget locked.
  3. Razorpay rails are **never touched**.

---

### 1:50 – 2:40 | Phase 3: High-Concurrency Double-Spend Race
* **Action:** Fire 10 parallel subagents concurrently competing for residual budget (₹2,876.00).
* **Observation:**
  1. Exactly **1 subagent succeeds** (`HTTP 201`).
  2. **9 subagents are rejected** (`HTTP 409`).
  3. Final balance is ₹752.00 ($\ge 0$); zero double-spending.

---

### 2:40 – 3:20 | Phase 4: Real-Time Mandate Revocation
* **Action:** Principal issues revocation via `/v1/mandates/revoke`. A rogue subagent attempts checkout with the valid signature.
* **Observation:**
  1. Revocation registry intercepts checkout at Phase 2a.
  2. Returns **`HTTP 403 MANDATE_REVOKED`**.

---

### 3:20 – 4:00 | Phase 5: Audit & Reconciliation
* **Action:** Deliver duplicate webhook and execute `npm run audit:verify`.
* **Observation:**
  1. Webhook deduplication ignores duplicate delivery (`200 DUPLICATE_IGNORED`).
  2. `npm run audit:verify` validates 307 chained SHA-256 blocks intact.
* **Closing:** *"AI proposes. ACG authorizes. Razorpay executes."*
