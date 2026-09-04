import type { CatalogItem, MerchantPolicy } from "./types.js";
import type { BuyerMandate } from "./types.js";

export interface BasketLineItem {
  sku: string;
  quantity: number;
}

export interface CandidateCrossSell {
  item: CatalogItem;
  totalPricePaise: number;
  totalPriceInr: number;
  relationship: string;
  recommendationStatus: "RECOMMENDED_AUTO_APPROVABLE" | "REQUIRES_CONFIRMATION" | "EXCLUDED_BUDGET_OVERSTEP";
  budgetImpact: {
    baseBasketPaise: number;
    crossSellPaise: number;
    projectedTotalPaise: number;
    remainingBudgetPaise: number;
    budgetSurplusDeficitPaise: number;
  };
  explanation: string;
}

export interface ConversationalTurnResponse {
  agentRole: "LOCAL_COMMERCE_AGENT" | "DETERMINISTIC_DEMO_AGENT";
  buyerMessage: string;
  replyMessage: string;
  matchedItems: Array<{
    item: CatalogItem;
    unitPriceInr: number;
    taxRateBps: number;
    totalPriceInr: number;
    inStock: boolean;
  }>;
  candidateCrossSells: CandidateCrossSell[];
  currentBasket: {
    items: Array<{
      sku: string;
      name: string;
      quantity: number;
      unitPricePaise: number;
      totalPaise: number;
    }>;
    totalPaise: number;
    totalInr: number;
  };
  authorizationPreview: {
    status: "CAN_AUTO_AUTHORIZE" | "REQUIRES_HUMAN_CONFIRMATION" | "POLICY_OR_BUDGET_BLOCKED";
    reasons: string[];
    mandateRemainingPaise: number;
    merchantPolicyCapPaise: number;
    confirmationThresholdPaise: number;
  };
}

/**
 * Policy-Constrained Commerce Recommendation Engine
 * 
 * Deterministic recommendation engine that generates candidate upsells and cross-sells
 * bounded by merchant catalog truth, merchant policy caps, buyer mandate limits, and
 * autonomous confirmation thresholds.
 * 
 * CRITICAL SECURITY INVARIANT:
 * This engine only generates recommendations and preview structures.
 * It DOES NOT authorize financial actions, reserve inventory, or invoke payment rails.
 */
export class PolicyConstrainedRecommendationEngine {
  /**
   * Calculate inclusive total price in paise for a catalog item (unit_price + tax).
   */
  public static calculateItemTotalPaise(item: CatalogItem, quantity: number = 1): number {
    const subtotal = item.unit_price * quantity;
    const tax = Math.round((subtotal * item.tax_rate_bps) / 10000);
    return subtotal + tax;
  }

  /**
   * Search merchant catalog using keyword / semantic criteria and price bounds.
   */
  public static searchCatalog(
    query: string,
    catalog: CatalogItem[],
    maxPriceInr?: number
  ): CatalogItem[] {
    const q = query.toLowerCase().trim();
    const tokens = q.split(/\s+/).filter(t => t.length > 1);

    return catalog.filter(item => {
      if (!item.is_active || item.available_stock <= 0) return false;
      const totalInr = this.calculateItemTotalPaise(item) / 100;
      if (maxPriceInr !== undefined && totalInr > maxPriceInr) return false;

      if (!tokens.length) return true;

      const searchableText = `${item.sku} ${item.name} ${item.category}`.toLowerCase();
      return tokens.some(token => {
        if (token === "keyboard" && searchableText.includes("keyboard")) return true;
        if (token === "mouse" && searchableText.includes("mouse")) return true;
        if (token === "chair" && searchableText.includes("chair")) return true;
        if (token === "headset" && searchableText.includes("headset")) return true;
        if (token === "wireless" && searchableText.includes("wireless")) return true;
        return searchableText.includes(token);
      });
    });
  }

