# ACG — Final Presentation Deck & Pitch Guide
> **Razorpay AI Buildathon — Track 01: AI Growth & Agentic Commerce**  
> **Target:** 4–5 Minute Final Live Pitch & Technical Demo to Razorpay Leadership

---

## 🎯 1. The 30-Second Elevator Pitch (The Hook)

> **“Judges, in 2026 autonomous AI agents are placing orders across Claude, ChatGPT, Cursor, and voice interfaces. But there is a fatal flaw in current architectures:**
> 
> **Giving an LLM payment credentials or trusting agent price arithmetic creates catastrophic prompt-injection, overspend, and race-condition vulnerabilities.**
> 
> **Agent Commerce Gateway (ACG) is the merchant-side financial control plane that converts untrusted agent intent into deterministic, policy-bound, and auditable financial execution on Razorpay rails.**
> 
> **Our thesis is simple:**  
> **‘The model can propose anything. It cannot authorize anything.’**  
> **‘Vulcan makes payment execution intelligent. ACG makes agent authorization deterministic.’”**

---

## 🧭 2. Architectural Positioning (Crucial Nuance for Judges)

### What ACG Is NOT:
* **NOT** a competitor to Razorpay's AI stack.
* **NOT** a blanket gateway forced in front of all Razorpay AI experiences.
* **NOT** another speculative payment protocol or crypto token.

### What ACG IS:
* **The merchant's deterministic control boundary for agent-originated financial actions.**
* Sits between agent interfaces (MCP, A2A, ACP, AP2, UCP, TAP) and payment execution.
* Razorpay owns the agentic experience (ChatGPT Apps, Razorpay MCP server across Claude/Cursor/Windsurf, Sarvam voice commerce) and payment intelligence (Vulcan).
* The **merchant** owns catalog truth, margin policies, stock reservations, and inventory locking. ACG bridges these two worlds.

```text
Razorpay-Native Agentic Experiences
(ChatGPT App / Voice Commerce / MCP Server / RazorpayX Payouts)
                 │
                 ├─────────────────────────┐
                 │                         │
                 ▼                         ▼
            Native Flow                   ACG Control Boundary
                                           │
                                           ▼
                                 Merchant Policy (v1 / v2)
                                 + Cryptographic Authority (Ed25519)
                                 + Resource Locks (Budget & Stock)
                                 + Tamper-Evident SHA-256 Audit Provenance
                                           │
                                           ▼
                                 Payment Intelligence
                                 (Razorpay Vulcan [Architecture Ready])
                                           │
                                           ▼
                                 Execution Rails
                                 (Razorpay Orders / UPI Reserve / Cards)
```

### Strategic System Flow
```text
ANY AI MODEL / AGENT
GPT • Claude • Gemini • Open Models
│
▼
AGENT ADAPTERS
MCP • A2A • ACP • AP2 • UCP • REST
│
▼
┌───────────────────────────┐
│           ACG             │
│  MERCHANT CONTROL PLANE   │
│                           │
│ Identity & Agent Trust    │
│ Financial Action Ingress  │
│ Canonical Intent IR       │
│ Buyer Mandate (Ed25519)   │
│ Commerce Truth (DB Price) │
│ Merchant Policy (v1 / v2) │
│ Budget & Inventory Lock   │
│ Instant Revocation        │
│ Webhook Reconciliation    │
│ Tamper-Evident Audit      │
└─────────────┬─────────────┘
              │
      AUTHORIZED ACTION
              │
              ▼
    PAYMENT INTELLIGENCE
       Razorpay Vulcan
    [ADVISORY / TELEMETRY]
              │
              ▼
      RAZORPAY EXECUTION
     Orders / UPI / Cards
              │
              ▼
    WEBHOOK / AUDIT LOG
```

---

## 📊 3. Complete 10-Slide Pitch Blueprint

### Slide 1: Title & Positioning
* **Headline:** Agent Commerce Gateway (ACG / MACCP)
* **Subtitle:** Merchant-Side Control Plane for Autonomous Financial Actions on Razorpay
* **Badge Row:** 50/50 Passing Automated Tests · 19/19 Live HTTP Pentest Passed · 265ms Cold-Start · Zero-Mock
* **Visual:** Sleek dark-mode Luxury Edition UI mockup showing the live control plane.

### Slide 2: The Critical Problem in 2026
* **Headline:** The Fragility of Agentic Commerce
* **Key Points:**
  1. *Prompt Injection & Arithmetic Hallucination:* An LLM claims a ₹14,000 item costs ₹1,400.
  2. *Subagent Concurrency Races:* 10 parallel subagents race to exhaust a single ₹5,000 mandate.
  3. *Unbounded Agent Scope:* No distinction between a procurement agent, a refund agent, and a payout agent.
* **The Fatal Trap:** Handing raw API keys or payment tokens to probabilistic models.

