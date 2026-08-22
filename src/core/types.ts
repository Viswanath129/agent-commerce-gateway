import { z } from "zod";

// 1. BUYER MANDATE SCHEMA (Cryptographically signed by user principal)
export const BuyerMandateSchema = z.object({
  mandate_id: z.string().min(1),
  principal_public_key: z.string().min(32), // Hex-encoded Ed25519 public key
  budget_limit: z.number().int().positive(), // in paise (e.g., 500000 = INR 5000)
  currency: z.literal("INR"),
  merchant_whitelist: z.array(z.string()).optional(),
  category_whitelist: z.array(z.string()).optional(),
  expiry: z.number().int().positive(), // Unix timestamp (seconds)
  signature: z.string().min(64), // Hex-encoded Ed25519 signature over canonical mandate fields
});
export type BuyerMandate = z.infer<typeof BuyerMandateSchema>;

// 2. UNTRUSTED PROPOSED ITEM (From LLM)
export const ProposedItemSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
});
export type ProposedItem = z.infer<typeof ProposedItemSchema>;

// 3. CANONICAL INTERNAL TRANSACTION INTENT (Internal IR)
export const CanonicalIntentSchema = z.object({
  intent_id: z.string().uuid(),
  client_nonce: z.string().min(16),
  timestamp: z.number().int().positive(),
  mandate: BuyerMandateSchema,
  proposed_items: z.array(ProposedItemSchema).nonempty(),
});
export type CanonicalIntent = z.infer<typeof CanonicalIntentSchema>;

// 4. COMMERCE TRUTH ITEM (Directly from Merchant Database)
export interface CatalogItem {
  sku: string;
  name: string;
  category: string;
  unit_price: number; // in paise
  tax_rate_bps: number; // basis points (e.g. 1800 = 18%)
  available_stock: number;
  is_active: boolean;
}

// 5. MERCHANT POLICY CONFIGURATION (With Explicit Versioning)
export interface MerchantPolicy {
  policy_version: string; // e.g. "pol_v1.0.0"
  effective_at: number; // Unix timestamp
  merchant_id: string;
  max_transaction_amount: number; // in paise
  allowed_categories: string[];
  auto_refund_on_fulfillment_failure: boolean;
  min_margin_percentage: number;
}

// 6. TRANSACTION STATES
export type TransactionState =
  | "INTENT_RECEIVED"
  | "INTENT_VALIDATED"
  | "INTENT_REJECTED"
  | "DUAL_RESERVATION_HELD"
  | "RESERVATION_FAILED"
  | "ORDER_CREATED"
  | "PAYMENT_ATTEMPTED"
  | "PAYMENT_AUTHORIZED"
  | "PAYMENT_CAPTURED"
  | "PAYMENT_FAILED"
  | "FULFILLMENT_DISPATCHED"
  | "ORDER_COMPLETED"
  | "FULFILLMENT_FAILED"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "MANUAL_REVIEW"
  | "DUAL_RESERVATION_RELEASED";

// 7. AUDIT PROVENANCE RECORD
export interface AuditRecord {
  audit_id: string;
  intent_id: string;
  timestamp: number;
  event_type: string;
  previous_state: TransactionState | null;
  new_state: TransactionState;
  details: Record<string, unknown>;
  record_hash: string;
}
