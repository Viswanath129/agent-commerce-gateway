import { describe, it, expect, beforeEach } from "vitest";
import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../server.js";
import { initDatabase } from "../../store/db.js";
import { generatePrincipalKeypair, signMandate } from "../crypto.js";
import { defaultAdapterRegistry } from "../../adapters/index.js";
import { RazorpayVulcanIntelligenceProvider } from "../../rails/intelligence.js";
import type { BuyerMandate, MerchantPolicy } from "../types.js";

describe("ACG Protocol-Agnostic Adapter & Vulcan Intelligence Test Suite", () => {
  let app: FastifyInstance;
  let keypair: ReturnType<typeof generatePrincipalKeypair>;
  let now: number;
  let validMandate: BuyerMandate;

  beforeEach(async () => {
    const db = initDatabase(":memory:");
    const initialPolicy: MerchantPolicy = {
      policy_version: "pol_v1.0.0",
      effective_at: Math.floor(Date.now() / 1000),
      merchant_id: "merch_acme_electronics_01",
      max_transaction_amount: 5000000,
      allowed_categories: ["electronics", "furniture", "accessories"],
      auto_refund_on_fulfillment_failure: true,
      min_margin_percentage: 15,
    };
    const serverInstance = await buildApp(db, initialPolicy);
    app = serverInstance.app;

    keypair = generatePrincipalKeypair();
    now = Math.floor(Date.now() / 1000);

    const mandateData = {
      mandate_id: `man_adapter_test_${Date.now()}`,
      principal_public_key: keypair.publicKeyHex,
      budget_limit: 500000, // ₹5,000.00
      currency: "INR" as const,
      merchant_whitelist: ["merch_acme_electronics_01"],
      category_whitelist: ["electronics"],
      expiry: now + 3600,
    };
    const signature = signMandate(mandateData, keypair.privateKeyObject);
    validMandate = { ...mandateData, signature };
  });

  // ==========================================
  // 1. PROTOCOL ADAPTER REGISTRY UNIT TESTS
  // ==========================================
  describe("Protocol Adapter Normalization Unit Tests", () => {
    it("1.1 Native ACG Adapter - Normalizes direct canonical payload", async () => {
      const adapter = defaultAdapterRegistry.get("acg");
      expect(adapter).toBeDefined();
      expect(adapter?.status).toBe("LIVE");

      const payload = {
        intent_id: crypto.randomUUID(),
        client_nonce: crypto.randomBytes(16).toString("hex"),
        timestamp: now,
        mandate: validMandate,
        proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
      };

      const result = await adapter!.normalize(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.intent_id).toBe(payload.intent_id);
        expect(result.acgIntent.provenance.protocol).toBe("ACG");
        expect(result.metadata.sourceProtocol).toBe("ACG");
      }
    });

    it("1.2 MCP Adapter - Normalizes Model Context Protocol tools/call invocation", async () => {
      const adapter = defaultAdapterRegistry.get("mcp");
      expect(adapter).toBeDefined();
      expect(adapter?.status).toBe("ADAPTER READY");

      const intentId = crypto.randomUUID();
      const mcpPayload = {
        method: "tools/call",
        params: {
          name: "acg_checkout",
          arguments: {
            intent_id: intentId,
            client_nonce: crypto.randomBytes(16).toString("hex"),
            timestamp: now,
            mandate: validMandate,
            items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
            agent_metadata: { agent_id: "claude-procure-bot" },
          },
        },
      };

      const result = await adapter!.normalize(mcpPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.intent_id).toBe(intentId);
        expect(result.acgIntent.provenance.protocol).toBe("MCP");
        expect(result.metadata.sourceProtocol).toBe("MCP");
      }
    });

    it("1.3 A2A Adapter - Normalizes Linux Foundation Agent2Agent RPC message", async () => {
      const adapter = defaultAdapterRegistry.get("a2a");
      expect(adapter).toBeDefined();
      expect(adapter?.status).toBe("ADAPTER READY");

      const a2aPayload = {
        jsonrpc: "2.0",
        id: 101,
        method: "a2a.commerce.proposeTransaction",
        params: {
          taskId: "task_autonomous_procurement_99",
          senderAgent: { id: "agent_alpha", did: "did:key:z6Mku", framework: "A2A-v1" },
          recipientAgent: { id: "acg_gateway" },
          payload: {
            intent_id: crypto.randomUUID(),
            client_nonce: crypto.randomBytes(16).toString("hex"),
            timestamp: now,
            mandate: validMandate,
            proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
          },
        },
      };

      const result = await adapter!.normalize(a2aPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.acgIntent.agent.protocol).toBe("A2A");
        expect(result.acgIntent.agent.id).toBe("agent_alpha");
      }
    });

    it("1.4 ACP Adapter - Normalizes Agentic Commerce Protocol container", async () => {
      const adapter = defaultAdapterRegistry.get("acp");
      expect(adapter).toBeDefined();

      const acpPayload = {
        protocol_version: "acp/1.0",
        transaction_id: crypto.randomUUID(),
        session_nonce: crypto.randomBytes(16).toString("hex"),
        timestamp: now,
        buyer_principal: { id: "principal_user_1", public_key: keypair.publicKeyHex },
        commerce_mandate: validMandate,
        line_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1, estimated_price_paise: 212400 }],
      };

      const result = await adapter!.normalize(acpPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.acgIntent.provenance.protocol).toBe("ACP");
      }
    });

    it("1.5 AP2 Adapter - Normalizes Agent Payments Protocol v0.2 authorization", async () => {
      const adapter = defaultAdapterRegistry.get("ap2");
      expect(adapter).toBeDefined();

      const ap2Payload = {
        ap2_version: "0.2.0",
        payment_intent_id: crypto.randomUUID(),
        nonce: crypto.randomBytes(16).toString("hex"),
        created_at: now,
        payer: { principal_id: "ap2_payer_42", public_key: keypair.publicKeyHex },
        authorization_mandate: validMandate,
        cart: { items: [{ sku: "SKU-MOUSE-PRO", qty: 1 }] },
      };

      const result = await adapter!.normalize(ap2Payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.acgIntent.provenance.protocol).toBe("AP2");
      }
    });

    it("1.6 UCP Adapter - Normalizes Google Universal Commerce Protocol journey", async () => {
      const adapter = defaultAdapterRegistry.get("ucp");
      expect(adapter).toBeDefined();

      const ucpPayload = {
        ucp_standard: "ucp-v1.2",
        surface: "gemini_voice_assistant",
        journey_id: "journey_search_to_cart_77",
        checkout_request: {
          intent_id: crypto.randomUUID(),
          nonce: crypto.randomBytes(16).toString("hex"),
          timestamp: now,
          delegated_mandate: validMandate,
          order_lines: [{ sku: "SKU-MOUSE-PRO", quantity: 1, title: "Precision Wireless Mouse" }],
        },
      };

      const result = await adapter!.normalize(ucpPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.acgIntent.agent.protocol).toBe("UCP");
        expect(result.acgIntent.agent.modelRuntime).toBe("Gemini Commerce Agent");
      }
    });

    it("1.7 Visa TAP Adapter - Verifies agent trust attestation token", async () => {
      const adapter = defaultAdapterRegistry.get("tap");
      expect(adapter).toBeDefined();
      expect(adapter?.status).toBe("DESIGN");

      const validTapPayload = {
        tap_version: "1.0",
        agent_identity: {
          agent_id: "agent_hardware_tee_01",
          issuer: "visa:tap:registry",
          agent_public_key: crypto.randomBytes(32).toString("hex"),
          attestation_token: "attest_tok_hardware_tee_valid_signature_xyz123",
          reputation_tier: "TIER_1_VERIFIED" as const,
        },
        commerce_payload: {
          intent_id: crypto.randomUUID(),
          client_nonce: crypto.randomBytes(16).toString("hex"),
          timestamp: now,
          mandate: validMandate,
          proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
        },
      };

      const result = await adapter!.normalize(validTapPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.acgIntent.agent.protocol).toBe("TAP");
        expect(result.metadata.details).toHaveProperty("attestationVerified", true);
      }

      // Test rejection of missing/short attestation token
      const invalidTapPayload = {
        ...validTapPayload,
        agent_identity: {
          ...validTapPayload.agent_identity,
          attestation_token: "short",
        },
      };
      const invalidResult = await adapter!.normalize(invalidTapPayload);
      expect(invalidResult.success).toBe(false);
      if (!invalidResult.success) {
        expect(invalidResult.code).toBe("TAP_IDENTITY_UNVERIFIED");
      }
    });
  });

  // ==========================================
  // 2. PAYMENT INTELLIGENCE BOUNDARY (RAZORPAY VULCAN)
  // ==========================================
  describe("Razorpay Vulcan AI Foundation Model Boundary", () => {
    it("2.1 Evaluates risk signals and optimal rail telemetry without usurping authority", async () => {
      const vulcan = new RazorpayVulcanIntelligenceProvider();

      const evaluation = await vulcan.evaluate({
        intentId: crypto.randomUUID(),
        merchantId: "merch_acme_electronics_01",
        amountPaise: 212400, // ₹2,124.00
        currency: "INR",
        itemCategories: ["electronics"],
        mandateId: validMandate.mandate_id,
        protocol: "MCP",
      });

      expect(evaluation.provider).toBe("Razorpay Vulcan [Architecture Ready]");
      expect(evaluation.riskSignals.riskScore).toBeLessThan(0.1);
      expect(evaluation.riskSignals.recommendedAction).toBe("PROCEED");
      expect(evaluation.routingHints.optimalRail).toBeDefined();
      expect(evaluation.authorityDisclaimer).toContain("ACG enforces binding merchant authorization");
    });
  });

  // ==========================================
  // 3. FULL END-TO-END GATEWAY INGRESS API
  // ==========================================
  describe("End-to-End Universal Ingress API: /v1/agent/ingress/:protocol", () => {
    it("3.1 Ingress via MCP - Executes atomic checkout and returns Vulcan intelligence hints", async () => {
      const intentId = crypto.randomUUID();
      const mcpPayload = {
        method: "tools/call",
        params: {
          name: "acg_checkout",
          arguments: {
            intent_id: intentId,
            client_nonce: crypto.randomBytes(16).toString("hex"),
            timestamp: now,
            mandate: validMandate,
            items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
            agent_metadata: { model_runtime: "claude-3-7-sonnet" },
          },
        },
      };

      const res = await app.inject({
        method: "POST",
        url: "/v1/agent/ingress/mcp",
        payload: mcpPayload,
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body);
      expect(data.status).toBe("ORDER_CREATED");
      expect(data.ingress_protocol).toBe("MCP");
      expect(data.reservation_id).toBeDefined();
      expect(data.payment_intelligence.provider).toBe("Razorpay Vulcan [Architecture Ready]");
      expect(data.payment_intelligence).toHaveProperty("optimal_rail");
    });

    it("3.2 Ingress via AP2 - Enforces full cryptographic mandate verification", async () => {
      const ap2Payload = {
        ap2_version: "0.2.0",
        payment_intent_id: crypto.randomUUID(),
        nonce: crypto.randomBytes(16).toString("hex"),
        created_at: now,
        payer: { principal_id: "ap2_buyer", public_key: keypair.publicKeyHex },
        authorization_mandate: validMandate,
        cart: { items: [{ sku: "SKU-MOUSE-PRO", qty: 1 }] },
      };

      const res = await app.inject({
        method: "POST",
        url: "/v1/agent/ingress/ap2",
        payload: ap2Payload,
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body);
      expect(data.status).toBe("ORDER_CREATED");
      expect(data.ingress_protocol).toBe("AP2");
    });

    it("3.3 Rejects unknown protocol gracefully with 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/v1/agent/ingress/unsupported_proto",
        payload: { something: "arbitrary" },
      });

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res.body);
      expect(data.error).toBe("UNSUPPORTED_PROTOCOL");
    });
  });

  // ==========================================
  // 4. AGENT COMPATIBILITY MATRIX API
  // ==========================================
  describe("Dashboard Compatibility Matrix Endpoints", () => {
    it("4.1 GET /dashboard/compatibility - Returns accurate model, protocol, intelligence, and rails state", async () => {
      const res = await app.inject({ method: "GET", url: "/dashboard/compatibility" });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);

      expect(data.summary.core_thesis).toContain("We don't replace the agent, the protocol, the payment intelligence, or Razorpay");
      expect(data.models.find((m: any) => m.name.includes("OpenAI"))?.status).toBe("READY");
      expect(data.protocols.find((p: any) => p.code === "ACG")?.status).toBe("LIVE");
      expect(data.protocols.find((p: any) => p.code === "REST")?.status).toBe("LIVE");
      expect(data.protocols.find((p: any) => p.code === "MCP")?.status).toBe("ADAPTER READY");
      expect(data.protocols.find((p: any) => p.code === "A2A")?.status).toBe("ADAPTER READY");
      expect(data.protocols.find((p: any) => p.code === "ACP")?.status).toBe("ADAPTER READY");
      expect(data.protocols.find((p: any) => p.code === "AP2")?.status).toBe("ADAPTER READY");
      expect(data.protocols.find((p: any) => p.code === "UCP")?.status).toBe("ADAPTER READY");
      expect(data.protocols.find((p: any) => p.code === "TAP")?.status).toBe("DESIGN");
      expect(data.payment_intelligence.find((pi: any) => pi.name === "Razorpay Vulcan")?.status).toBe("ARCHITECTURE READY");
      expect(data.payment_rails.find((pr: any) => pr.name.includes("Razorpay"))?.status).toBe("LIVE");
    });

    it("4.2 POST /dashboard/compatibility/test-adapter - Interactively executes protocol adapter live simulation", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/dashboard/compatibility/test-adapter",
        payload: { protocol: "mcp" },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body);
      expect(data.status).toBe("ORDER_CREATED");
      expect(data.ingress_protocol).toBe("MCP");
    });
  });
});