### Slide 3: The 2026 Ecosystem Reality
* **Headline:** Razorpay Sprint 2026 & Emerging Standards
* **Key Points:**
  * Razorpay is leading agentic commerce: MCP Server, ChatGPT Apps, Sarvam Voice Commerce, and RazorpayX Agentic Banking.
  * Google/AP2/UCP and Linux Foundation A2A are standardizing wire protocols.
  * *The Gap:* None of these manage the merchant's internal database state, inventory reservations, active policy DSL mutations, or idempotent rail reconciliation.
* **Punchline:** Protocols standardize intent; ACG protects merchant assets.

### Slide 4: System Architecture & Separation of Concerns
* **Headline:** Deterministic Control Plane Architecture
* **Mermaid/Architecture Diagram:**
  * Layer 1: Probabilistic Ingress (Any Model / MCP / A2A / AP2 / UCP / TAP)
  * Layer 2: ACG Control Plane (Canonical Intent IR $\rightarrow$ Ed25519 $\rightarrow$ Catalog Truth $\rightarrow$ Policy $\rightarrow$ ACID Lock)
  * Layer 3: Payment Intelligence (Razorpay Vulcan telemetry — non-authoritative)
  * Layer 4: Execution Rails (Razorpay Orders with `receipt = intent_id`)
* **Callout:** Intelligence provides signals; ACG retains authority.

### Slide 5: The 7 Deterministic Defense Layers
* **Headline:** How ACG Eliminates Hallucination from Financial Execution
* **Table / Visual Grid:**
  1. *Cryptographic Mandate:* Noble Ed25519 signed buyer budget + instant SQLite revocation.
  2. *Commerce Truth:* Strict DB re-query for pricing, taxes (18% GST), and stock.
  3. *Policy Engine:* Dynamic versioned DSL (`pol_v1.0.0` vs `pol_v2.0.0`) enforced at execution.
  4. *Dual-Resource ACID Lock:* `BEGIN IMMEDIATE` locks mandate budget + SKU stock simultaneously.
  5. *Idempotent Settlement:* `receipt = intent_id` prevents duplicate charges across retries.
  6. *Deduplicated Webhooks:* Monotonic state machine with `x-razorpay-event-id` deduplication.
  7. *Tamper-Evident Audit:* SHA-256 forward hash chain logging every state transition.

### Slide 6: Evidence-Backed Protocol & Model Agility
* **Headline:** Model-Agnostic, Protocol-Agnostic, Honest Interoperability
* **Status Table:**
  * Native ACG & REST: **IMPLEMENTED + TESTED** (Live)
  * MCP, A2A, ACP, AP2, UCP: **ADAPTER READY / TEST PENDING**
  * Visa TAP: **TRUST ADAPTER DESIGN**
  * Razorpay Vulcan: **ARCHITECTURE READY** (No public developer API; modeled downstream telemetry)
  * Razorpay Rails: **LIVE** (Direct Sandbox integration)
* **Key AP2 Note:** Accommodates AP2 v0.2 non-deterministic ECDSA JWT mandate binding without compromising ACG's internal Ed25519 primitive.

### Slide 7: Hard Empirical Proof (Zero-Mock Evidence)
* **Headline:** Tested Against Real Adversaries & Production Latency
* **Metrics Callouts:**
  * **50/50 Tests Passing:** Across 6 test suites including cryptography, truth engine, adapters, and UI.
  * **19/19 Live HTTP Pentest:** Executed against live network sockets (SQLi, replay attacks, forged HMAC, concurrency races).
  * **265.91 ms Cold-Start:** Sub-300ms time-to-first-AI-transaction.
  * **10–12 Minute Onboarding:** Zero-mock merchant integration time.

### Slide 8: Live Product Demo (Tab 01 to Tab 09)
* **Headline:** Live Luxury Control Plane Walkthrough
* **Screenshots/Live Screen:**
  * Tab 01: Real-time System Topology with SVG animated connection lines.
  * Tab 02: Interactive Scenario Runner (Happy Path, Mandate Overstep, Concurrency Race, Refund).
  * Tab 06: Dual-Resource Atomic Reservation Engine table.
  * Tab 07: Cryptographic SHA-256 Audit Ledger with live hash tamper detection.
  * Tab 09: Agent Compatibility Matrix & Ingress Testbench.

### Slide 9: Merchant Value Proposition & ROI
* **Headline:** Why Merchants & Razorpay Both Win
* **For Merchants:**
  * Zero risk of LLM price hallucination or budget drain.
  * Real-time policy mutation (`PUT /v1/merchant/policy`) with zero downtime.
  * Instant mandate revocation (`POST /v1/mandates/revoke`) for rogue agents.
* **For Razorpay:**
  * Unlocks high-value enterprise merchants who currently block autonomous AI spending.
  * Clean, idempotent order traffic with pre-validated budget and inventory.

### Slide 10: Conclusion & Technical Defense
* **Headline:** The Future of Agentic Commerce on Razorpay
* **Closing Quote:**
  > **“The agent decided what it wanted.**  
  > **The control plane decided whether it was allowed.”**
* **Links:** Live Deployed Control Plane (`agent-commerce-gateway.web.app`) · GitHub Repository

---

## ⏱️ 4. The 4-Minute Live Demo Script (Rehearsed Timeline)

