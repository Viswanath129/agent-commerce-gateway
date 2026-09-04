import type { DatabaseSync } from "node:sqlite";
import type { BuyerMandate, CatalogItem } from "./types.js";

export interface HierarchicalBudgetCheck {
  allowed: boolean;
  reason?: string;
  code?: string;
  merchantRemaining?: number;
  agentRemaining?: number;
  mandateRemaining?: number;
}

export class HierarchicalBudgetEngine {
  private db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  public initMerchantBudgetIfAbsent(merchantId: string, dailyLimitPaise: number = 50000000): void {
    const existing = this.db.prepare("SELECT merchant_id FROM merchant_budgets WHERE merchant_id = ?").get(merchantId);
    if (!existing) {
      const now = Math.floor(Date.now() / 1000);
      const resetAt = now + 86400;
      this.db
        .prepare(`
          INSERT INTO merchant_budgets (merchant_id, daily_budget_limit, daily_spent, reset_at)
          VALUES (?, ?, 0, ?)
        `)
        .run(merchantId, dailyLimitPaise, resetAt);
    }
  }

  public evaluateHierarchy(
    merchantId: string,
    agentId: string,
    mandate: BuyerMandate,
    totalPaise: number
  ): HierarchicalBudgetCheck {
    this.initMerchantBudgetIfAbsent(merchantId);

    // 1. Check Merchant Daily Budget
    const merchantRow = this.db.prepare("SELECT * FROM merchant_budgets WHERE merchant_id = ?").get(merchantId) as any;
    if (merchantRow) {
      const available = Number(merchantRow.daily_budget_limit) - Number(merchantRow.daily_spent);
      if (totalPaise > available) {
        return {
          allowed: false,
          reason: `Merchant daily budget exceeded: required ₹${(totalPaise / 100).toFixed(2)}, available ₹${(available / 100).toFixed(2)}`,
          code: "MERCHANT_DAILY_BUDGET_EXCEEDED",
          merchantRemaining: available,
        };
      }
    }

    // 2. Check Agent Daily Budget & Capability Limit
    const capRow = this.db
      .prepare("SELECT * FROM agent_capabilities WHERE agent_id = ? AND capability = 'PURCHASE' AND status = 'ACTIVE'")
      .get(agentId) as any;
    if (capRow) {
      const maxTx = Number(capRow.max_amount);
      if (totalPaise > maxTx) {
        return {
          allowed: false,
          reason: `Agent single-transaction capability ceiling exceeded (max: ₹${(maxTx / 100).toFixed(2)})`,
          code: "AGENT_TRANSACTION_LIMIT_EXCEEDED",
        };
      }
      const agentDailyAvail = Number(capRow.daily_budget) - Number(capRow.daily_spent);
      if (totalPaise > agentDailyAvail) {
        return {
          allowed: false,
          reason: `Agent daily spend budget exceeded (available: ₹${(agentDailyAvail / 100).toFixed(2)})`,
          code: "AGENT_DAILY_BUDGET_EXCEEDED",
          agentRemaining: agentDailyAvail,
        };
      }
    }

    // 3. Check Buyer Mandate Balance
    const mandateRow = this.db.prepare("SELECT remaining_budget FROM buyer_mandates WHERE mandate_id = ?").get(mandate.mandate_id) as any;
    const mandateRemaining = mandateRow ? Number(mandateRow.remaining_budget) : mandate.budget_limit;
    if (totalPaise > mandateRemaining) {
      const isPartiallySpent = mandateRemaining < mandate.budget_limit;
      return {
        allowed: false,
        reason: `Buyer mandate budget limit exceeded (remaining: ₹${(mandateRemaining / 100).toFixed(2)})`,
        code: isPartiallySpent ? "MANDATE_EXHAUSTED" : "MANDATE_BUDGET_EXCEEDED",
        mandateRemaining,
      };
    }

    return {
      allowed: true,
      merchantRemaining: merchantRow ? Number(merchantRow.daily_budget_limit) - Number(merchantRow.daily_spent) : undefined,
      mandateRemaining,
    };
  }

  public recordSpend(merchantId: string, agentId: string, amountPaise: number): void {
    this.db
      .prepare("UPDATE merchant_budgets SET daily_spent = daily_spent + ? WHERE merchant_id = ?")
      .run(amountPaise, merchantId);

    this.db
      .prepare("UPDATE agent_capabilities SET daily_spent = daily_spent + ? WHERE agent_id = ? AND capability = 'PURCHASE'")
      .run(amountPaise, agentId);
  }
}