  /**
   * Evaluates candidate cross-sells for a given basket against policies and budget.
   */
  public static evaluateCrossSells(
    basketItems: BasketLineItem[],
    catalog: CatalogItem[],
    policy: MerchantPolicy,
    mandate?: { budget_limit: number; remaining_budget: number; currency: string } | null,
    agentPrincipal?: { confirmation_above?: number } | null
  ): CandidateCrossSell[] {
    const catalogMap = new Map<string, CatalogItem>();
    for (const item of catalog) {
      catalogMap.set(item.sku, item);
    }

    let currentBasketPaise = 0;
    const currentSkus = new Set<string>();
    for (const line of basketItems) {
      const item = catalogMap.get(line.sku);
      if (item) {
        currentSkus.add(item.sku);
        currentBasketPaise += this.calculateItemTotalPaise(item, line.quantity);
      }
    }

    const remainingBudgetPaise = mandate ? mandate.remaining_budget : policy.max_transaction_amount;
    const policyCapPaise = policy.max_transaction_amount;
    const confirmationThresholdPaise = agentPrincipal?.confirmation_above || 300000;

    const candidates: CandidateCrossSell[] = [];

    for (const item of catalog) {
      if (!item.is_active || item.available_stock <= 0) continue;
      if (currentSkus.has(item.sku)) continue;

      let relationship = "";
      let isRelevant = false;

      if (currentSkus.has("SKU-KEYBOARD-RGB") || currentSkus.has("SKU-KEYBOARD-SLIM")) {
        if (item.sku === "SKU-MOUSE-PRO" || item.sku === "SKU-MOUSE-SLIM") {
          relationship = "Compatible ergonomic precision mouse companion";
          isRelevant = true;
        } else if (item.sku === "SKU-HEADSET-STUDIO") {
          relationship = "Companion noise-cancelling studio headset";
          isRelevant = true;
        }
      } else if (currentSkus.has("SKU-MOUSE-PRO") || currentSkus.has("SKU-MOUSE-SLIM")) {
        if (item.sku === "SKU-KEYBOARD-RGB" || item.sku === "SKU-KEYBOARD-SLIM") {
          relationship = "Matching ergonomic mechanical keyboard";
          isRelevant = true;
        }
      } else if (currentSkus.has("SKU-CHAIR-ERGO")) {
        if (item.sku === "SKU-KEYBOARD-RGB" || item.sku === "SKU-MOUSE-PRO") {
          relationship = "Ergonomic workspace productivity bundle";
          isRelevant = true;
        }
      } else if (basketItems.length === 0) {
        if (item.category === "electronics") {
          relationship = "Popular high-velocity workspace hardware";
          isRelevant = true;
        }
      }

      if (!isRelevant) continue;

      const crossSellItemPaise = this.calculateItemTotalPaise(item, 1);
      const projectedTotalPaise = currentBasketPaise + crossSellItemPaise;
      const budgetSurplusDeficitPaise = remainingBudgetPaise - projectedTotalPaise;

      let recommendationStatus: CandidateCrossSell["recommendationStatus"] = "RECOMMENDED_AUTO_APPROVABLE";
      let explanation = "";

      const priceInr = crossSellItemPaise / 100;
      const projectedTotalInr = projectedTotalPaise / 100;
      const remainingBudgetInr = remainingBudgetPaise / 100;

      if (projectedTotalPaise > remainingBudgetPaise) {
        recommendationStatus = "EXCLUDED_BUDGET_OVERSTEP";
        explanation = `Adding ${item.name} (₹${priceInr.toFixed(2)}) brings total to ₹${projectedTotalInr.toFixed(2)}, which exceeds your remaining mandate budget of ₹${remainingBudgetInr.toFixed(2)} by ₹${Math.abs(budgetSurplusDeficitPaise / 100).toFixed(2)}.`;
      } else if (projectedTotalPaise > policyCapPaise) {
        recommendationStatus = "EXCLUDED_BUDGET_OVERSTEP";
        explanation = `Adding ${item.name} brings total to ₹${projectedTotalInr.toFixed(2)}, which exceeds the merchant policy transaction cap of ₹${(policyCapPaise / 100).toFixed(2)}.`;
      } else if (projectedTotalPaise > confirmationThresholdPaise) {
        recommendationStatus = "REQUIRES_CONFIRMATION";
        explanation = `Adding ${item.name} brings total to ₹${projectedTotalInr.toFixed(2)}. While within your budget (₹${remainingBudgetInr.toFixed(2)}), it exceeds the ₹${(confirmationThresholdPaise / 100).toFixed(2)} autonomous spending threshold and will trigger a human confirmation challenge.`;
      } else {
        recommendationStatus = "RECOMMENDED_AUTO_APPROVABLE";
        explanation = `Adding ${item.name} (₹${priceInr.toFixed(2)}) brings total to ₹${projectedTotalInr.toFixed(2)}, which is fully within your ₹${remainingBudgetInr.toFixed(2)} mandate budget and auto-approvable.`;
      }

      candidates.push({
        item,
        totalPricePaise: crossSellItemPaise,
        totalPriceInr: priceInr,
        relationship,
        recommendationStatus,
        budgetImpact: {
          baseBasketPaise: currentBasketPaise,
          crossSellPaise: crossSellItemPaise,
          projectedTotalPaise,
          remainingBudgetPaise,
          budgetSurplusDeficitPaise,
        },
        explanation,
      });
    }

    return candidates;
  }

