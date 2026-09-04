import { z } from "zod";
import type { MerchantPolicy } from "./types.js";

export const PolicyDSLSchema = z.object({
  version: z.string().regex(/^pol_v\d+\.\d+\.\d+$/, "Must follow pol_vX.Y.Z format"),
  merchant_id: z.string().min(1),
  effective_from: z.number().int().positive().optional(),
  rules: z.object({
    max_transaction_amount_inr: z.number().positive(),
    allowed_store_categories: z.array(z.string()).nonempty(),
    auto_refund_stockout: z.boolean().default(true),
    min_gross_margin_bps: z.number().int().nonnegative().default(1500),
    confirmation_threshold_inr: z.number().positive().default(3000),
  }),
});

export type PolicyDSL = z.infer<typeof PolicyDSLSchema>;

export interface CompiledPolicy {
  raw: PolicyDSL;
  runtimePolicy: MerchantPolicy;
  compiledAt: number;
  hash: string;
}

export class PolicyCompiler {
  public static compile(source: unknown): CompiledPolicy {
    const parseResult = PolicyDSLSchema.safeParse(source);
    if (!parseResult.success) {
      throw new Error(`Policy DSL compilation error: ${parseResult.error.errors.map((e) => e.message).join("; ")}`);
    }

    const dsl = parseResult.data;
    const now = Math.floor(Date.now() / 1000);

    const runtimePolicy: MerchantPolicy = {
      policy_version: dsl.version,
      effective_at: dsl.effective_from || now,
      merchant_id: dsl.merchant_id,
      max_transaction_amount: Math.round(dsl.rules.max_transaction_amount_inr * 100),
      allowed_categories: dsl.rules.allowed_store_categories,
      auto_refund_on_fulfillment_failure: dsl.rules.auto_refund_stockout,
      min_margin_percentage: dsl.rules.min_gross_margin_bps / 100,
    };

    return {
      raw: dsl,
      runtimePolicy,
      compiledAt: now,
      hash: Buffer.from(JSON.stringify(runtimePolicy)).toString("base64"),
    };
  }
}
