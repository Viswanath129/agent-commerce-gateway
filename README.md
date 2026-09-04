# Agent Commerce Gateway

### AI proposes. ACG authorizes. Razorpay executes.

> **“ACG does not decide what the AI should buy. It decides whether the AI is allowed to cause the financial action.”**

A merchant-side authorization control plane for AI-originated financial actions. It converts autonomous agent intent into a canonical financial action, verifies delegated human authority via Ed25519 signatures, grounds decisions in merchant catalog truth, enforces merchant policy and resource constraints, and only then permits execution through payment settlement infrastructure. ACG is complementary to payment execution infrastructure.

---

```text
========================================================================================
                               VERIFIED EVIDENCE SUMMARY
========================================================================================
  77 / 77 Tests Passed                   │  19 / 19 Adversarial Vectors Blocked
  0 Unauthorized Financial Impact Paths  │  303.81 ms Cold-Run Transaction Latency
  307 SHA-256 Audit Blocks Verified      │  10–12 min Measured Merchant Onboarding
  Razorpay Sandbox Execution: PASS       │  Production Build (TypeScript / Vite): PASS
========================================================================================
```

[![Automated Tests](https://img.shields.io/badge/Automated_Tests-77%2F77_Passing-brightgreen.svg)]()
[![Live Pentest](https://img.shields.io/badge/Live_HTTP_Pentest-19%2F19_Passed-brightgreen.svg)]()
[![Authority Model](https://img.shields.io/badge/Authority_Model-Ed25519_Signed_Mandates-purple.svg)]()
[![Audit Ledger](https://img.shields.io/badge/Audit_Ledger-307_Blocks_Verified-orange.svg)]()
[![Cold-Start Benchmark](https://img.shields.io/badge/Cold--Start_Tx-303.81ms-blueviolet.svg)]()
[![Merchant Onboarding](https://img.shields.io/badge/Merchant_Setup-10--12_min-success.svg)]()

---

## Architecture & System Flow

```text
AI MODEL / AGENT (Proposer)
       │
       ▼
PROTOCOL / AGENT ADAPTER (Normalizer)
       │
       ▼
CANONICAL FINANCIAL INTENT (Intermediate Representation)
       │
       ▼
MANDATE VERIFICATION (Ed25519 & Revocation Registry)
       │
       ▼
MERCHANT TRUTH (Authoritative Catalog Price & Stock)
       │
       ▼
MERCHANT POLICY (Versioned Policy DSL Evaluation)
       │
       ▼
ATOMIC BUDGET + INVENTORY RESERVATION (Dual-Resource Lock)
       │
       ▼
AUTHORIZATION (Deterministic Reason Code)
       │
       ▼
RAZORPAY EXECUTION (receipt = intent_id Idempotent Order)
       │
       ▼
WEBHOOK RECONCILIATION (HMAC SHA-256 & Event Deduplication)
       │
       ▼
TAMPER-EVIDENT SHA-256 AUDIT LEDGER (Provenance Verification)
```

---

## Core Principle

> **“The model can propose anything. It cannot authorize anything.”**

---

## 4-Minute Demonstration

1. **Authorized Purchase (0:30):** Valid agent checkout executes in 303.81 ms with Ed25519 verification and database pricing.
2. **Budget Overstep (1:10):** Agent requests ₹14,160.00 against ₹5,000.00 cap; blocked at Phase 4 (`HTTP 403`). Razorpay is never touched.
3. **Double-Spend Race (1:50):** 10 parallel subagents race for residual funds; exactly 1 succeeds, 9 blocked (`HTTP 409`).
4. **Mandate Revocation (2:40):** Human principal revokes mandate; subsequent checkout attempts return `HTTP 403 MANDATE_REVOKED`.
5. **Audit & Reconciliation (3:20):** Duplicate webhook rejected (`200 DUPLICATE_IGNORED`); SHA-256 ledger validates 307 blocks intact.

> **“The agent decided what it wanted. The control plane decided whether it was allowed.”**

*Demo Runbook:* [`docs/demo/runbook.md`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/docs/demo/runbook.md)

---

## Quick Start

### Prerequisites
* Node.js v20.x or v22.x LTS
* npm v10+

### Installation & Execution Sequence
```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Run automated test suite (77 tests across 9 test suites)
npm test

# 4. Run live adversarial penetration test suite (19 attack vectors)
npm run pentest

# 5. Verify cryptographic SHA-256 audit ledger hash chain (307 blocks)
npm run audit:verify

# 6. Execute cold-start latency benchmark
npm run benchmark

# 7. Run 5-phase live simulation demo
npm run demo

# 8. Compile production build
npm run build

# 9. Start gateway server
npm start
```

---

## Protocol Compatibility

| Surface / Protocol | Status | Specification / Role |
| :--- | :---: | :--- |
| **Native ACG Protocol** | **`LIVE`** | Direct Ed25519 Canonical Intent |
| **REST Financial Ingress** | **`LIVE`** | Standard JSON Ingress |
| **Razorpay Sandbox API** | **`LIVE`** | Core Settlement Rail (`receipt = intent_id`) |
| **Model Context Protocol (MCP)** | **`ADAPTER READY`** | JSON-RPC `tools/call` normalization (`acg_checkout`) |
| **Agent2Agent Protocol (A2A)** | **`ADAPTER READY`** | Linux Foundation A2A commerce task unwrap |
| **Agentic Commerce Protocol (ACP)** | **`ADAPTER READY`** | Cart & order envelope adapter |
| **Agent Payments Protocol (AP2)** | **`ADAPTER READY`** | Authorization container normalization |
| **Universal Commerce Protocol (UCP)**| **`ADAPTER READY`** | Assistant journey order lines adapter |
| **Visa Trusted Agent Protocol (TAP)**| **`DESIGN`** | Hardware enclave attestation container |
| **Razorpay Vulcan Intelligence** | **`ARCHITECTURE READY`** | Downstream routing hints & risk signals (Advisory Only) |

> **Note on Classification:** `ADAPTER READY` means the normalization boundary is implemented and tested according to the project's adapter test surface; it does not claim production interoperability with every external implementation.

*Detailed matrix:* [`docs/protocols/compatibility.md`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/docs/protocols/compatibility.md)

---

## Deployment Status & Production Boundary

```text
========================================================================================
STATUS: PASS WITH OBSERVATIONS
DEPLOYMENT STATUS: READY FOR CONTROLLED SANDBOX / BUILDATHON EVALUATION
========================================================================================
```

### Verified Reference Implementation
Single-node SQLite ACID persistence model with serialized in-process transaction coordination.

### Production Scaling Architecture
Production scaling requires migration from the verified single-node SQLite reference implementation to a distributed persistence architecture such as PostgreSQL, with appropriate transactional resource coordination and enterprise-managed key-management infrastructure. The exact distributed locking and key-management technologies are deployment decisions rather than requirements of the ACG authorization model.

*Detailed analysis:* [`docs/operations/production-gap-analysis.md`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/docs/operations/production-gap-analysis.md)

---

## Repository Structure

```text
/
├── README.md                           # Executive entry point
├── AGENTS.md                           # Operating guidelines and security invariants
├── CONTRIBUTING.md                     # Contributor guidance and conventional commits
├── SECURITY.md                         # Responsible disclosure and security invariants
├── CHANGELOG.md                        # Version history and release notes
├── LICENSE                             # MIT License
├── package.json                        # Scripts and dependencies
│
├── src/
│   ├── core/                           # Cryptography, policy, truth engine, reservation
│   │   └── __tests__/                  # 9 test suites (77 automated tests)
│   ├── gateway/                        # Fastify router and scoped bearer auth
│   ├── adapters/                       # Protocol adapters (MCP, A2A, ACP, AP2, UCP, TAP)
│   ├── rails/                          # Razorpay client, webhooks, Vulcan advisory
│   ├── store/                          # SQLite database schema and SHA-256 audit ledger
│   └── demo/                           # Benchmark, pentest runner, and simulation scripts
│
├── frontend/                           # React 19 + Tailwind v4 Luxury Dashboard SPA
├── tests/                              # Unit, integration, and adversarial test mirrors
├── docs/                               # 15 standardized architecture & security guides
│   ├── architecture/                   # System design, control plane, and financial action model
│   ├── security/                       # Threat model, authorization, crypto, concurrency
│   ├── protocols/                      # Adapter specifications and compatibility matrix
│   ├── integrations/                   # Razorpay sandbox integration contracts
│   ├── operations/                     # Production gap analysis, config, and troubleshooting
│   ├── verification/                   # Adversarial testing, benchmark, and evidence index
│   └── demo/                           # 4-minute live demonstration runbook
│
├── evidence/                           # Reproducibility evidence for reviewers
│   ├── automated-tests/                # Test suite execution artifacts
│   ├── adversarial/                    # Live penetration test raw output
│   ├── benchmark/                      # Cold-start latency milestone data
│   ├── audit/                          # Cryptographic hash verification proof
│   └── razorpay/                       # Webhook and order rail contracts
│
└── reports/
    └── pdf/                            # 11 individual PDFs + Consolidated Master PDF
```

---

## Evaluator Evidence & PDF Reports

* 📄 **Master Consolidated PDF:** [`reports/pdf/ACG_FINAL_EVIDENCE_PACKAGE.pdf`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/reports/pdf/ACG_FINAL_EVIDENCE_PACKAGE.pdf)
* 📄 **Executive Overview PDF:** [`reports/pdf/ACG_EXECUTIVE_OVERVIEW.pdf`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/reports/pdf/ACG_EXECUTIVE_OVERVIEW.pdf)
* 📄 **Security Evidence PDF:** [`reports/pdf/ACG_SECURITY_EVIDENCE.pdf`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/reports/pdf/ACG_SECURITY_EVIDENCE.pdf)
* 📄 **Evaluator One-Page Summary:** [`reports/pdf/ACG_EVALUATOR_ONE_PAGE.pdf`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/reports/pdf/ACG_EVALUATOR_ONE_PAGE.pdf)
* 📄 **Final Release Sign-Off:** [`reports/pdf/ACG_FINAL_RELEASE_SIGNOFF.pdf`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/reports/pdf/ACG_FINAL_RELEASE_SIGNOFF.pdf)

---

## License

This project is licensed under the MIT License — see the [`LICENSE`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/LICENSE) file for details.
