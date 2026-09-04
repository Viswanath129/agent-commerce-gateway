# Agent Commerce Gateway (ACG / MACCP)
## Evaluator One-Page Summary | Razorpay AI Buildathon — Track 01

> **“AI proposes. ACG authorizes. Razorpay executes.”**  
> **“The model can propose anything. It cannot authorize anything.”**

---

### 1. Problem & Positioning
Autonomous AI agents can formulate carts and trigger payments, but merchants cannot allow untrusted LLMs to dictate prices, overstep budgets, or race against inventory. ACG sits as an optional **merchant-side control plane** between upstream agents (ChatGPT, Claude, Gemini, Cursor) and downstream payment execution (Razorpay).

---

### 2. Core Security & Control Pipeline
```text
ANY AI AGENT  ──►  ADAPTER REGISTRY  ──►  CANONICAL INTENT  ──►  MANDATE CHECK (Ed25519)
      │
      ▼
MERCHANT TRUTH (DB Price) ──► POLICY ENGINE ──► DUAL ATOMIC LOCK ──► RAZORPAY EXECUTION
```

---

### 3. Verified Empirical Results

| Metric | Target | Verified Value | Status |
| :--- | :--- | :--- | :---: |
| **Automated Test Suite** | 100% Pass Rate | **77 / 77 Tests Passed** (9 Test Suites) | **PASS** |
| **Adversarial / Security Pentest**| Zero Breaches | **19 / 19 Live HTTP Vectors Blocked** | **PASS** |
| **Unauthorized Financial Paths** | Zero Tolerance | **0 Paths Observed** | **PASS** |
| **Cold-Start Transaction Speed** | Sub-500 ms SLA | **303.81 ms** End-to-End Order Creation | **PASS** |
| **Merchant Onboarding Velocity** | Rapid Deployment | **10–12 minutes** Configuration Setup | **PASS** |
| **Audit Ledger Provenance** | Tamper-Evident | **307 SHA-256 Chained Blocks Verified** | **PASS** |

---

### 4. Ecosystem Interoperability
* **`LIVE`**: Native ACG, REST Ingress, Razorpay Sandbox API.
* **`ADAPTER READY`**: MCP (`tools/call`), A2A (Linux Foundation), ACP (1.0), AP2 (0.2.0), UCP (1.2).
* **`DESIGN`**: Visa TAP (Hardware Enclaves).
* **`ADVISORY`**: Razorpay Vulcan Intelligence (Downstream risk and optimal rail modeling).

---

### 5. Architectural Boundary & Release Status
* **Status:** **PASS WITH OBSERVATIONS** (Verified Sandbox Candidate).
* **Boundary:** Single-node SQLite reference implementation verified for ACID transaction atomicity. Multi-instance production roadmap documented for PostgreSQL and Redis distributed locking.
