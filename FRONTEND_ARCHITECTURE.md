# ACG Front-End Architecture & Control Plane Specification

**System:** Agent Commerce Gateway (ACG / MACCP)  
**Target:** Razorpay AI Buildathon — Track 01  
**Design Philosophy:** Luxury Editorial FinTech $\times$ Deterministic Technical Precision $\times$ Zero-Mock Control Plane  

---

## 1. Overview & Core Tenets

The ACG Front-End is not a cosmetic mockup; it is a **real-time merchant control plane window** into the authoritative SQLite and Razorpay rails backend.

1. **Zero Client Authority:** The client never decides pricing, authorization, stock, or ledger commits.
2. **Centralized API Layer:** No raw `fetch()` calls scattered across components. All communication flows through typed API modules with automatic timeout handling via `AbortController` and typed `ApiError` structures.
3. **Deterministic State Synchronization:** Every mutation (mandate revocation, policy update, live demo scenario) invalidates and refetches the authoritative SQLite database records.
4. **Honest Empty States:** If no data exists, the UI renders explicit empty states ("No transactions yet") rather than mock placeholders.

---

## 2. Component Hierarchy & Directory Layout

```text
frontend/
├── index.html                    # Vite HTML entry with serif/mono fonts & test anchors
├── src/
│   ├── main.tsx                  # React 19 root bootstrap & provider injection
│   ├── app/
│   │   ├── App.tsx               # Orchestrator: polling, scenario executions, view router
│   │   ├── router.tsx            # Hash-based deep link routing (#overview, #live-demo, #transactions/:id)
│   │   └── providers.tsx         # TanStack Query client & global configuration
│   │
│   ├── styles/
│   │   ├── tokens.css            # Master color palette, spacing, and typography tokens
│   │   ├── globals.css           # Custom scrollbars, reset, base styles
│   │   └── motion.css            # Framer Motion transitions & reduced motion accessibility
│   │
│   ├── lib/
│   │   ├── api/                  # Authoritative Typed API Client Suite
│   │   │   ├── types.ts          # Zero-Mock TypeScript models
│   │   │   ├── apiClient.ts      # Base HTTP client with Bearer auth & timeout handling
│   │   │   ├── dashboardApi.ts   # GET /dashboard/metrics
│   │   │   ├── transactionApi.ts # GET /dashboard/transactions & /transaction/:id
│   │   │   ├── mandateApi.ts     # GET /dashboard/mandates & POST /v1/mandates/revoke
│   │   │   ├── policyApi.ts      # GET /dashboard/policies & PUT /v1/merchant/policy
│   │   │   ├── reservationApi.ts # GET /dashboard/reservations
│   │   │   ├── auditApi.ts       # GET /dashboard/audit & GET /audit/integrity
│   │   │   ├── healthApi.ts      # GET /dashboard/health
│   │   │   ├── demoApi.ts        # POST /dashboard/demo/run-scenario
│   │   │   ├── compatibilityApi.ts # GET /dashboard/compatibility & POST /test-adapter
│   │   │   └── index.ts          # Unified API re-export
│   │   ├── constants/            # Navigation items, scenarios, tenant constants
│   │   └── formatters/           # formatInr, formatTimestamp, truncateHash
│   │
│   ├── components/
│   │   ├── ui/                   # 15 Luxury Editorial Component System
│   │   │   ├── Button.tsx        # Primary, Outline, Ghost, Danger button states
│   │   │   ├── Badge.tsx         # Accent, Success, Danger, Warning, Live badges
│   │   │   ├── Panel.tsx         # Dark obsidian card container with header slot
│   │   │   ├── Metric.tsx        # Tabular data KPI with live status indicators
│   │   │   ├── DataTable.tsx     # Monospaced right-aligned data grid with empty states
│   │   │   ├── Timeline.tsx      # Vertical 9-stage decision trajectory with record hashes
│   │   │   ├── CodeBlock.tsx     # JSON payload inspector with syntax styling
│   │   │   ├── Modal.tsx         # Confirmation dialogs (e.g. Mandate Revocation)
│   │   │   ├── Drawer.tsx        # Flyout technical inspection panel
│   │   │   ├── SectionHeader.tsx # Serif header typography with gold eyebrow
│   │   │   ├── StatusIndicator.tsx # Pulsing operational indicators
│   │   │   ├── EmptyState.tsx    # Honest zero-mock state renderer
│   │   │   ├── ErrorState.tsx    # Controlled failure boundary
│   │   │   ├── Skeleton.tsx      # Pulse loaders during network fetching
│   │   │   └── index.ts          # Barrel export
│   │   │
│   │   ├── layout/
│   │   │   ├── AppShell.tsx      # 2-column persistent layout
│   │   │   ├── Sidebar.tsx       # Fixed 280px left navigation with active champagne border
│   │   │   └── Header.tsx        # Fixed top bar with MODE: SANDBOX, RAZORPAY, and SYNC
│   │   │
│   │   └── features/
│   │       └── ExecutionPipeline.tsx # Framer Motion linework causality pipeline
│   │
│   └── features/                 # 9 Dedicated Control Plane Views
│       ├── overview/             # Screen 01: Overview (Live KPIs, Pipeline, Activity)
│       ├── live-demo/            # Screen 02: Live Demo (5 Real Scenarios, Causality Pipeline)
│       ├── transactions/         # Screen 03: Transactions & 9-Stage Decision Inspector
│       ├── mandates/             # Screen 04: Spend Mandates & Ed25519 Revocation
│       ├── policies/             # Screen 05: Merchant Policy DSL & Commerce Truth Catalog
│       ├── reservations/         # Screen 06: Atomic Reservations & Live Concurrency Race
│       ├── audit/                # Screen 07: SHA-256 Chained Audit Ledger & Verification
│       ├── system-health/        # Screen 08: 7-Node Operational Health Index
│       └── compatibility/        # Screen 09: Agent Compatibility Matrix & Testbench
```

---

## 3. Data Flow & Zero-Mock Guarantee

Every state rendered in the user interface obeys a deterministic unidirectional data flow:

```text
[ Browser Event / Hash Navigation / Button Click ]
                     │
                     ▼
       [ App.tsx Orchestrator / Custom Hook ]
                     │
                     ▼
        [ Typed API Client Module ]
      (e.g., demoApi.runScenario('concurrent'))
                     │
                     ▼
          [ Fastify Gateway Ingress ]
        (HTTP POST /dashboard/demo/run-scenario)
                     │
                     ▼
    [ Authoritative Backend Control Subsystem ]
  (PolicyEngine / ReservationEngine / SQLite DB / Razorpay Rails)
                     │
                     ▼
       [ Authoritative HTTP JSON Response ]
                     │
                     ▼
     [ React State Update & Query Refetch ]
                     │
                     ▼
    [ Framer Motion Causality Transition ]
```

Under no circumstance does the front-end fabricate GMV, order IDs, mandate balances, or transaction counts. If a merchant starts with a clean database, the metrics honestly read `₹0.00` and `0 Intents`.

---

## 4. Build & Distribution Pipeline

- **Compiler:** TypeScript 5.7 (`tsc`) compiles backend Node modules to `dist/`.
- **Bundler:** Vite 6.4 (`vite build`) bundles React 19, Framer Motion, and Tailwind into `public/assets/index.js` and `public/assets/index.css`.
- **Fastify Static Integration:** `src/gateway/router.ts` serves `public/index.html` on `GET /`, and provides native static routing for `/assets/*` and `/dist/*`.
