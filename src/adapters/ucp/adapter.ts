import crypto from "node:crypto";
import { z } from "zod";
import { BuyerMandateSchema, type CanonicalIntent } from "../../core/types.js";
import type { ProtocolAdapter, AdapterValidationResult, ACGIntent } from "../types.js";

const UcpJourneySchema = z.object({
  ucp_standard: z.string().refine((s) => s.startsWith("ucp"), {
    message: "Must specify Google UCP standard version (e.g. ucp-v1)",
  }),
  surface: z.string().default("assistant_checkout"),
  journey_id: z.string().min(1),
  checkout_request: z.object({
    intent_id: z.string().uuid().optional(),
    nonce: z.string().min(16).optional(),
    timestamp: z.number().int().positive().optional(),
    delegated_mandate: BuyerMandateSchema,
    order_lines: z.array(
      z.object({
        sku: z.string().min(1),
        quantity: z.number().int().positive(),
        title: z.string().optional(),
      })
    ).nonempty(),
  }),
});

export class UcpProtocolAdapter implements ProtocolAdapter {
  public readonly protocol = "UCP" as const;
  public readonly displayName = "Universal Commerce Protocol (UCP)";
  public readonly specificationVersion = "ucp-v1.2";
  public readonly status = "ADAPTER READY" as const;
  public readonly description = "Bridges Google UCP consumer surface journeys into canonical ACG intents.";

  public async normalize(rawPayload: unknown, merchantId = "merch_acme_electronics_01"): Promise<AdapterValidationResult> {
    const rawHash = crypto.createHash("sha256").update(JSON.stringify(rawPayload || {})).digest("hex");

    const parseResult = UcpJourneySchema.safeParse(rawPayload);
    if (!parseResult.success) {
      return {
        success: false,
        error: "Malformed Google UCP commerce journey payload",
        code: "INVALID_UCP_PAYLOAD",
        details: parseResult.error.format(),
      };
    }

    const { journey_id, surface, checkout_request } = parseResult.data;
    const intentId = checkout_request.intent_id || crypto.randomUUID();
    const nonce = checkout_request.nonce || crypto.randomBytes(16).toString("hex");
    const ts = checkout_request.timestamp || Math.floor(Date.now() / 1000);

    const canonical: CanonicalIntent = {
      intent_id: intentId,
      client_nonce: nonce,
      timestamp: ts,
      mandate: checkout_request.delegated_mandate,
      proposed_items: checkout_request.order_lines.map((i) => ({ sku: i.sku, quantity: i.quantity })) as any,
    };

    const acgIntent: ACGIntent = {
      intentId,
      clientNonce: nonce,
      timestamp: ts,
      principal: {
        type: "human",
        id: `principal_${checkout_request.delegated_mandate.principal_public_key.slice(0, 12)}`,
        publicKey: checkout_request.delegated_mandate.principal_public_key,
      },
      agent: {
        id: `ucp-surface-${surface}`,
        provider: "Google UCP",
        protocol: "UCP",
        modelRuntime: "Gemini Commerce Agent",
      },
      action: {
        type: "PURCHASE",
      },
      merchant: {
        id: checkout_request.delegated_mandate.merchant_whitelist?.[0] || merchantId,
      },
      items: checkout_request.order_lines.map((i) => ({ sku: i.sku, quantity: i.quantity })),
      authorization: {
        mandateId: checkout_request.delegated_mandate.mandate_id,
        budgetLimitPaise: checkout_request.delegated_mandate.budget_limit,
        expiry: checkout_request.delegated_mandate.expiry,
        constraints: {
          categories: checkout_request.delegated_mandate.category_whitelist || [],
          merchants: checkout_request.delegated_mandate.merchant_whitelist || [],
        },
      },
      provenance: {
        protocol: "UCP",
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
        sourceProtocol: "UCP",
        rawHash,
        agentId: `ucp-${surface}`,
        adapterVersion: this.specificationVersion,
        details: {
          journeyId: journey_id,
          surface,
        },
      },
    };
  }
}
