# ACG Trust Boundaries & Authority Isolation

## Defining the Non-Bypassable Merchant Perimeter

---

## 1. Primary Trust Zones

```text
┌─────────────────────────────────────────────────────────────┐
│  ZONE 0: UNTRUSTED / EXTERNAL                               │
│  • AI Agents, LLM Output, Chat Interfaces, Subagents        │
│  • Assumption: Prompt injections, hallucinations, oversteps  │
└──────────────────────────────┬──────────────────────────────┘
                               │ Canonical Ingress
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  ZONE 1: NORMALIZATION BOUNDARY                             │
│  • Protocol Adapters (MCP, A2A, ACP, AP2, UCP, TAP)          │
│  • Strips non-standard formatting; extracts Canonical IR     │
└──────────────────────────────┬──────────────────────────────┘
                               │ Structured Validation
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  ZONE 2: AUTHORITATIVE CONTROL PLANE (MERCHANT PERIMETER)   │
│  • Ed25519 Mandate Verification                             │
│  • Merchant Database Truth & Active Policy Engine           │
│  • Dual-Resource Atomic Reservation                         │
└──────────────────────────────┬──────────────────────────────┘
                               │ Authorized Execution
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  ZONE 3: FINANCIAL SETTLEMENT INFRASTRUCTURE                │
│  • Razorpay Orders API, Payment Capture, Banking Rails      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Invariant Rules
1. **Zero Trust in Agent Arithmetic:** The gateway calculates pricing exclusively from SQLite.
2. **Authority Primacy:** Model prompts have zero authority; only Ed25519 signatures from recognized buyer principals can establish a budget.
3. **Fail Closed:** Any boundary failure aborts before financial rails are touched.