| Time | Phase | Action / Screen | What to Say (Verbatim Guide) |
| :--- | :--- | :--- | :--- |
| **0:00 – 0:45** | **Phase 1: Adversarial Overstep** | Click **Scenario 2** in Tab 02 (or terminal `npm run demo`) | *“Here an autonomous agent running on Claude attempts to purchase an Executive Ergonomic Chair for ₹14,160 against a ₹5,000 budget mandate. Notice what happens: ACG immediately intercepts the request at the gate with HTTP 403 MANDATE_BUDGET_EXCEEDED. The Razorpay Orders API is NEVER invoked. The model can propose anything; it cannot authorize anything.”* |
| **0:45 – 1:45** | **Phase 2: Golden Path Checkout** | Click **Scenario 1** in Tab 02 | *“Now the agent submits a valid request for an Optical Mouse. ACG re-queries the merchant SQLite database, verifies the true price (₹1,800 + 18% GST = ₹2,124), evaluates merchant policy, acquires an atomic dual reservation, logs Vulcan routing hints, and creates an idempotent Razorpay order with receipt equal to intent ID. A simulated payment.captured webhook confirms the order monotonically.”* |
| **1:45 – 2:45** | **Phase 3: High-Concurrency Race** | Click **Scenario 3** in Tab 02 | *“Now we unleash the hardest failure mode in agentic commerce: subagent double-spending. Two parallel agents concurrently attack the remaining ₹2,876 budget. ACG's SQLite BEGIN IMMEDIATE lock serializes the execution: exactly one agent is admitted with HTTP 201 Created, while the second is deterministically blocked with HTTP 409 MANDATE_EXHAUSTED. Zero overspend.”* |
| **2:45 – 3:30** | **Phase 4: Safe Post-Capture Refund** | Click **Scenario 4** in Tab 02 | *“What happens when a warehouse stockout occurs after payment capture? ACG evaluates the merchant's policy DSL. Because auto-refund is enabled, it dispatches an idempotent refund to Razorpay using the official X-Refund-Idempotency header, preventing duplicate reversals.”* |
| **3:30 – 4:00** | **Phase 5: SHA-256 Audit Integrity** | Navigate to **Tab 07** and click **Verify Ledger Integrity** | *“Finally, every decision, signature verification, policy check, and rail call is committed to a cryptographic SHA-256 hash chain. When I click ‘Verify Ledger Integrity’, ACG traverses all blocks. If an attacker tampers with a single byte in the database, the hash chain breaks instantly. Complete tamper-evident audit integrity.”* |

---

## 🛡️ 5. Judge Q&A Defense (Anticipating Hard Questions)

### Q1: "Why wouldn't Razorpay just build this natively?"
> **Answer:** *"Razorpay owns payment execution rails and agentic experiences like the Razorpay MCP Server and ChatGPT apps. But the merchant owns commerce state: real-time SKU stock, catalog pricing, profit margins, and warehouse logistics. ACG is reusable merchant middleware that bridges these two domains. Razorpay remains the authoritative payment rail while ACG provides the merchant-side control surface that enforces merchant-specific rules, prevents inventory races, and verifies buyer mandates before invoking Razorpay APIs."*

### Q2: "Why isn't this solved by agent protocols like ACP, AP2, or UCP?"
> **Answer:** *"ACP, AP2, and UCP standardize agent communication and mandate schemas over the wire. However, they do not manage the merchant's internal database state, inventory reservations, active policy DSL mutations, or payment gateway reconciliation. Furthermore, recent research (arXiv:2608.23858) proves valid mandate signatures alone fail to prevent pre-authorization tampering. ACG provides the merchant-side execution layer that converts external protocols into canonical internal intents."*

### Q3: "If Razorpay launched Vulcan (AI Foundation Model), why is ACG needed?"
> **Answer:** *"Vulcan makes payment execution intelligent (routing optimization, network-level fraud detection across 3T data points). ACG makes agent authorization deterministic (cryptographic mandate verification, catalog truth, merchant policy, dual-resource ACID locking). Vulcan answers 'Given an authorized payment, how can it succeed safely and efficiently?'; ACG answers 'Should this agent be permitted to initiate this payment at all?' We deliberately keep intelligence advisory and control authoritative."*

### Q4: "Does ACG sit in front of all Razorpay AI experiences?"
> **Answer:** *"No. Razorpay natively operates consumer-facing and operational AI surfaces—including the Razorpay MCP server across Claude/Cursor/Windsurf/VS Code, ChatGPT Apps, Sarvam voice commerce, and RazorpayX agentic banking. ACG is an optional merchant-side control boundary that governs agent-originated financial actions before they reach payment intelligence and execution rails."*

### Q5: "How is subagent double-spending prevented across parallel sessions?"
> **Answer:** *"In agentic commerce, authorization is a stateful resource. ACG's Dual-Resource Reservation Engine uses SQLite's `BEGIN IMMEDIATE` transaction locking to serialize concurrent reservation requests. When two subagents race to spend the remaining balance of a mandate, exactly one transaction obtains the lock and decrements the balance, while the second is deterministically rejected with `HTTP 409 MANDATE_EXHAUSTED`."*
