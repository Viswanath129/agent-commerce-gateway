import { z } from "zod";
import { BuyerMandateSchema, ProposedItemSchema, CanonicalIntentSchema, type CanonicalIntent, type BuyerMandate, type ProposedItem } from "../core/types.js";

// ==========================================
// 1. CANONICAL FINANCIAL ACTION & INTENT
// ==========================================
export type ProtocolSource = "ACG" | "REST" | "MCP" | "A2A" | "ACP" | "AP2" | "UCP" | "TAP";

export type FinancialActionType =
  | "PURCHASE"
  | "PAYMENT"
  | "REFUND"
  | "PAYMENT_LINK"
  | "SUBSCRIPTION"
  | "PAYOUT"
  | "COLLECTION"
  | "TRANSFER"
  | "OTHER";

export interface ACGIntent {
  intentId: string;
  clientNonce: string;
  timestamp: number;

  principal: {
    type: "human" | "organization";
    id: string;
    publicKey: string;
  };

  agent: {
    id: string;
    provider?: string;
    protocol: ProtocolSource;
    publicKey?: string;
    modelRuntime?: string;
  };

  action: {
    type: FinancialActionType;
  };

  merchant: {
    id: string;
  };

  items: Array<{
    sku: string;
    quantity: number;
  }>;

  requestedAmount?: number;

  authorization: {
    mandateId: string;
    budgetLimitPaise: number;
    expiry: number;
    constraints: Record<string, unknown>;
  };

  provenance: {
    protocol: ProtocolSource;
    rawRequestHash: string;
    normalizedAt: number;
  };

  // The underlying validated canonical intent object for core execution
  canonical: CanonicalIntent;
}

// ==========================================
// 2. PROTOCOL ADAPTER INTERFACES (HONEST CLASSIFICATIONS)
// ==========================================
export type AdapterStatus =
  | "LIVE"
  | "IMPLEMENTED + TESTED"
  | "ADAPTER READY"
  | "ADAPTER READY / TEST PENDING"
  | "DESIGN"
  | "TRUST ADAPTER DESIGN"
  | "ARCHITECTURE READY"
  | "RAIL"
  | "PLUGGABLE";

export interface AdapterValidationSuccess {
  success: true;
  intent: CanonicalIntent;
  acgIntent: ACGIntent;
  metadata: {
    sourceProtocol: ProtocolSource;
    rawHash: string;
    agentId?: string;
    adapterVersion: string;
    details?: Record<string, unknown>;
  };
}

export interface AdapterValidationFailure {
  success: false;
  error: string;
  code: string;
  details?: unknown;
}

export type AdapterValidationResult = AdapterValidationSuccess | AdapterValidationFailure;

export interface ProtocolAdapter {
  protocol: ProtocolSource;
  displayName: string;
  specificationVersion: string;
  status: AdapterStatus;
  description: string;
  normalize(rawPayload: unknown, merchantId?: string): Promise<AdapterValidationResult>;
}

// ==========================================
// 3. PAYMENT INTELLIGENCE BOUNDARY (RAZORPAY VULCAN)
// ==========================================
export interface PaymentContext {
  intentId: string;
  merchantId: string;
  amountPaise: number;
  currency: string;
  itemCategories: string[];
  mandateId: string;
  agentId?: string;
  protocol?: ProtocolSource;
}

export interface IntelligenceEvaluationResult {
  provider: "Razorpay Vulcan [Architecture Ready]" | "Heuristic Baseline" | "Pluggable Provider";
  providerId: string;
  evaluatedAt: number;
  modelVersion: string;
  status: "ARCHITECTURE READY / ADVISORY" | "LIVE";
  riskSignals: {
    riskScore: number; // 0.00 (clean) to 1.00 (critical risk)
    networkFraudProbability: number;
    anomalyScore: number;
    velocityAlert: boolean;
    recommendedAction: "PROCEED" | "STEP_UP" | "FLAG";
  };
  routingHints: {
    optimalRail: "razorpay_direct" | "upi_reserve_pay" | "cards_v3";
    estimatedLatencyMs: number;
    expectedSuccessRateBps: number; // e.g. 9940 = 99.4%
  };
  authorityDisclaimer: string;
}

export interface PaymentIntelligenceProvider {
  providerId: string;
  displayName: string;
  evaluate(context: PaymentContext): Promise<IntelligenceEvaluationResult>;
}