  /**
   * Process a conversational buyer turn deterministically.
   */
  public static processConversationalTurn(
    message: string,
    currentBasket: BasketLineItem[],
    catalog: CatalogItem[],
    policy: MerchantPolicy,
    mandate?: { budget_limit: number; remaining_budget: number; currency: string } | null,
    agentPrincipal?: { confirmation_above?: number } | null
  ): ConversationalTurnResponse {
    const q = message.toLowerCase().trim();

    let maxPriceInr: number | undefined;
    const priceMatch = q.match(/(?:under|below|less than|max)\s*(?:₹|inr|rs\.?)?\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]+)?)/i);
    if (priceMatch) {
      maxPriceInr = parseFloat(priceMatch[1].replace(/,/g, ""));
    }

    const matchedCatalog = this.searchCatalog(q, catalog, maxPriceInr);

    const catalogMap = new Map<string, CatalogItem>(catalog.map(c => [c.sku, c]));
    let basketTotalPaise = 0;
    const detailedBasketItems = [];

    for (const b of currentBasket) {
      const item = catalogMap.get(b.sku);
      if (item) {
        const itemTotal = this.calculateItemTotalPaise(item, b.quantity);
        basketTotalPaise += itemTotal;
        detailedBasketItems.push({
          sku: item.sku,
          name: item.name,
          quantity: b.quantity,
          unitPricePaise: item.unit_price,
          totalPaise: itemTotal,
        });
      }
    }

    const crossSells = this.evaluateCrossSells(currentBasket, catalog, policy, mandate, agentPrincipal);

    let replyMessage = "";
    if (matchedCatalog.length > 0) {
      const top = matchedCatalog[0];
      const topPrice = this.calculateItemTotalPaise(top) / 100;
      replyMessage = `I found the **${top.name}** in the merchant catalog for ₹${topPrice.toFixed(2)} (Tax Included).`;
      
      const autoCrossSell = crossSells.find(cs => cs.recommendationStatus === "RECOMMENDED_AUTO_APPROVABLE");
      if (autoCrossSell) {
        replyMessage += ` A compatible **${autoCrossSell.item.name}** is available for ₹${autoCrossSell.totalPriceInr.toFixed(2)}. Adding it brings your basket to ₹${(autoCrossSell.budgetImpact.projectedTotalPaise / 100).toFixed(2)}, which is within your authorization mandate.`;
      }
    } else if (currentBasket.length > 0) {
      replyMessage = `Your current basket has ${detailedBasketItems.length} item(s) totaling ₹${(basketTotalPaise / 100).toFixed(2)}.`;
      const autoCrossSell = crossSells.find(cs => cs.recommendationStatus === "RECOMMENDED_AUTO_APPROVABLE");
      if (autoCrossSell) {
        replyMessage += ` We recommend pairing with **${autoCrossSell.item.name}** (+₹${autoCrossSell.totalPriceInr.toFixed(2)}).`;
      }
    } else {
      replyMessage = `I searched the merchant catalog but found no matching items within your specified criteria. Would you like to explore our standard electronics or office essentials?`;
    }

    const remainingBudgetPaise = mandate ? mandate.remaining_budget : policy.max_transaction_amount;
    const policyCapPaise = policy.max_transaction_amount;
    const confirmationThresholdPaise = agentPrincipal?.confirmation_above || 300000;

    let authStatus: ConversationalTurnResponse["authorizationPreview"]["status"] = "CAN_AUTO_AUTHORIZE";
    const reasons: string[] = [];

    if (basketTotalPaise > remainingBudgetPaise) {
      authStatus = "POLICY_OR_BUDGET_BLOCKED";
      reasons.push(`Basket total (₹${(basketTotalPaise / 100).toFixed(2)}) exceeds remaining mandate budget (₹${(remainingBudgetPaise / 100).toFixed(2)})`);
    } else if (basketTotalPaise > policyCapPaise) {
      authStatus = "POLICY_OR_BUDGET_BLOCKED";
      reasons.push(`Basket total exceeds merchant policy cap (₹${(policyCapPaise / 100).toFixed(2)})`);
    } else if (basketTotalPaise > confirmationThresholdPaise) {
      authStatus = "REQUIRES_HUMAN_CONFIRMATION";
      reasons.push(`Basket total exceeds autonomous confirmation threshold (₹${(confirmationThresholdPaise / 100).toFixed(2)})`);
    } else {
      reasons.push("Fully authorized for autonomous checkout");
    }

    return {
      agentRole: "LOCAL_COMMERCE_AGENT",
      buyerMessage: message,
      replyMessage,
      matchedItems: matchedCatalog.map(item => ({
        item,
        unitPriceInr: item.unit_price / 100,
        taxRateBps: item.tax_rate_bps,
        totalPriceInr: this.calculateItemTotalPaise(item) / 100,
        inStock: item.available_stock > 0,
      })),
      candidateCrossSells: crossSells,
      currentBasket: {
        items: detailedBasketItems,
        totalPaise: basketTotalPaise,
        totalInr: basketTotalPaise / 100,
      },
      authorizationPreview: {
        status: authStatus,
        reasons,
        mandateRemainingPaise: remainingBudgetPaise,
        merchantPolicyCapPaise: policyCapPaise,
        confirmationThresholdPaise,
      },
    };
  }
}
