# ACG Front-End Architecture & Control Plane Specification

**System:** Agent Commerce Gateway (ACG / MACCP)  
**Target:** Razorpay AI Buildathon — Track 01  
**Design Philosophy:** Luxury Editorial FinTech $\times$ Deterministic Technical Precision  

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
frontend/src/
├── styles/
│   └── tokens.css                # Master CSS variables (Colors, Typography, Spacing, Transitions)
├── lib/
│   ├── api/                      # Typed API Client Suite
│   │   ├── types.ts              # Zero-Mock TypeScript Entity & Response Models
│   │   ├── apiClient.ts          # Base Fetch Client (Timeouts, AbortController, Error Parsing)
│   │   ├── dashboardApi.ts       # GET /dashboard/metrics
│   │   ├── transactionApi.ts     # GET /dashboard/transactions & /transaction/:id
│   │   ├── mandateApi.ts         # GET /dashboard/mandates & POST /v1/mandates/revoke
│   │   ├── policyApi.ts          # GET /dashboard/policies, GET /catalog, PUT /v1/merchant/policy
│   │   ├── reservationApi.ts     # GET /dashboard/reservations
│   │   ├── auditApi.ts           # GET /dashboard/audit & GET /audit/integrity
│   │   ├── healthApi.ts          # GET /dashboard/health
│   │   ├── demoApi.ts            # POST /dashboard/demo/run-scenario & POST /v1/agent/checkout
│   │   └── index.ts              # Barrel export
│   │
│   └── hooks/                    # Reactive Custom Hooks
│       ├── useCatalog.ts         # Catalog ground truth & stock calculation helpers
│       ├── useMetrics.ts         # Dashboard KPIs with configurable polling
│       ├── apiHooks.ts           # Comprehensive hook collection for all entities
│       └── index.ts              # Barrel export
│
├── components/
│   ├── ui/                       # 21st.dev Luxury Component Layer
│   │   ├── Button.tsx            # Styled action buttons (Primary, Secondary, Outline, Danger)
│   │   ├── Badge.tsx             # Technical status badges (Gold, Success, Error, Warning)
│   │   ├── Panel.tsx             # Bordered surface container with header/action slots
│   │   ├── Metric.tsx            # KPI metric presentation cards
│   │   ├── DataTable.tsx         # Monospace tabular grid with empty/loading skeletons
│   │   ├── Timeline.tsx          # Vertical decision & audit trajectory
│   │   ├── StatusIndicator.tsx   # Real-time pulsing subsystem health indicators
│   │   ├── SectionHeader.tsx     # Editorial serif heading with track subtitle
│   │   ├── CodeBlock.tsx         # Monospace JSON / cURL display with copy action
│   │   ├── Modal.tsx             # Minimalist backdrop dialogs
│   │   ├── Skeleton.tsx          # Subtle skeleton loaders (Tables, Metrics)
│   │   ├── ErrorAlert.tsx        # Specific 401/403/409/500 Explanatory Error UX
│   │   ├── States.tsx            # Empty, Loading, and Error State Fallbacks
│   │   └── index.ts              # Barrel export
│   │
│   ├── features/
│   │   └── ExecutionPipeline.tsx # 7-Phase Deterministic Execution Pipeline Component
│   │
│   └── layout/
│       ├── Sidebar.tsx           # Persistent Navigation (Tabs 01-08, DB state, Merchant info)
│       ├── Header.tsx            # Global Top Status Bar (MODE, TENANT, RAILS, SYNC)
│       └── AppShell.tsx          # Layout shell wrapping sidebar, header, and main stage
│
├── views/                        # 8 Modular Feature Views
│   ├── OverviewView.tsx          # Tab 01: Metrics, 7-Phase Pipeline, Live Activity Ledger
│   ├── LiveDemoView.tsx          # Tab 02: Adversarial Scenarios & Real Execution Trace
│   ├── TransactionsView.tsx      # Tab 03: Decision Timeline, Session Data, Raw Record
│   ├── MandatesView.tsx          # Tab 04: Ed25519 Delegations & Revocation Console
│   ├── PoliciesView.tsx          # Tab 05: Merchant Policy DSL & SQLite Catalog Truth
│   ├── ReservationsView.tsx      # Tab 06: Dual-Resource ACID Lock Table & Concurrency Runner
│   ├── AuditLedgerView.tsx       # Tab 07: SHA-256 Block Stream & Cryptographic Hash Verifier
│   └── SystemHealthView.tsx      # Tab 08: Operational Probes & MCP/REST Ingress Snippets
│
└── App.tsx                       # Root React Container with Hash Routing & State Sync
```

---

## 3. Design System & CSS Tokens

The visual language follows **Luxury Editorial FinTech**:
* **Surfaces:** Graphite / Warm Black (`#10100F`, `#14140E`, `#1C1B14`).
* **Typography:**
  * **Display:** Editorial Serif (`Bodoni Moda` / `Cormorant Garamond`).
  * **UI & Controls:** Neutral Geometric Sans (`Inter`).
  * **Technical Data:** Tabular Monospace (`IBM Plex Mono` / `JetBrains Mono`).
* **Accents:** Restrained Champagne Gold (`#D1C5A2`) and Muted Olive Green (`#C9CAA9`).
* **Accessibility:** Full `prefers-reduced-motion` compliance, ARIA attributes, semantic headings, and keyboard navigation.

---

## 4. State Management & Server Synchronization

* **Client State:** Kept minimal (active tab, selected transaction, modal toggles, in-flight action spinners).
* **Server State:** Polled every 5 seconds or refetched immediately after any mutation (`POST /v1/mandates/revoke`, `PUT /v1/merchant/policy`, `POST /dashboard/demo/run-scenario`).
* **Error UX:** Granularly distinguishes between:
  * `403 MANDATE_BUDGET_EXCEEDED`: Explains that principal mandate cap intercepted rogue spending.
  * `409 MANDATE_EXHAUSTED`: Explains that SQLite ACID isolation protected the balance against double-spend races.
  * `401 INVALID_WEBHOOK_SIGNATURE`: Explains timing-safe HMAC rejection of forged callbacks.
  * `500`: General gateway error recovery message.

---

## 5. Testing & Verification

1. **Unit & API Contract Testing:** `src/core/__tests__/typed_api_client.test.ts` (8 tests) verifies type safety and mock network transport.
2. **UI Integration Testing:** `src/core/__tests__/ui_dashboard_integration.test.ts` (11 tests) verifies all dashboard read/mutation endpoints against in-memory SQLite instances.
3. **Adversarial Security Testing:** `src/core/__tests__/adversarial_suite.test.ts` (14 tests) and `src/demo/pentest_runner.ts` (19 tests) verify end-to-end security invariants.
