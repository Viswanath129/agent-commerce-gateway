import { describe, it, expect, beforeEach } from "vitest";
import fastify, { type FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { initDatabase, type SqliteDatabase } from "../../store/db.js";
import { registerGatewayRoutes } from "../../gateway/router.js";
import { generatePrincipalKeypair, signMandate } from "../crypto.js";
import { PolicyCompiler } from "../policy_compiler.js";
import { CapabilityNegotiator } from "../capability_negotiation.js";
import type { MerchantPolicy } from "../types.js";

describe("V4 — UNIVERSAL AGENT COMMERCE CONTROL PLANE TEST SUITE", () => {
  let app: FastifyInstance;
  let db: SqliteDatabase;
  let defaultPolicy: MerchantPolicy;
  let keypair: ReturnType<typeof generatePrincipalKeypair>;

  beforeEach(async () => {
    db = initDatabase(":memory:");
    defaultPolicy = {
      policy_version: "pol_v1.0.0",
      effective_at: Math.floor(Date.now() / 1000) - 3600,
      merchant_id: "merchant_luxury_india_01",
      max_transaction_amount: 5000000, // ₹50,000
      allowed_categories: ["electronics", "furniture", "stationery"],
      auto_refund_on_fulfillment_failure: true,
      min_margin_percentage: 15,
    };

    app = fastify();
    registerGatewayRoutes(app, db, defaultPolicy);
    await app.ready();
    keypair = generatePrincipalKeypair();
  });

  function createValidMandate(budgetPaise = 500000, expiryOffset = 3600) {
    const now = Math.floor(Date.now() / 1000);
    const mandateData = {
      mandate_id: `man_${crypto.randomUUID()}`,
      principal_public_key: keypair.publicKeyHex,
      budget_limit: budgetPaise,
      currency: "INR" as const,
      merchant_whitelist: [defaultPolicy.merchant_id],
      category_whitelist: ["electronics", "furniture"],
      expiry: now + expiryOffset,
    };
    const signature = signMandate(mandateData, keypair.privateKeyObject);
    return { ...mandateData, signature };
  }

  // ------------------------------------------------------------
  // V4.1 & V4.2: UNIVERSAL AUTHORIZATION API & CANONICAL IR
  // ------------------------------------------------------------
  describe("V4.1 & V4.2: Universal Authorization API & Canonical IR", () => {
    it("1.1 POST /v1/authorize successfully processes canonical financial action", async () => {
      const mandate = createValidMandate(500000);
      const intent = {
        intent_id: crypto.randomUUID(),
        client_nonce: crypto.randomBytes(16).toString("hex"),
        timestamp: Math.floor(Date.now() / 1000),
        mandate,
        proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
      };

      const res = await app.inject({
        method: "POST",
        url: "/v1/authorize",
        payload: intent,
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body);
      expect(data.status).toBe("ORDER_CREATED");
      expect(data.razorpay_order_id).toBeDefined();
      expect(data.amount_paise).toBe(212400); // ₹2,124.00
    });

    it("1.2 GET /v1/capabilities returns merchant accepted actions, rails, and constraints", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/v1/capabilities",
      });

      expect(res.statusCode).toBe(200);
      const caps = JSON.parse(res.body);
      expect(caps.merchant_id).toBe("merchant_luxury_india_01");
      expect(caps.accepted_actions).toContain("PURCHASE");
      expect(caps.supported_rails).toContain("RAZORPAY_SANDBOX");
      expect(caps.supported_protocols).toContain("MCP");
    });
  });

  // ------------------------------------------------------------
  // V4.3: CAPABILITY NEGOTIATION
  // ------------------------------------------------------------
  describe("V4.3: Capability Discovery & Negotiation", () => {
    it("2.1 Computes intersection of agent & merchant capabilities without granting authority", async () => {
      const agentCaps = {
        agentId: "agent_claude_procure",
        supportedActions: ["PURCHASE", "REFUND", "TRANSFER"],
        supportedCurrencies: ["INR", "USD"],
        supportedProtocols: ["MCP", "A2A"],
        maxTransactionPaise: 10000000, // ₹1,00,000
      };

      const res = await app.inject({
        method: "POST",
        url: "/v1/capabilities/negotiate",
        payload: { agent: agentCaps },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.status).toBe("COMPATIBLE");
      expect(data.negotiatedActions).toEqual(["PURCHASE", "REFUND"]);
      expect(data.negotiatedCurrencies).toEqual(["INR"]);
      // Effective limit bounded by merchant policy (₹50,000)
      expect(data.effectiveTransactionLimitPaise).toBe(5000000);
      expect(data.disclaimer).toContain("Negotiation establishes protocol compatibility only");
    });
  });

  // ------------------------------------------------------------
  // V4.6: MULTI-AGENT DELEGATION
  // ------------------------------------------------------------
  describe("V4.6: Multi-Agent Delegation Controls", () => {
    it("3.1 Parent agent delegates bounded budget to child sub-agent and enforces escalation bounds", async () => {
      const { principalRegistry, delegationEngine } = registerGatewayRoutes(fastify(), db, defaultPolicy);
      const now = Math.floor(Date.now() / 1000);

      // Register Parent & Child
      principalRegistry.upsertPrincipal({
        agent_id: "agent_parent_alpha",
        organization_id: "org_enterprise",
        provider: "anthropic",
        model_name: "claude-3-7-sonnet",
        agent_type: "AUTONOMOUS",
        trust_level: "ENTERPRISE",
        credential_state: "ACTIVE",
        created_at: now,
        expires_at: now + 36000,
        status: "ACTIVE",
      });

      principalRegistry.upsertCapability({
        capability_id: "cap_parent",
        agent_id: "agent_parent_alpha",
        capability: "PURCHASE",
        max_amount: 10000000, // ₹1,00,000 ceiling
        currency: "INR",
        categories: ["*"],
        merchant_scope: ["*"],
        daily_budget: 50000000,
        daily_spent: 0,
        confirmation_above: 2000000,
        expires_at: now + 36000,
        status: "ACTIVE",
        created_at: now,
      });

      // 1. Create valid delegation: Child capped at ₹20,000 (2000000 paise)
      const delegationRes = await app.inject({
        method: "POST",
        url: "/v1/delegations",
        headers: { authorization: "Bearer secret_merchant_admin" },
        payload: {
          parent_agent_id: "agent_parent_alpha",
          child_agent_id: "agent_child_beta",
          max_amount_paise: 2000000,
          allowed_actions: ["PURCHASE"],
          duration_seconds: 3600,
        },
      });

      expect(delegationRes.statusCode).toBe(201);
      const grant = JSON.parse(delegationRes.body);
      expect(grant.delegationId).toBeDefined();

      // 2. Validate delegation within bounds -> Valid
      const checkValid = delegationEngine.validateDelegation(
        grant.delegationId,
        "agent_child_beta",
        defaultPolicy.merchant_id,
        1500000,
        "PURCHASE"
      );
      expect(checkValid.valid).toBe(true);

      // 3. Child attempt to exceed delegated ceiling (₹30,000 > ₹20,000) -> Blocked
      const checkEscalate = delegationEngine.validateDelegation(
        grant.delegationId,
        "agent_child_beta",
        defaultPolicy.merchant_id,
        3000000,
        "PURCHASE"
      );
      expect(checkEscalate.valid).toBe(false);
      expect(checkEscalate.code).toBe("DELEGATION_AMOUNT_EXCEEDED");

      // 4. Revoking parent agent immediately invalidates child delegation
      principalRegistry.setAgentStatus("agent_parent_alpha", "REVOKED");
      const checkRevokedParent = delegationEngine.validateDelegation(
        grant.delegationId,
        "agent_child_beta",
        defaultPolicy.merchant_id,
        100000,
        "PURCHASE"
      );
      expect(checkRevokedParent.valid).toBe(false);
      expect(checkRevokedParent.code).toBe("PARENT_AGENT_INACTIVE");
    });
  });

  // ------------------------------------------------------------
  // V4.8: POLICY COMPILER & VALIDATOR
  // ------------------------------------------------------------
  describe("V4.8: Policy Compiler & DSL Validation", () => {
    it("4.1 Compiles valid Policy DSL into runtime policy and rejects invalid schemas", async () => {
      const validDSL = {
        version: "pol_v2.1.0",
        merchant_id: "merchant_luxury_india_01",
        rules: {
          max_transaction_amount_inr: 25000,
          allowed_store_categories: ["electronics", "apparel"],
          auto_refund_stockout: true,
          min_gross_margin_bps: 1800,
          confirmation_threshold_inr: 5000,
        },
      };

      const res = await app.inject({
        method: "POST",
        url: "/v1/policies/compile",
        payload: validDSL,
      });

      expect(res.statusCode).toBe(200);
      const compiled = JSON.parse(res.body);
      expect(compiled.runtimePolicy.policy_version).toBe("pol_v2.1.0");
      expect(compiled.runtimePolicy.max_transaction_amount).toBe(2500000); // 25,000 * 100 paise
      expect(compiled.hash).toBeDefined();

      // Invalid schema (malformed version string)
      const invalidRes = await app.inject({
        method: "POST",
        url: "/v1/policies/compile",
        payload: { ...validDSL, version: "invalid_version_tag" },
      });
      expect(invalidRes.statusCode).toBe(400);
    });

    it("4.2 Updates policy dynamically via POST /v1/policies", async () => {
      const updateRes = await app.inject({
        method: "POST",
        url: "/v1/policies",
        headers: { authorization: "Bearer secret_merchant_admin" },
        payload: {
          version: "pol_v2.5.0",
          merchant_id: "merchant_luxury_india_01",
          rules: {
            max_transaction_amount_inr: 10000,
            allowed_store_categories: ["electronics"],
            auto_refund_stockout: true,
            min_gross_margin_bps: 2000,
            confirmation_threshold_inr: 4000,
          },
        },
      });

      expect(updateRes.statusCode).toBe(200);
      const data = JSON.parse(updateRes.body);
      expect(data.status).toBe("POLICY_UPDATED");
      expect(data.policy.policy_version).toBe("pol_v2.5.0");
      expect(data.policy.max_transaction_amount).toBe(1000000);
    });
  });

  // ------------------------------------------------------------
  // V4.1: UNIVERSAL ENDPOINTS (MANDATES, RESERVATIONS, AUDIT, HEALTH)
  // ------------------------------------------------------------
  describe("V4.1: Universal Control Plane Endpoints", () => {
    it("1.3 Registers mandate via POST /v1/mandates and holds reservation via POST /v1/reservations", async () => {
      const mandate = createValidMandate(500000);

      // Register mandate
      const manRes = await app.inject({
        method: "POST",
        url: "/v1/mandates",
        payload: mandate,
      });

      expect(manRes.statusCode).toBe(201);
      const manData = JSON.parse(manRes.body);
      expect(manData.status).toBe("MANDATE_REGISTERED");

      // Hold reservation
      const resRes = await app.inject({
        method: "POST",
        url: "/v1/reservations",
        headers: { authorization: "Bearer secret_merchant_admin" },
        payload: {
          intent_id: crypto.randomUUID(),
          mandate,
          items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
        },
      });

      expect(resRes.statusCode).toBe(201);
      const resData = JSON.parse(resRes.body);
      expect(resData.success).toBe(true);
      expect(resData.reservationId).toBeDefined();

      // Check health and audit shortcuts
      const healthRes = await app.inject({ method: "GET", url: "/v1/health" });
      expect(healthRes.statusCode).toBe(200);
      expect(JSON.parse(healthRes.body).status).toBe("HEALTHY");

      const auditRes = await app.inject({ method: "GET", url: `/v1/audit/${mandate.mandate_id}` });
      expect(auditRes.statusCode).toBe(200);
    });
  });

  // ------------------------------------------------------------
  // V4.5: MCP INTEGRATION BOUNDARY
  // ------------------------------------------------------------
  describe("V4.5: ACG MCP Tool Ingress Surface", () => {
    it("5.1 Lists all 6 MCP tools and invokes MCP tools through ACG control boundary", async () => {
      // 1. List tools
      const toolsRes = await app.inject({
        method: "GET",
        url: "/v1/mcp/tools",
      });
      expect(toolsRes.statusCode).toBe(200);
      const { tools } = JSON.parse(toolsRes.body);
      const toolNames = tools.map((t: any) => t.name);
      expect(toolNames).toContain("authorize_financial_action");
      expect(toolNames).toContain("simulate_financial_action");
      expect(toolNames).toContain("get_authorization_decision");
      expect(toolNames).toContain("get_agent_capabilities");
      expect(toolNames).toContain("get_policy");
      expect(toolNames).toContain("get_audit_record");

      // 2. Call tool: simulate_financial_action
      const mandate = createValidMandate(500000);
      const intent = {
        intent_id: crypto.randomUUID(),
        client_nonce: crypto.randomBytes(16).toString("hex"),
        timestamp: Math.floor(Date.now() / 1000),
        mandate,
        proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
      };

      const simCall = await app.inject({
        method: "POST",
        url: "/v1/mcp/call",
        payload: {
          name: "simulate_financial_action",
          arguments: { intent, agent_id: "native-llm-agent" },
        },
      });

      expect(simCall.statusCode).toBe(200);
      const simData = JSON.parse(simCall.body);
      expect(simData.result.verdict).toBe("WOULD_ALLOW");
      expect(simData.result.non_mutating).toBe(true);

      // 3. Call tool: authorize_financial_action
      const authCall = await app.inject({
        method: "POST",
        url: "/v1/mcp/call",
        payload: {
          name: "authorize_financial_action",
          arguments: { intent, agent_id: "native-llm-agent" },
        },
      });
      expect(authCall.statusCode).toBe(200);
      const authData = JSON.parse(authCall.body);
      expect(authData.result.decision.decision).toBe("ALLOW");
      const decisionId = authData.result.decision.decision_id;

      // 4. Call tool: get_authorization_decision
      const decCall = await app.inject({
        method: "POST",
        url: "/v1/mcp/call",
        payload: {
          name: "get_authorization_decision",
          arguments: { decision_id: decisionId },
        },
      });
      expect(decCall.statusCode).toBe(200);
      expect(JSON.parse(decCall.body).result.decision_id).toBe(decisionId);

      // 5. Call tool: get_policy
      const polCall = await app.inject({
        method: "POST",
        url: "/v1/mcp/call",
        payload: {
          name: "get_policy",
          arguments: {},
        },
      });
      expect(polCall.statusCode).toBe(200);
      expect(JSON.parse(polCall.body).result.policy.policy_version).toBeDefined();

      // 6. Call tool: get_agent_capabilities
      const capCall = await app.inject({
        method: "POST",
        url: "/v1/mcp/call",
        payload: {
          name: "get_agent_capabilities",
          arguments: { agent_id: "native-llm-agent" },
        },
      });
      expect(capCall.statusCode).toBe(200);
      expect(JSON.parse(capCall.body).result.capabilities.length).toBeGreaterThan(0);
    });
  });
});
