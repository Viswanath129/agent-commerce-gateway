import crypto from "node:crypto";
import { z } from "zod";
import { BuyerMandateSchema, type CanonicalIntent } from "../../core/types.js";
import type { ProtocolAdapter, AdapterValidationResult, ACGIntent } from "../types.js";

const A2AMessageSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]),
  method: z.string().refine((m) => m.startsWith("a2a.commerce."), {
    message: "A2A method must start with 'a2a.commerce.'",
  }),
  params: z.object({
    taskId: z.string().min(1),
    senderAgent: z.object({
      id: z.string().min(1),
      did: z.string().optional(),
      framework: z.string().optional(),
    }),
    recipientAgent: z.object({
      id: z.string().min(1),
    }),
    payload: z.object({
      intent_id: z.string().uuid().optional(),
      client_nonce: z.string().min(16).optional(),
      timestamp: z.number().int().positive().optional(),
      mandate: BuyerMandateSchema,
      proposed_items: z.array(
        z.object({
          sku: z.string().min(1),
          quantity: z.number().int().positive(),
        })
      ).nonempty(),
    }),
  }),
});

export class A2AProtocolAdapter implements ProtocolAdapter {
  public readonly protocol = "A2A" as const;
  public readonly displayName = "Agent2Agent (A2A) Protocol";
  public readonly specificationVersion = "2026.1-LF";
  public readonly status = "ADAPTER READY" as const;
  public readonly description = "Translates Linux Foundation A2A inter-agent commerce task RPCs into canonical ACG intents.";

  public async normalize(rawPayload: unknown, merchantId = "merch_acme_electronics_01"): Promise<AdapterValidationResult> {
    const rawHash = crypto.createHash("sha256").update(JSON.stringify(rawPayload || {})).digest("hex");

    const parseResult = A2AMessageSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      return {
        success: false,
        error: "Malformed A2A inter-agent commerce RPC payload",
        code: "INVALID_A2A_PAYLOAD",
        details: parseResult.error.format(),
      };
    }

    const { params } = parseResult.data;
    const body = params.payload;
    const intentId = body.intent_id || crypto.randomUUID();
    const nonce = body.client_nonce || crypto.randomBytes(16).toString("hex");
    const ts = body.timestamp || Math.floor(Date.now() / 1000);

    const canonical: CanonicalIntent = {
      intent_id: intentId,
      client_nonce: nonce,
      timestamp: ts,
      mandate: body.mandate,
      proposed_items: body.proposed_items as any,
    };

    const acgIntent: ACGIntent = {
      intentId,
      clientNonce: nonce,
      timestamp: ts,
      principal: {
        type: "human",
        id: `principal_${body.mandate.principal_public_key.slice(0, 12)}`,
        publicKey: body.mandate.principal_public_key,
      },
      agent: {
        id: params.senderAgent.id,
        provider: params.senderAgent.framework || "A2A-Federation",
        protocol: "A2A",
        publicKey: params.senderAgent.did,
      },
      action: {
        type: "PURCHASE",
      },
      merchant: {
        id: body.mandate.merchant_whitelist?.[0] || merchantId,
      },
      items: body.proposed_items,
      authorization: {
        mandateId: body.mandate.mandate_id,
        budgetLimitPaise: body.mandate.budget_limit,
        expiry: body.mandate.expiry,
        constraints: {
          categories: body.mandate.category_whitelist || [],
          merchants: body.mandate.merchant_whitelist || [],
        },
      },
      provenance: {
        protocol: "A2A",
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
        sourceProtocol: "A2A",
        rawHash,
        agentId: params.senderAgent.id,
        adapterVersion: this.specificationVersion,
        details: {
          taskId: params.taskId,
          senderDid: params.senderAgent.did,
        },
      },
    };
  }
}
