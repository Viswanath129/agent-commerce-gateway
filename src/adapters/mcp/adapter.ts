import crypto from "node:crypto";
import { z } from "zod";
import { BuyerMandateSchema, type CanonicalIntent } from "../../core/types.js";
import type { ProtocolAdapter, AdapterValidationResult, ACGIntent } from "../types.js";

// MCP tools/call Schema for Commerce Checkout
const McpToolCallSchema = z.object({
  method: z.literal("tools/call"),
  params: z.object({
    name: z.string().refine((n) => ["acg_checkout", "execute_purchase", "checkout_cart"].includes(n), {
      message: "Unsupported MCP tool name. Expected 'acg_checkout', 'execute_purchase', or 'checkout_cart'.",
    }),
    arguments: z.object({
      intent_id: z.string().uuid().optional(),
      client_nonce: z.string().min(16).optional(),
      timestamp: z.number().int().positive().optional(),
      mandate: BuyerMandateSchema,
      items: z.array(
        z.object({
          sku: z.string().min(1),
          quantity: z.number().int().positive(),
        })
      ).nonempty(),
      agent_metadata: z.object({
        model_runtime: z.string().optional(),
        agent_id: z.string().optional(),
        provider: z.string().optional(),
      }).optional(),
    }),
  }),
});

export class McpProtocolAdapter implements ProtocolAdapter {
  public readonly protocol = "MCP" as const;
  public readonly displayName = "Model Context Protocol (MCP)";
  public readonly specificationVersion = "2024-11-05/v1";
  public readonly status = "ADAPTER READY" as const;
  public readonly description = "Converts Claude/GPT MCP tools/call invocations into verified canonical ACG intents.";

  public async normalize(rawPayload: unknown, merchantId = "merch_acme_electronics_01"): Promise<AdapterValidationResult> {
    const rawHash = crypto.createHash("sha256").update(JSON.stringify(rawPayload || {})).digest("hex");

    const parseResult = McpToolCallSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      return {
        success: false,
        error: "Malformed MCP tools/call payload",
        code: "INVALID_MCP_PAYLOAD",
        details: parseResult.error.format(),
      };
    }

    const { params } = parseResult.data;
    const args = params.arguments;
    const intentId = args.intent_id || crypto.randomUUID();
    const nonce = args.client_nonce || crypto.randomBytes(16).toString("hex");
    const ts = args.timestamp || Math.floor(Date.now() / 1000);

    const canonical: CanonicalIntent = {
      intent_id: intentId,
      client_nonce: nonce,
      timestamp: ts,
      mandate: args.mandate,
      proposed_items: args.items.map((i) => ({ sku: i.sku, quantity: i.quantity })) as any,
    };

    const agentId = args.agent_metadata?.agent_id || `mcp-agent-${intentId.slice(0, 8)}`;
    const model = args.agent_metadata?.model_runtime || "mcp-client";

    const acgIntent: ACGIntent = {
      intentId,
      clientNonce: nonce,
      timestamp: ts,
      principal: {
        type: "human",
        id: `principal_${args.mandate.principal_public_key.slice(0, 12)}`,
        publicKey: args.mandate.principal_public_key,
      },
      agent: {
        id: agentId,
        provider: args.agent_metadata?.provider || "Anthropic/MCP",
        protocol: "MCP",
        modelRuntime: model,
      },
      action: {
        type: "PURCHASE",
      },
      merchant: {
        id: args.mandate.merchant_whitelist?.[0] || merchantId,
      },
      items: args.items,
      authorization: {
        mandateId: args.mandate.mandate_id,
        budgetLimitPaise: args.mandate.budget_limit,
        expiry: args.mandate.expiry,
        constraints: {
          categories: args.mandate.category_whitelist || [],
          merchants: args.mandate.merchant_whitelist || [],
        },
      },
      provenance: {
        protocol: "MCP",
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
        sourceProtocol: "MCP",
        rawHash,
        agentId,
        adapterVersion: this.specificationVersion,
        details: {
          toolName: params.name,
          modelRuntime: model,
        },
      },
    };
  }
}
