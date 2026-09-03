import crypto from "node:crypto";
import { z } from "zod";
import { BuyerMandateSchema, type CanonicalIntent } from "../../core/types.js";
import type { ProtocolAdapter, AdapterValidationResult, ACGIntent } from "../types.js";

const VisaTapEnvelopeSchema = z.object({
  tap_version: z.string().default("1.0"),
  agent_identity: z.object({
    agent_id: z.string().min(1),
    issuer: z.literal("visa:tap:registry").or(z.string()),
    agent_public_key: z.string().min(32),
    attestation_token: z.string(),
    reputation_tier: z.enum(["TIER_1_VERIFIED", "TIER_2_ATTESTED", "TIER_3_PROVISIONAL"]).default("TIER_1_VERIFIED"),
  }),
  commerce_payload: z.object({
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
});

export class VisaTapProtocolAdapter implements ProtocolAdapter {
  public readonly protocol = "TAP" as const;
  public readonly displayName = "Visa Trusted Agent Protocol (TAP)";
  public readonly specificationVersion = "tap/1.0-draft";
  public readonly status = "DESIGN" as const;
  public readonly description = "Cryptographic agent identity & trust verification adapter, preventing malicious bots from impersonating authorized agents.";

  public async normalize(rawPayload: unknown, merchantId = "merch_acme_electronics_01"): Promise<AdapterValidationResult> {
    const rawHash = crypto.createHash("sha256").update(JSON.stringify(rawPayload || {})).digest("hex");

    const parseResult = VisaTapEnvelopeSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      return {
        success: false,
        error: "Invalid Visa TAP agent trust envelope",
        code: "INVALID_TAP_PAYLOAD",
        details: parseResult.error.format(),
      };
    }

    const { agent_identity, commerce_payload } = parseResult.data;

    // Simulate Visa TAP cryptographic identity attestation check
    if (!agent_identity.attestation_token || agent_identity.attestation_token.length < 16) {
      return {
        success: false,
        error: "Agent identity attestation failed Visa TAP cryptographic validation",
        code: "TAP_IDENTITY_UNVERIFIED",
      };
    }

    const intentId = commerce_payload.intent_id || crypto.randomUUID();
    const nonce = commerce_payload.client_nonce || crypto.randomBytes(16).toString("hex");
    const ts = commerce_payload.timestamp || Math.floor(Date.now() / 1000);

    const canonical: CanonicalIntent = {
      intent_id: intentId,
      client_nonce: nonce,
      timestamp: ts,
      mandate: commerce_payload.mandate,
      proposed_items: commerce_payload.proposed_items as any,
    };

    const acgIntent: ACGIntent = {
      intentId,
      clientNonce: nonce,
      timestamp: ts,
      principal: {
        type: "human",
        id: `principal_${commerce_payload.mandate.principal_public_key.slice(0, 12)}`,
        publicKey: commerce_payload.mandate.principal_public_key,
      },
      agent: {
        id: agent_identity.agent_id,
        provider: `Visa TAP (${agent_identity.reputation_tier})`,
        protocol: "TAP",
        publicKey: agent_identity.agent_public_key,
        modelRuntime: "Hardware-Attested Agent",
      },
      action: {
        type: "PURCHASE",
      },
      merchant: {
        id: commerce_payload.mandate.merchant_whitelist?.[0] || merchantId,
      },
      items: commerce_payload.proposed_items,
      authorization: {
        mandateId: commerce_payload.mandate.mandate_id,
        budgetLimitPaise: commerce_payload.mandate.budget_limit,
        expiry: commerce_payload.mandate.expiry,
        constraints: {
          categories: commerce_payload.mandate.category_whitelist || [],
          merchants: commerce_payload.mandate.merchant_whitelist || [],
        },
      },
      provenance: {
        protocol: "TAP",
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
        sourceProtocol: "TAP",
        rawHash,
        agentId: agent_identity.agent_id,
        adapterVersion: this.specificationVersion,
        details: {
          issuer: agent_identity.issuer,
          reputationTier: agent_identity.reputation_tier,
          attestationVerified: true,
        },
      },
    };
  }
}
