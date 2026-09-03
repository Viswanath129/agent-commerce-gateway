import crypto from "node:crypto";
import { CanonicalIntentSchema, type CanonicalIntent } from "../../core/types.js";
import type { ProtocolAdapter, AdapterValidationResult, ACGIntent } from "../types.js";

export class ACGNativeAdapter implements ProtocolAdapter {
  public readonly protocol = "ACG" as const;
  public readonly displayName = "Native ACG Protocol";
  public readonly specificationVersion = "v1.0.0-verified";
  public readonly status = "LIVE" as const;
  public readonly description = "Direct native ACG canonical JSON format with Ed25519 principal mandate and untrusted LLM proposed items.";

  public async normalize(rawPayload: unknown, merchantId = "merch_acme_electronics_01"): Promise<AdapterValidationResult> {
    const rawHash = crypto.createHash("sha256").update(JSON.stringify(rawPayload || {})).digest("hex");

    const parsed = CanonicalIntentSchema.safeParse(rawPayload);
    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid Native ACG intent payload format",
        code: "INVALID_NATIVE_SCHEMA",
        details: parsed.error.format(),
      };
    }

    const intent: CanonicalIntent = parsed.data;

    const acgIntent: ACGIntent = {
      intentId: intent.intent_id,
      clientNonce: intent.client_nonce,
      timestamp: intent.timestamp,
      principal: {
        type: "human",
        id: `principal_${intent.mandate.principal_public_key.slice(0, 12)}`,
        publicKey: intent.mandate.principal_public_key,
      },
      agent: {
        id: "native-agent-session",
        provider: "Native",
        protocol: "ACG",
        publicKey: intent.mandate.principal_public_key,
        modelRuntime: "Universal",
      },
      action: {
        type: "PURCHASE",
      },
      merchant: {
        id: intent.mandate.merchant_whitelist?.[0] || merchantId,
      },
      items: intent.proposed_items.map((i) => ({ sku: i.sku, quantity: i.quantity })),
      authorization: {
        mandateId: intent.mandate.mandate_id,
        budgetLimitPaise: intent.mandate.budget_limit,
        expiry: intent.mandate.expiry,
        constraints: {
          categories: intent.mandate.category_whitelist || [],
          merchants: intent.mandate.merchant_whitelist || [],
        },
      },
      provenance: {
        protocol: "ACG",
        rawRequestHash: rawHash,
        normalizedAt: Date.now(),
      },
      canonical: intent,
    };

    return {
      success: true,
      intent,
      acgIntent,
      metadata: {
        sourceProtocol: "ACG",
        rawHash,
        agentId: "native-agent-session",
        adapterVersion: this.specificationVersion,
      },
    };
  }
}
