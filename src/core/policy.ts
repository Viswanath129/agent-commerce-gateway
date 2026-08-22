import type { BuyerMandate, MerchantPolicy } from "./types.js";

export interface PolicyEvaluationResult {
  isAllowed: boolean;
  policy_version: string;
  effective_at: number;
  decision_timestamp: number;
  reason?: string;
  violationCode?: string;
}

export class PolicyEngine {
  private policy: MerchantPolicy;

  constructor(policy: MerchantPolicy) {
    this.policy = policy;
  }

  public updatePolicy(newPolicy: MerchantPolicy): void {
    this.policy = newPolicy;
  }

  public getPolicy(): MerchantPolicy {
    return this.policy;
  }

  /**
   * Evaluates Effective Permission with immutable policy versioning.
   */
  public evaluate(
    mandate: BuyerMandate,
    computedTotalAmount: number, // in paise
    proposedCategories: string[],
    merchantId: string
  ): PolicyEvaluationResult {
    const decisionTimestamp = Math.floor(Date.now() / 1000);
    const baseInfo = {
      policy_version: this.policy.policy_version,
      effective_at: this.policy.effective_at,
      decision_timestamp: decisionTimestamp,
    };

    // 1. Mandate Temporal Expiry Check
    if (decisionTimestamp > mandate.expiry) {
      return {
        ...baseInfo,
        isAllowed: false,
        reason: `Mandate expired at timestamp ${mandate.expiry} (current: ${decisionTimestamp})`,
        violationCode: "MANDATE_EXPIRED",
      };
    }

    // 2. Mandate Merchant Whitelist Check
    if (mandate.merchant_whitelist && mandate.merchant_whitelist.length > 0) {
      if (!mandate.merchant_whitelist.includes(merchantId)) {
        return {
          ...baseInfo,
          isAllowed: false,
          reason: `Merchant '${merchantId}' not permitted by buyer mandate whitelist`,
          violationCode: "MERCHANT_NOT_WHITELISTED",
        };
      }
    }

    // 3. Mandate Category Whitelist Check
    if (mandate.category_whitelist && mandate.category_whitelist.length > 0) {
      for (const cat of proposedCategories) {
        if (!mandate.category_whitelist.includes(cat)) {
          return {
            ...baseInfo,
            isAllowed: false,
            reason: `Category '${cat}' not permitted by buyer mandate category whitelist`,
            violationCode: "CATEGORY_NOT_WHITELISTED",
          };
        }
      }
    }

    // 4. Mandate Budget Cap Check
    if (computedTotalAmount > mandate.budget_limit) {
      return {
        ...baseInfo,
        isAllowed: false,
        reason: `Computed total (₹${(computedTotalAmount / 100).toFixed(2)}) exceeds buyer mandate limit (₹${(mandate.budget_limit / 100).toFixed(2)})`,
        violationCode: "MANDATE_BUDGET_EXCEEDED",
      };
    }

    // 5. Merchant Policy: Max Transaction Ceiling
    if (computedTotalAmount > this.policy.max_transaction_amount) {
      return {
        ...baseInfo,
        isAllowed: false,
        reason: `Order total (₹${(computedTotalAmount / 100).toFixed(2)}) exceeds merchant maximum transaction limit (₹${(this.policy.max_transaction_amount / 100).toFixed(2)})`,
        violationCode: "MERCHANT_MAX_AMOUNT_EXCEEDED",
      };
    }

    // 6. Merchant Policy: Allowed Store Categories
    for (const cat of proposedCategories) {
      if (!this.policy.allowed_categories.includes(cat)) {
        return {
          ...baseInfo,
          isAllowed: false,
          reason: `Category '${cat}' is not enabled for agentic checkout on this merchant store`,
          violationCode: "MERCHANT_CATEGORY_RESTRICTED",
        };
      }
    }

    return {
      ...baseInfo,
      isAllowed: true,
    };
  }
}
