/**
 * ACG Control Plane Constants & System Metadata
 */

export interface NavItemDef {
  id: string;
  num: string;
  label: string;
  badge?: string;
  description: string;
}

export const NAVIGATION_ITEMS: NavItemDef[] = [
  { id: 'overview', num: '01', label: 'Overview', description: 'Real-time financial control plane telemetry' },
  { id: 'live-demo', num: '02', label: 'Live Demo', badge: 'Interactive', description: 'Deterministic scenario execution pipeline' },
  { id: 'transactions', num: '03', label: 'Transactions', description: 'Persisted orders & 9-stage audit trajectories' },
  { id: 'mandates', num: '04', label: 'Mandates & Authority', description: 'Ed25519 buyer delegations & instant revocation' },
  { id: 'policies', num: '05', label: 'Policies & Truth', description: 'Merchant policy DSL & catalog grounding' },
  { id: 'reservations', num: '06', label: 'Atomic Reservations', description: 'Dual-resource budget & stock ACID serialization' },
  { id: 'audit-ledger', num: '07', label: 'Audit Ledger', description: 'Tamper-evident SHA-256 backwards hash chain' },
  { id: 'system-health', num: '08', label: 'System Health', description: 'Operational index for 7 core nodes' },
  { id: 'agent-compatibility', num: '09', label: 'Agent Compatibility', badge: 'Matrix', description: 'Universal protocol & model ingress boundary' },
];

export const DEMO_SCENARIOS = [
  {
    id: 'happy-path',
    num: '01',
    label: 'Nominal Flow',
    desc: 'Valid Ed25519 mandate, true catalog price, reservation, order creation & webhook capture.',
    expectedOutcome: 'HTTP 201 ORDER_CREATED'
  },
  {
    id: 'mandate-violation',
    num: '02',
    label: 'Budget Overstep',
    desc: 'Autonomous agent proposes ₹14,160.00 chair against ₹5,000.00 mandate cap. Intercepted before rails.',
    expectedOutcome: 'HTTP 403 MANDATE_BUDGET_EXCEEDED'
  },
  {
    id: 'concurrent',
    num: '03',
    label: 'Double-Spend Race',
    desc: 'Dual parallel checkouts attack remaining ₹2,876.00 budget simultaneously. Enforces 201 vs 409.',
    expectedOutcome: 'HTTP 201 ALLOW / HTTP 409 BLOCK'
  },
  {
    id: 'webhook-fail',
    num: '04',
    label: 'Webhook Reconciliation',
    desc: 'Forged HMAC SHA-256 webhook signature delivery. Rejection prevents unauthorized ledger mutation.',
    expectedOutcome: 'HTTP 401 INVALID_SIGNATURE'
  },
  {
    id: 'refund',
    num: '05',
    label: 'Safe Reversal',
    desc: 'Post-capture fulfillment stockout failure triggers policy-governed idempotent refund.',
    expectedOutcome: 'HTTP 200 REFUNDED'
  },
] as const;

export const PIPELINE_PHASES = [
  { id: 'intent', num: '01', name: 'AI INTENT', description: 'Zod canonical schema & nonces' },
  { id: 'authority', num: '02', name: 'AUTHORITY', description: 'Noble Ed25519 principal delegation' },
  { id: 'truth', num: '03', name: 'COMMERCE TRUTH', description: 'Database catalog price grounding' },
  { id: 'policy', num: '04', name: 'MERCHANT POLICY', description: 'Deterministic policy boundaries' },
  { id: 'reserve', num: '05', name: 'ATOMIC RESERVE', description: 'Dual-resource ACID serialization' },
  { id: 'razorpay', num: '06', name: 'RAZORPAY RAIL', description: 'Idempotent payment order creation' },
  { id: 'reconciliation', num: '07', name: 'RECONCILIATION', description: 'HMAC webhook & post-capture lifecycle' },
  { id: 'audit', num: '08', name: 'AUDIT PROVENANCE', description: 'Backwards-chained SHA-256 blocks' },
] as const;

export const TENANT_CONFIG = {
  merchantId: 'merch_acme_electronics_01',
  merchantName: 'Acme Electronics Ltd.',
  environment: 'SANDBOX / LIVE BACKEND',
  rails: 'RAZORPAY TEST / SANDBOX',
  authSecret: 'secret_merchant_admin',
};
