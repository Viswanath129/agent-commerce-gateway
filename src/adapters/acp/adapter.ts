import crypto from "node:crypto";
import { z } from "zod";
import { BuyerMandateSchema, type CanonicalIntent } from "../../core/types.js";
import type { ProtocolAdapter, AdapterValidationResult, ACGIntent } from "../types.js";

const AcpTransactionSchema = z.object({
  protocol_version: z.string().refine((v) => v.startsWith("acp/"), {
    message: "Protocol version must start with 'acp/' (e.g. acp/1.0)",
  }),
  transaction_id: z.string().uuid().optional(),
  session_nonce: z.string().min(16).optional(),
  timestamp: z.number().int().positive().optional(),
  buyer_principal: z.object({
    id: z.string().min(1),
    public_key: z.string().min(32),
  }),
  agent_identity: z.object({
    agent_id: z.string().min(1),
    runtime: z.string().optional(),
  }).optional(),
  commerce_mandate: BuyerMandateSchema,
  line_items: z.array(
    z.object({
      sku: z.string().min(1),
      quantity: z.number().int().positive(),
      estimated_price_paise: z.number().int().optional(), // Advisory only; ACG truth engine overrides
    })
  ).nonempty(),
});

export class AcpProtocolAdapter implements ProtocolAdapter {
  public readonly protocol = "ACP" as const;
  public readonly displayName = "Agentic Commerce Protocol (ACP)";
  public readonly specificationVersion = "acp/1.0";
  public readonly status = "ADAPTER READY" as const;
  public readonly description = "Normalizes ACP open commerce checkout containers into canonical ACG intents.";

  public async normalize(rawPayload: unknown, merchantId = "merch_acme_electronics_01"): Promise<AdapterValidationResult> {
    const rawHash = crypto.createHash("sha256").update(JSON.stringify(rawPayload || {})).digest("hex");

    const parseResult = AcpTransactionSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      return {
        success: false,
        error: "Invalid ACP commerce container format",
        code: "INVALID_ACP_PAYLOAD",
        details: parseResult.error.format(),
      };
    }

    const data = parseResult.data;
    const intentId = data.transaction_id || crypto.randomUUID();
    const nonce = data.session_nonce || crypto.randomBytes(16).toString("hex");
    const ts = data.timestamp || Math.floor(Date.now() / 1000);

    const canonical: CanonicalIntent = {
      intent_id: intentId,
      client_nonce: nonce,
      timestamp: ts,
      mandate: data.commerce_mandate,
      proposed_items: data.line_items.map((i) => ({ sku: i.sku, quantity: i.quantity })) as any,
    };

    const agentId = data.agent_identity?.agent_id || `acp-agent-${intentId.slice(0, 8)}`;

    const acgIntent: ACGIntent = {
      intentId,
      clientNonce: nonce,
      timestamp: ts,
      principal: {
        type: "human",
        id: data.buyer_principal.id,
        publicKey: data.commerce_mandate.principal_public_key,
      },
      agent: {
        id: agentId,
        provider: "ACP Ecosystem",
        protocol: "ACP",
        modelRuntime: data.agent_identity?.runtime || "Autonomous ACP Agent",
      },
      action: {
        type: "PURCHASE",
      },
      merchant: {
        id: data.commerce_mandate.merchant_whitelist?.[0] || merchantId,
      },
      items: data.line_items.map((i) => ({ sku: i.sku, quantity: i.quantity })),
      authorization: {
        mandateId: data.commerce_mandate.mandate_id,
        budgetLimitPaise: data.commerce_mandate.budget_limit,
        expiry: data.commerce_mandate.expiry,
        constraints: {
          categories: data.commerce_mandate.category_whitelist || [],
          merchants: data.commerce_mandate.merchant_whitelist || [],
        },
      },
      provenance: {
        protocol: "ACP",
        rawRequestHash: rawHash,
        normalizedAt: Date.now(),
      },
      canonical,
    };

    return {
      success: true,
      intent: canonical,
      acgIntent,
      metadata: {
        sourceProtocol: "ACP",
        rawHash,
        agentId,
        adapterVersion: this.specificationVersion,
      },
    };
  }
}
