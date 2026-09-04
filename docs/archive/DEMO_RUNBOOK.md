# ACG 4-Minute Live Demo Runbook

## "The model decided what it wanted. The control plane decided whether it was allowed."

This runbook structures the 4-minute live demonstration of the Agent Commerce Gateway (ACG / MACCP) for judges, evaluators, and engineering leadership.

---

## 🎯 Demo Executive Pitch (30 Seconds)
> **“AI models and agents are incredible at discovery, reasoning, and proposing purchases. But in enterprise commerce, an AI model cannot authorize financial actions. Razorpay already provides world-class payment rails and downstream AI intelligence. ACG provides the missing merchant-side control boundary: cryptographic buyer mandates, catalog truth links, dynamic policy enforcement, and atomic dual-resource locks before downstream execution.”**

---

## ⏱️ The 5-Phase Demonstration Sequence

### Phase 1: Nominal Authorized AI Checkout (0:30 – 1:15)
* **Action:** Launch an agent checkout request (`SKU-MOUSE-PRO`, Qty: 1) with an Ed25519-signed buyer mandate.
* **Observe in UI / Terminal:**
  1. Mandate Signature verified in `< 4ms`.
  2. Database resolves authoritative price (₹1,800 + 18% GST = ₹2,124.00).
  3. Policy Engine approves under `pol_v1.0.0`.
  4. Dual-resource lock reserves 1 mouse unit and ₹2,124.00 mandate budget.
  5. Downstream Razorpay Order created (`order_...`).
  6. Audit Ledger commits new SHA-256 block.
* **Narrative:** *"Notice the 6-phase zero-trust pipeline. The agent did not dictate price or bypass policy; every step was deterministically verified."*

---

### Phase 2: Autonomous Budget Overstep Interception (1:15 – 2:00)
* **Action:** Agent attempts to order an Executive Mesh Chair (₹14,160.00) with a mandate capped at ₹5,000.00.
* **Observe in UI / Terminal:**
  1. Policy Engine intercepts transaction at Phase 4.
  2. Gateway immediately returns **`HTTP 403 MANDATE_BUDGET_EXCEEDED`**.
  3. Zero inventory allocated; zero funds locked.
  4. Razorpay rails are **never touched**.
* **Narrative:** *"The LLM hallucinated that it had permission to spend ₹14,000. The control plane deterministically prevented the financial action."*

---

### Phase 3: High-Concurrency Double-Spend Race (2:00 – 2:45)
* **Action:** Trigger 10 parallel subagents concurrently competing for a residual budget of ₹2,876.00 with cart values of ₹2,124.00.
* **Observe in UI / Terminal:**
  1. Exactly **1 subagent succeeds** (HTTP 201).
  2. **9 subagents are immediately rejected** with `HTTP 409 MANDATE_EXHAUSTED`.
  3. Ending budget is exactly ₹752.00 ($\ge 0$).
* **Narrative:** *"In a multi-agent ecosystem, agents spawn concurrently. ACG's atomic locking eliminates double-spending at the database boundary."*

---

### Phase 4: Real-Time Principal Mandate Revocation (2:45 – 3:30)
* **Action:** Principal revokes their mandate via `/v1/mandates/revoke`. A subagent immediately presents the valid cryptographic signature for checkout.
* **Observe in UI / Terminal:**
  1. Gateway checks the Revocation Registry in Phase 2a.
  2. Returns **`HTTP 403 MANDATE_REVOKED`**.
  3. Action is logged in the tamper-evident audit ledger.
* **Narrative:** *"Even though the cryptographic signature is mathematically valid forever, the human principal maintains real-time control to cut off rogue agents instantly."*

---

### Phase 5: Tamper Detection & Webhook Reconciliation (3:30 – 4:00)
* **Action:** Demonstrate webhook deduplication (`x-razorpay-event-id`) and run `npm run audit:verify`.
* **Observe in Terminal:**
  1. Duplicate webhooks receive `200 DUPLICATE_IGNORED` without mutating order status twice.
  2. `npm run audit:verify` validates full cryptographic SHA-256 block chain.
* **Narrative:** *"Every transition forms a tamper-evident SHA-256 chain for auditability and compliance."*

---

## 🏆 Final Wrap-Up Statement
> **“AI proposes. ACG authorizes. Razorpay executes.”**
