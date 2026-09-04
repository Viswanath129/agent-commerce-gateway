import { describe, it, expect, beforeEach } from "vitest";
import fastify, { type FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { initDatabase, type SqliteDatabase } from "../../store/db.js";
import { registerGatewayRoutes } from "../../gateway/router.js";
import { generatePrincipalKeypair, signMandate } from "../crypto.js";
import { FinancialStateMachine } from "../state_machine.js";
import type { MerchantPolicy, CanonicalIntent } from "../types.js";

describe("V2 — AGENT FINANCIAL CONTROL PLANE TEST SUITE", () => {
  let app: FastifyInstance;
  let db: SqliteDatabase;
  let defaultPolicy: MerchantPolicy;
  let keypair: ReturnType<typeof generatePrincipalKeypair>;
  let services: any;

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
    services = registerGatewayRoutes(app, db, defaultPolicy);
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
  // V2.1: AGENT IDENTITY & PRINCIPAL MODEL
  // ------------------------------------------------------------
  describe("V2.1: Agent Principal Identity & Trust", () => {
    it("1.1 Registers and retrieves first-class Agent Principal with trust levels", async () => {
      const payload = {
        agent_id: "agent_procure_alpha",
        organization_id: "org_enterprise_corp",
        provider: "anthropic",
        model_name: "claude-3-7-sonnet",
        agent_type: "AUTONOMOUS",
        trust_level: "ENTERPRISE",
        credential_state: "ACTIVE",
        status: "ACTIVE",
        capabilities: [
          {
            capability: "PURCHASE",
            max_amount: 2000000, // ₹20,000
            daily_budget: 10000000, // ₹1,00,000
            confirmation_above: 1000000, // ₹10,000
          },
        ],
      };

      const res = await app.inject({
        method: "POST",
        url: "/v1/agents",
        payload,
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body);
      expect(data.principal.agent_id).toBe("agent_procure_alpha");
      expect(data.principal.trust_level).toBe("ENTERPRISE");

      const getRes = await app.inject({
        method: "GET",
        url: "/v1/agents/agent_procure_alpha",
      });
      expect(getRes.statusCode).toBe(200);
      const retrieved = JSON.parse(getRes.body);
      expect(retrieved.agent.agent_id).toBe("agent_procure_alpha");
      expect(retrieved.capabilities.length).toBe(1);
      expect(retrieved.capabilities[0].capability).toBe("PURCHASE");
    });

    it("1.2 Blocks checkout when Agent Principal is SUSPENDED or REVOKED", async () => {
      const { principalRegistry, pdp } = registerGatewayRoutes(fastify(), db, defaultPolicy);
      principalRegistry.upsertPrincipal({
        agent_id: "agent_rogue_01",
        organization_id: "org_unknown",
        provider: "openai",
        model_name: "gpt-4o",
        agent_type: "AUTONOMOUS",
        trust_level: "PROVISIONAL",
        credential_state: "ACTIVE",
        created_at: Math.floor(Date.now() / 1000),
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        status: "SUSPENDED",
      });

      const mandate = createValidMandate();
      const intent: CanonicalIntent = {
        intent_id: crypto.randomUUID(),
        client_nonce: crypto.randomBytes(16).toString("hex"),
        timestamp: Math.floor(Date.now() / 1000),
        mandate,
        proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
      };

      const evalRes = pdp.evaluateIntent(intent, defaultPolicy, "agent_rogue_01");
      expect(evalRes.decision.decision).toBe("DENY");
      expect(evalRes.decision.reason_code).toBe("AGENT_SUSPENDED");
    });
  });

  // ------------------------------------------------------------
  // V2.2: CAPABILITY-BASED AUTHORIZATION
  // ------------------------------------------------------------
  describe("V2.2: Capability-Based Authorization", () => {
    it("2.1 Enforces capability max_amount ceiling and category restrictions", async () => {
      const { principalRegistry, pdp } = registerGatewayRoutes(fastify(), db, defaultPolicy);
      const now = Math.floor(Date.now() / 1000);

      principalRegistry.upsertPrincipal({
        agent_id: "agent_budget_constrained",
        organization_id: "org_small",
        provider: "custom",
        model_name: "model-mini",
        agent_type: "AUTONOMOUS",
        trust_level: "VERIFIED",
        credential_state: "ACTIVE",
        created_at: now,
        expires_at: now + 3600,
        status: "ACTIVE",
      });

      principalRegistry.upsertCapability({
        capability_id: "cap_constrained",
        agent_id: "agent_budget_constrained",
        capability: "PURCHASE",
        max_amount: 100000, // ₹1,000 max single tx
        currency: "INR",
        categories: ["stationery"], // Restricted to stationery only
        merchant_scope: ["*"],
        daily_budget: 500000,
        daily_spent: 0,
        confirmation_above: 50000,
        expires_at: now + 3600,
        status: "ACTIVE",
        created_at: now,
      });

      const mandate = createValidMandate(1000000);

      // Attempt 1: Buying electronics (mouse ₹2,124) -> Should DENY (category restriction & tx ceiling)
      const intent: CanonicalIntent = {
        intent_id: crypto.randomUUID(),
        client_nonce: crypto.randomBytes(16).toString("hex"),
        timestamp: now,
        mandate,
        proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
      };

      const evalRes = pdp.evaluateIntent(intent, defaultPolicy, "agent_budget_constrained");
      expect(evalRes.decision.decision).toBe("DENY");
      expect(evalRes.decision.reason_code).toBe("AGENT_CATEGORY_RESTRICTED");
    });
  });

  // ------------------------------------------------------------
  // V2.3 & V2.4: POLICY DECISION POINT & HUMAN CONFIRMATION
  // ------------------------------------------------------------
  describe("V2.3 & V2.4: Policy Decision Point & Human Confirmation", () => {
    it("3.1 Returns REQUIRE_CONFIRMATION above threshold, generates confirmation token, and confirms cleanly", async () => {
      const now = Math.floor(Date.now() / 1000);
      services.principalRegistry.upsertCapability({
        capability_id: "cap_native_purchase",
        agent_id: "native-llm-agent",
        capability: "PURCHASE",
        max_amount: 10000000,
        currency: "INR",
        categories: ["*"],
        merchant_scope: ["*"],
        daily_budget: 50000000,
        daily_spent: 0,
        confirmation_above: 300000, // ₹3,000 threshold for confirmation test
        expires_at: now + 3600,
        status: "ACTIVE",
        created_at: now,
      });

      const mandate = createValidMandate(2000000); // ₹20,000 mandate
      const intent: CanonicalIntent = {
        intent_id: crypto.randomUUID(),
        client_nonce: crypto.randomBytes(16).toString("hex"),
        timestamp: now,
        mandate,
        // SKU-KEYBOARD-RGB is ₹4,130 -> Exceeds confirmation_above (₹3,000)
        proposed_items: [{ sku: "SKU-KEYBOARD-RGB", quantity: 1 }],
      };

      // 1. Simulation indicates confirmation requirement
      const simRes = await app.inject({
        method: "POST",
        url: "/v1/simulate",
        payload: intent,
      });

      expect(simRes.statusCode).toBe(200);
      const simData = JSON.parse(simRes.body);
      expect(simData.verdict).toBe("WOULD_REQUIRE_CONFIRMATION");
      expect(simData.reason_code).toBe("CONFIRMATION_REQUIRED_ABOVE_THRESHOLD");
      expect(simData.non_mutating).toBe(true);

      // 2. Direct PDP evaluation generates pending confirmation record
      const pdpRes = services.pdp.evaluateIntent(intent, defaultPolicy, "native-llm-agent");
      expect(pdpRes.decision.decision).toBe("REQUIRE_CONFIRMATION");
      const token = pdpRes.decision.resource_decision.confirmation_token;
      expect(token).toBeDefined();

      // 3. Confirm with valid token and authorized scope
      const confirmRes = await app.inject({
        method: "POST",
        url: "/v1/confirm",
        headers: { authorization: "Bearer secret_merchant_admin" },
        payload: {
          confirmation_token: token,
          confirmed_by: "merchant_cfo_approver",
        },
      });

      expect(confirmRes.statusCode).toBe(201);
      const confirmData = JSON.parse(confirmRes.body);
      expect(confirmData.status).toBe("ORDER_CREATED");
      expect(confirmData.confirmed_by).toBe("merchant_cfo_approver");
      expect(confirmData.razorpay_order_id).toBeDefined();

      // 4. Double confirmation attempt fails with 409
      const doubleRes = await app.inject({
        method: "POST",
        url: "/v1/confirm",
        headers: { authorization: "Bearer secret_merchant_admin" },
        payload: { confirmation_token: token },
      });
      expect(doubleRes.statusCode).toBe(409);
    });
  });

  // ------------------------------------------------------------
  // V2.5: HIERARCHICAL FINANCIAL BUDGETS
  // ------------------------------------------------------------
  describe("V2.5: Hierarchical Financial Budgets", () => {
    it("5.1 Enforces blast-radius containment across Merchant -> Agent -> Mandate", async () => {
      const { budgetEngine } = registerGatewayRoutes(fastify(), db, defaultPolicy);

      // Set small merchant daily budget of ₹10,000 (1000000 paise)
      budgetEngine.initMerchantBudgetIfAbsent("merchant_small_01", 1000000);

      const mandate = createValidMandate(5000000); // ₹50,000 mandate (greater than merchant cap)

      // Request for ₹15,000 exceeds merchant daily limit
      const check1 = budgetEngine.evaluateHierarchy("merchant_small_01", "native-llm-agent", mandate, 1500000);
      expect(check1.allowed).toBe(false);
      expect(check1.code).toBe("MERCHANT_DAILY_BUDGET_EXCEEDED");

      // Request for ₹5,000 is allowed
      const check2 = budgetEngine.evaluateHierarchy("merchant_small_01", "native-llm-agent", mandate, 500000);
      expect(check2.allowed).toBe(true);
    });
  });

  // ------------------------------------------------------------
  // V2.6: VELOCITY CONTROLS
  // ------------------------------------------------------------
  describe("V2.6: Velocity Controls", () => {
    it("6.1 Rejects rapid actions exceeding per-minute transaction rate", async () => {
      const { velocityEngine } = registerGatewayRoutes(fastify(), db, defaultPolicy);
      const agentId = "agent_velocity_test";

      // Record 5 actions of ₹1,000 each
      for (let i = 0; i < 5; i++) {
        velocityEngine.recordAction("AGENT", agentId, 100000);
      }

      // Check with limit of max 5 actions / min
      const checkBlocked = velocityEngine.checkVelocity("AGENT", agentId, 100000, {
        perMinuteCount: 5,
      });

      expect(checkBlocked.allowed).toBe(false);
      expect(checkBlocked.code).toBe("VELOCITY_PER_MINUTE_COUNT_EXCEEDED");
    });
  });

  // ------------------------------------------------------------
  // V2.7: GLOBAL / MERCHANT / AGENT KILL SWITCH
  // ------------------------------------------------------------
  describe("V2.7: Operational Kill Switch Controls", () => {
    it("7.1 Global kill switch immediately halts all agent financial actions with reason code", async () => {
      // 1. Activate global kill switch
      const pauseRes = await app.inject({
        method: "POST",
        url: "/v1/kill-switch",
        headers: { authorization: "Bearer secret_merchant_admin" },
        payload: {
          scope: "GLOBAL",
          pause: true,
          reason: "Emergency containment active",
          activated_by: "secops_lead",
        },
      });
      expect(pauseRes.statusCode).toBe(200);

      // 2. Attempt checkout -> Must fail with 403 KILL_SWITCH_ENGAGED
      const mandate = createValidMandate();
      const checkoutRes = await app.inject({
        method: "POST",
        url: "/v1/agent/checkout",
        payload: {
          intent_id: crypto.randomUUID(),
          client_nonce: crypto.randomBytes(16).toString("hex"),
          timestamp: Math.floor(Date.now() / 1000),
          mandate,
          proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
        },
      });

      expect(checkoutRes.statusCode).toBe(403);
      const body = JSON.parse(checkoutRes.body);
      expect(body.error).toBe("KILL_SWITCH_ENGAGED");

      // 3. Deactivate kill switch -> Normal checkout resumes
      await app.inject({
        method: "POST",
        url: "/v1/kill-switch",
        headers: { authorization: "Bearer secret_merchant_admin" },
        payload: { scope: "GLOBAL", pause: false },
      });

      const resumeRes = await app.inject({
        method: "POST",
        url: "/v1/agent/checkout",
        payload: {
          intent_id: crypto.randomUUID(),
          client_nonce: crypto.randomBytes(16).toString("hex"),
          timestamp: Math.floor(Date.now() / 1000),
          mandate,
          proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
        },
      });
      expect(resumeRes.statusCode).toBe(201);
    });
  });

  // ------------------------------------------------------------
  // V2.8: POLICY SIMULATION (Zero Mutation)
  // ------------------------------------------------------------
  describe("V2.8: Policy Simulation Engine", () => {
    it("8.1 Simulates valid transaction without creating orders or mutating state", async () => {
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
        url: "/v1/simulate",
        payload: intent,
      });

      expect(res.statusCode).toBe(200);
      const sim = JSON.parse(res.body);
      expect(sim.verdict).toBe("WOULD_ALLOW");
      expect(sim.non_mutating).toBe(true);

      // Verify zero orders and zero reservations created in DB
      const orderCount = db.prepare("SELECT COUNT(*) as cnt FROM order_sessions").get() as any;
      const resCount = db.prepare("SELECT COUNT(*) as cnt FROM reservations").get() as any;
      expect(orderCount.cnt).toBe(0);
      expect(resCount.cnt).toBe(0);
    });
  });

  // ------------------------------------------------------------
  // V2.9: DECISION REPLAY
  // ------------------------------------------------------------
  describe("V2.9: Deterministic Decision Replay", () => {
    it("9.1 Demonstrates policy v1.0.0 ALLOW vs policy v2.0.0 DENY on historical decision", async () => {
      const { pdp } = registerGatewayRoutes(fastify(), db, defaultPolicy);
      const mandate = createValidMandate(500000);
      const intent: CanonicalIntent = {
        intent_id: crypto.randomUUID(),
        client_nonce: crypto.randomBytes(16).toString("hex"),
        timestamp: Math.floor(Date.now() / 1000),
        mandate,
        proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
      };

      // 1. Generate original decision under v1.0.0 (ALLOW)
      const orig = pdp.evaluateIntent(intent, defaultPolicy, "native-llm-agent");
      expect(orig.decision.decision).toBe("ALLOW");

      // 2. Replay against restricted policy v2.0.0 where max_transaction_amount is ₹1,000 (100000 paise)
      const restrictedPolicy: MerchantPolicy = {
        ...defaultPolicy,
        policy_version: "pol_v2.0.0",
        max_transaction_amount: 100000, // ₹1,000 (mouse is ₹2,124)
      };

      const replayRes = await app.inject({
        method: "POST",
        url: `/v1/decisions/${orig.decision.decision_id}/replay`,
        payload: { target_policy: restrictedPolicy },
      });

      expect(replayRes.statusCode).toBe(200);
      const replay = JSON.parse(replayRes.body);
      expect(replay.original_decision).toBe("ALLOW");
      expect(replay.replayed_decision).toBe("DENY");
      expect(replay.replayed_reason_code).toBe("MERCHANT_MAX_AMOUNT_EXCEEDED");
      expect(replay.delta).toBe("CHANGED");
      expect(replay.non_mutating).toBe(true);
    });
  });

  // ------------------------------------------------------------
  // V2.10: FINANCIAL STATE MACHINE
  // ------------------------------------------------------------
  describe("V2.10: Financial State Machine Invariants", () => {
    it("10.1 Rejects illegal state jumps (e.g. INTENT_CREATED -> CAPTURED)", () => {
      const illegal1 = FinancialStateMachine.validateTransition("INTENT_CREATED", "CAPTURED");
      expect(illegal1.valid).toBe(false);
      expect(illegal1.reason).toContain("Illegal financial state transition");

      const illegal2 = FinancialStateMachine.validateTransition("REJECTED", "CAPTURED");
      expect(illegal2.valid).toBe(false);

      const valid1 = FinancialStateMachine.validateTransition("INTENT_CREATED", "AUTHORITY_VERIFIED");
      expect(valid1.valid).toBe(true);

      const valid2 = FinancialStateMachine.validateTransition("AUTHORITY_VERIFIED", "POLICY_APPROVED");
      expect(valid2.valid).toBe(true);
    });
  });
});
