export type RiskTier = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type RecommendedAction = "ALLOW" | "REQUIRE_CONFIRMATION" | "DENY";

export interface RiskEvaluationInput {
  intentId: string;
  merchantId: string;
  agentId: string;
  amountPaise: number;
  currency: string;
  categories: string[];
  mandateId: string;
  protocol?: string;
}

export interface RiskEvaluationResult {
  provider: string;
  riskScore: number; // 0 (safest) to 100 (highest risk)
  riskTier: RiskTier;
  recommendedAction: RecommendedAction;
  signals: string[];
  advisoryOnly: true; // Invariant: Risk provider is advisory and must never silently bypass policy
  latencyMs: number;
  evaluatedAt: number;
}

export interface RiskProvider {
  name: string;
  evaluate(input: RiskEvaluationInput): Promise<RiskEvaluationResult>;
}

/**
 * Deterministic local heuristic risk provider for enterprise merchant bounds.
 */
export class LocalHeuristicRiskProvider implements RiskProvider {
  public name = "LocalHeuristicRiskProvider";

  public async evaluate(input: RiskEvaluationInput): Promise<RiskEvaluationResult> {
    const startTime = performance.now();
    const signals: string[] = [];
    let riskScore = 10; // Baseline low risk

    // 1. Basket Size Anomaly Signal
    if (input.amountPaise > 1000000) { // > ₹10,000
      riskScore += 25;
      signals.push("HIGH_TRANSACTION_VALUE");
    }
    if (input.amountPaise > 5000000) { // > ₹50,000
      riskScore += 35;
      signals.push("EXCESSIVE_TRANSACTION_VALUE");
    }

    // 2. High-Risk Category Detection
    const highRiskCategories = ["gift_cards", "crypto_assets", "digital_currency", "precious_metals"];
    for (const cat of input.categories) {
      if (highRiskCategories.includes(cat.toLowerCase())) {
        riskScore += 40;
        signals.push(`HIGH_RISK_CATEGORY_${cat.toUpperCase()}`);
      }
    }

    // 3. Protocol Risk Adjustment
    if (input.protocol && input.protocol.toLowerCase() === "rest_unverified") {
      riskScore += 20;
      signals.push("UNVERIFIED_INGRESS_PROTOCOL");
    }

    // Cap score at 100
    riskScore = Math.min(100, Math.max(0, riskScore));

    let riskTier: RiskTier = "LOW";
    let recommendedAction: RecommendedAction = "ALLOW";

    if (riskScore >= 75) {
      riskTier = "CRITICAL";
      recommendedAction = "DENY";
    } else if (riskScore >= 50) {
      riskTier = "HIGH";
      recommendedAction = "REQUIRE_CONFIRMATION";
    } else if (riskScore >= 30) {
      riskTier = "MEDIUM";
      recommendedAction = "REQUIRE_CONFIRMATION";
    } else {
      riskTier = "LOW";
      recommendedAction = "ALLOW";
    }

    const latencyMs = Number((performance.now() - startTime).toFixed(2));

    return {
      provider: this.name,
      riskScore,
      riskTier,
      recommendedAction,
      signals,
      advisoryOnly: true,
      latencyMs,
      evaluatedAt: Math.floor(Date.now() / 1000),
    };
  }
}

/**
 * Advisory Razorpay Vulcan Transformer Risk Provider (Advisory Ready)
 */
export class RazorpayVulcanAdvisoryRiskProvider implements RiskProvider {
  public name = "RazorpayVulcanAdvisoryProvider";

  public async evaluate(input: RiskEvaluationInput): Promise<RiskEvaluationResult> {
    const startTime = performance.now();
    // Deterministic simulation of downstream Vulcan transformer advisory signals
    const signals = ["VULCAN_TRANSFORMER_TELEMETRY_PINNED", "MODEL_VULCAN_V1.4_ACTIVE"];
    const riskScore = input.amountPaise > 2000000 ? 35 : 12;

    const latencyMs = Number((performance.now() - startTime).toFixed(2));
    return {
      provider: "Razorpay Vulcan Foundation Model (Advisory)",
      riskScore,
      riskTier: riskScore > 50 ? "HIGH" : "LOW",
      recommendedAction: riskScore > 50 ? "REQUIRE_CONFIRMATION" : "ALLOW",
      signals,
      advisoryOnly: true,
      latencyMs,
      evaluatedAt: Math.floor(Date.now() / 1000),
    };
  }
}
