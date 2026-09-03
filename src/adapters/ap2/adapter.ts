import crypto from "node:crypto";
import { z } from "zod";
import { BuyerMandateSchema, type CanonicalIntent } from "../../core/types.js";
import type { ProtocolAdapter, AdapterValidationResult, ACGIntent } from "../types.js";

const Ap2PaymentAuthorizationSchema = z.object({
  ap2_version: z.string().refine((v) => v.startsWith("0.2"), {
    message: "Expected AP2 v0.2.x specification",
  }),
  payment_intent_id: z.string().uuid().optional(),
  payer: z.object({
    principal_id: z.string().min(1),
    public_key: z.string().min(32),
  }),
  authorization_mandate: BuyerMandateSchema,
  cart: z.object({
    items: z.array(
      z.object({
        sku: z.string().min(1),
        qty: z.number().int().positive(),
      })
    ).nonempty(),
  }),
  nonce: z.string().min(16).optional(),
  created_at: z.number().int().positive().optional(),
});

export class Ap2ProtocolAdapter implements ProtocolAdapter {
  public readonly protocol = "AP2" as const;
  public readonly displayName = "Agent Payments Protocol (AP2)";
  public readonly specificationVersion = "v0.2.0";
  public readonly status = "ADAPTER READY" as const;
  public readonly description = "Maps AP2 payment authorization envelopes into canonical ACG intents. Note: AP2 payment mandate binding uses non-deterministic ECDSA checkout JWTs (v0.2), which ACG adapts into canonical merchant-side verification.";

  public async normalize(rawPayload: unknown, merchantId = "merch_acme_electronics_01"): Promise<AdapterValidationResult> {
    const rawHash = crypto.createHash("sha256").update(JSON.stringify(rawPayload || {})).digest("hex");

    const parseResult = Ap2PaymentAuthorizationSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      return {
        success: false,
        error: "Malformed AP2 payment authorization container",
        code: "INVALID_AP2_PAYLOAD",
        details: parseResult.error.format(),
      };
    }

    const data = parseResult.data;
    const intentId = data.payment_intent_id || crypto.randomUUID();
    const nonce = data.nonce || crypto.randomBytes(16).toString("hex");
    const ts = data.created_at || Math.floor(Date.now() / 1000);

    const canonical: CanonicalIntent = {
      intent_id: intentId,
      client_nonce: nonce,
      timestamp: ts,
      mandate: data.authorization_mandate,
      proposed_items: data.cart.items.map((i) => ({ sku: i.sku, quantity: i.qty })) as any,
    };

    const acgIntent: ACGIntent = {
      intentId,
      clientNonce: nonce,
      timestamp: ts,
      principal: {
        type: "human",
        id: data.payer.principal_id,
        publicKey: data.authorization_mandate.principal_public_key,
      },
      agent: {
        id: `ap2-agent-${intentId.slice(0, 8)}`,
        provider: "AP2 Working Group",
        protocol: "AP2",
        publicKey: data.payer.public_key,
      },
      action: {
        type: "PURCHASE",
      },
      merchant: {
        id: data.authorization_mandate.merchant_whitelist?.[0] || merchantId,
      },
      items: data.cart.items.map((i) => ({ sku: i.sku, quantity: i.qty })),
      authorization: {
        mandateId: data.authorization_mandate.mandate_id,
        budgetLimitPaise: data.authorization_mandate.budget_limit,
        expiry: data.authorization_mandate.expiry,
        constraints: {
          categories: data.authorization_mandate.category_whitelist || [],
          merchants: data.authorization_mandate.merchant_whitelist || [],
        },
      },
      provenance: {
        protocol: "AP2",
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
        sourceProtocol: "AP2",
        rawHash,
        agentId: `ap2-agent-${intentId.slice(0, 8)}`,
        adapterVersion: this.specificationVersion,
      },
    };
  }
}
