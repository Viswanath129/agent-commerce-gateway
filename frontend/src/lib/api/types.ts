/**
 * ACG Front-End API Types
 * Typed representations for all Gateway REST entities, responses, and errors.
 */

export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

export interface ApiErrorPayload {
  error?: string;
  message?: string;
  statusCode?: number;
  details?: Record<string, unknown>;
}

export interface DashboardMetrics {
  ai_intents_count: number;
  authorized_gmv_inr: number;
  blocked_attempts_count: number;
  active_reservations_count: number;
  audit_blocks_count: number;
  active_policy_version: string;
  merchant_id: string;
  measured_cold_run_ms: number;
  is_sandbox_connected: boolean;
}

export interface OrderSession {
  intent_id: string;
  receipt: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  amount: number;
  currency: string;
  status: "INITIATED" | "ORDER_CREATED" | "PAYMENT_CAPTURED" | "FULFILLMENT_DISPATCHED" | "REFUNDED" | "PAYMENT_FAILED";
  reservation_id: string;
  created_at: number;
  updated_at: number;
  mandate_id?: string;
}

export interface AuditTrajectoryStep {
  audit_id: string;
  intent_id: string;
  timestamp: number;
  event_type: string;
  previous_state?: string;
  new_state: string;
  details_json: string;
  record_hash: string;
  previous_record_hash?: string;
}

export interface ReservationItem {
  reservation_id: string;
  sku: string;
  quantity: number;
  unit_price: number;
  tax_amount: number;
  item_name?: string;
}

export interface Reservation {
  reservation_id: string;
  intent_id: string;
  mandate_id: string;
  reserved_budget: number;
  status: "HELD" | "COMMITTED" | "RELEASED" | "EXPIRED";
  created_at: number;
  expires_at: number;
  sku?: string;
  quantity?: number;
  unit_price?: number;
  tax_amount?: number;
  item_name?: string;
}

export interface TransactionDetailResponse {
  session: OrderSession | null;
  trajectory: AuditTrajectoryStep[];
  reservation: Reservation | null;
  reservationItems: ReservationItem[];
}

export interface BuyerMandate {
  mandate_id: string;
  principal_public_key: string;
  budget_limit: number;
  remaining_budget: number;
  currency: "INR";
  expiry: number;
  signature: string;
  created_at?: number;
  merchant_whitelist?: string[];
  category_whitelist?: string[];
}

export interface RevokedMandate {
  mandate_id: string;
  principal_public_key?: string;
  revocation_reason: string;
  revoked_at: number;
  revocation_signature?: string;
}

export interface MandatesRegistryResponse {
  mandates: BuyerMandate[];
  revoked: RevokedMandate[];
}

export interface RevokeMandateRequest {
  mandate_id: string;
  reason?: string;
  signature?: string;
}

export interface RevokeMandateResponse {
  status: "REVOKED";
  mandate_id: string;
  revoked_at: number;
  reason: string;
}

export interface MerchantPolicy {
  policy_version: string;
  effective_at: number;
  merchant_id: string;
  max_transaction_amount: number;
  allowed_categories: string[];
  auto_refund_on_fulfillment_failure: boolean;
  min_margin_percentage?: number;
}

export interface PolicyResponse {
  policy: MerchantPolicy;
}

export interface CatalogItem {
  sku: string;
  name: string;
  category: string;
  unit_price: number;
  tax_rate_bps: number;
  available_stock: number;
  is_active: number;
}

export interface CatalogResponse {
  merchant_id: string;
  policy_version: string;
  items: CatalogItem[];
}

export interface AuditBlock {
  audit_id: string;
  intent_id: string;
  timestamp: number;
  event_type: string;
  previous_state?: string;
  new_state: string;
  details_json: string;
  record_hash: string;
  previous_record_hash?: string;
}

export interface AuditIntegrityResponse {
  isValid: boolean;
  checkedBlocks: number;
  corruptedBlockIndex?: number;
}

export interface AuditLedgerResponse {
  blocks: AuditBlock[];
  integrity: AuditIntegrityResponse;
}

export interface HealthComponent {
  status: string;
  engine?: string;
  mode?: string;
  active_version?: string;
  latency_ms?: number;
  blocks?: number;
}

export interface SystemHealthResponse {
  status: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
  components: {
    gateway: HealthComponent;
    database: HealthComponent;
    policy_engine: HealthComponent;
    reservation_engine: HealthComponent;
    razorpay_rails: HealthComponent;
    webhook_processor: HealthComponent;
    audit_ledger: HealthComponent;
  };
  timestamp: number;
}

export type DemoScenarioType = "happy-path" | "mandate-violation" | "concurrent" | "webhook-fail" | "refund";

export interface DemoScenarioResult {
  status?: string;
  error?: string;
  message?: string;
  intent_id?: string;
  receipt?: string;
  razorpay_order_id?: string;
  amount_paise?: number;
  currency?: string;
  policy_version?: string;
  reservation_id?: string;
  scenario?: string;
  subagentA?: { status: number; body: Record<string, unknown> };
  subagentB?: { status: number; body: Record<string, unknown> };
  forgedWebhookResult?: { status: number; body: Record<string, unknown> };
  refundExecution?: { success: boolean; status: string };
  orderCreated?: Record<string, unknown>;
}
