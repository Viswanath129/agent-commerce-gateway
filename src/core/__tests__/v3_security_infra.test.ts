import { describe, it, expect, beforeEach } from "vitest";
import fastify, { type FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { initDatabase, type SqliteDatabase } from "../../store/db.js";
import { registerGatewayRoutes } from "../../gateway/router.js";
import { generatePrincipalKeypair, signMandate } from "../crypto.js";
import { LocalHeuristicRiskProvider } from "../risk.js";
import { DecisionTraceRecorder } from "../trace.js";
import type { MerchantPolicy } from "../types.js";

describe("V3 — AGENT SECURITY INFRASTRUCTURE TEST SUITE", () => {
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
  // V3.1: RISK PROVIDER ABSTRACTION
  // ------------------------------------------------------------
  describe("V3.1: Risk Provider Abstraction & Advisory Invariant", () => {
    it("1.1 LocalHeuristicRiskProvider evaluates risk score and anomalies deterministically", async () => {
      const riskProvider = new LocalHeuristicRiskProvider();

      // Normal transaction
      const evalNormal = await riskProvider.evaluate({
        intentId: "intent_normal_01",
        merchantId: "merchant_01",
        agentId: "agent_01",
        amountPaise: 200000, // ₹2,000
        currency: "INR",
        categories: ["electronics"],
        mandateId: "man_01",
      });

      expect(evalNormal.riskTier).toBe("LOW");
      expect(evalNormal.recommendedAction).toBe("ALLOW");
      expect(evalNormal.advisoryOnly).toBe(true);
      expect(evalNormal.latencyMs).toBeGreaterThanOrEqual(0);

      // High-risk transaction (high amount + high risk category)
      const evalHighRisk = await riskProvider.evaluate({
        intentId: "intent_high_02",
        merchantId: "merchant_01",
        agentId: "agent_01",
        amountPaise: 6000000, // ₹60,000
        currency: "INR",
        categories: ["gift_cards"],
        mandateId: "man_01",
      });

      expect(evalHighRisk.riskScore).toBeGreaterThanOrEqual(75);
      expect(evalHighRisk.riskTier).toBe("CRITICAL");
      expect(evalHighRisk.recommendedAction).toBe("DENY");
      expect(evalHighRisk.signals).toContain("HIGH_RISK_CATEGORY_GIFT_CARDS");
    });

    it("1.2 Risk evaluation endpoint returns advisory intelligence without overriding authorization policy", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/v1/risk/evaluate",
        payload: {
          intent_id: "intent_test_advisory",
          amount_paise: 3000000,
          categories: ["crypto_assets"],
        },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.advisoryOnly).toBe(true);
      expect(data.signals).toContain("HIGH_RISK_CATEGORY_CRYPTO_ASSETS");
    });
  });

  // ------------------------------------------------------------
  // V3.2 & V3.5: DECISION TRACES & OBSERVABILITY
  // ------------------------------------------------------------
  describe("V3.2 & V3.5: Decision Traces & Structured Observability", () => {
    it("2.1 Records and retrieves structured execution traces with redacted secrets and phase latencies", async () => {
      const recorder = new DecisionTraceRecorder(db, "intent_trace_01", "native-llm-agent", "merchant_luxury_india_01");
      recorder.recordPhase("IDENTITY_CHECK", "PASS", 0.45, { agent_id: "native-llm-agent", secret_key: "super_secret_123" });
      recorder.recordPhase("MANDATE_VERIFY", "PASS", 1.2, { mandate_id: "man_123" });
      recorder.recordPhase("TRUTH_LOOKUP", "PASS", 0.35, { total_paise: 212400 });
      recorder.recordPhase("POLICY_DECISION", "PASS", 0.5);
      const finalized = recorder.finalize();

      expect(finalized.traceId).toBeDefined();
      expect(finalized.phases.length).toBe(4);
      // Secrets must be redacted
      expect(finalized.phases[0].details?.secret_key).toBe("[REDACTED]");

      // Retrieve via GET /v1/traces/:traceId
      const traceRes = await app.inject({
        method: "GET",
        url: `/v1/traces/${finalized.traceId}`,
      });

      expect(traceRes.statusCode).toBe(200);
      const retrieved = JSON.parse(traceRes.body);
      expect(retrieved.traceId).toBe(finalized.traceId);
      expect(retrieved.totalLatencyMs).toBeGreaterThanOrEqual(0);
      expect(retrieved.phases[0].details?.secret_key).toBe("[REDACTED]");
    });
  });

  // ------------------------------------------------------------
  // V3.3 & V3.4: INCIDENT CONSOLE & INCIDENT RESPONSE
  // ------------------------------------------------------------
  describe("V3.3 & V3.4: Incident Console & Incident Response Workflows", () => {
    it("3.1 Logs security incidents and executes operational response actions (SUSPEND_AGENT, REVOKE_MANDATE)", async () => {
      const { incidentEngine } = registerGatewayRoutes(fastify(), db, defaultPolicy);

      // Record a policy violation incident
      const inc = incidentEngine.recordIncident(
        "agent_suspicious_01",
        "merchant_luxury_india_01",
        "POLICY_VIOLATION",
        "HIGH",
        { violation: "Over-budget attempt ₹90,000" },
        "intent_viol_1"
      );

      expect(inc.incidentId).toBeDefined();
      expect(inc.status).toBe("OPEN");

      // Verify incident in list
      const listRes = await app.inject({
        method: "GET",
        url: "/v1/incidents",
        headers: { authorization: "Bearer secret_merchant_admin" },
      });
      expect(listRes.statusCode).toBe(200);
      const incidents = JSON.parse(listRes.body).incidents;
      expect(incidents.length).toBeGreaterThanOrEqual(1);

      // Execute incident action: SUSPEND_AGENT
      const actionRes = await app.inject({
        method: "POST",
        url: "/v1/incidents/action",
        headers: { authorization: "Bearer secret_merchant_admin" },
        payload: {
          action: "SUSPEND_AGENT",
          target_id: "agent_suspicious_01",
          reason: "Repeated security violations observed",
          actor: "ciso_reviewer",
        },
      });

      expect(actionRes.statusCode).toBe(200);
      const actionData = JSON.parse(actionRes.body);
      expect(actionData.status).toBe("AGENT_SUSPENDED");

      // Clear incident after review
      const clearRes = await app.inject({
        method: "POST",
        url: "/v1/incidents/action",
        headers: { authorization: "Bearer secret_merchant_admin" },
        payload: {
          action: "CLEAR_AFTER_REVIEW",
          target_id: inc.incidentId,
          reason: "Reviewed and remediated",
          actor: "ciso_reviewer",
        },
      });

      expect(clearRes.statusCode).toBe(200);
      expect(JSON.parse(clearRes.body).status).toBe("INCIDENT_RESOLVED");
    });
  });

  // ------------------------------------------------------------
  // V3.6: PROPERTY-BASED SECURITY INVARIANTS
  // ------------------------------------------------------------
  describe("V3.6: Property-Based Security Invariant Testing", () => {
    it("4.1 Invariant: Inventory stock is strictly non-negative (>= 0) under randomized sequential actions", async () => {
      // Seed specific stock: SKU-MOUSE-PRO has 12 units
      const initialStockRow = db.prepare("SELECT available_stock FROM catalog_items WHERE sku = 'SKU-MOUSE-PRO'").get() as any;
      const initialStock = Number(initialStockRow.available_stock);

      // Perform 20 randomized checkout attempts with quantities 1-3
      let successfulCheckouts = 0;
      let totalUnitsPurchased = 0;

      for (let i = 0; i < 20; i++) {
        const qty = (i % 3) + 1;
        const mandate = createValidMandate(10000000); // ₹1,00,000 budget
        const res = await app.inject({
          method: "POST",
          url: "/v1/agent/checkout",
          payload: {
            intent_id: crypto.randomUUID(),
            client_nonce: crypto.randomBytes(16).toString("hex"),
            timestamp: Math.floor(Date.now() / 1000),
            mandate,
            proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: qty }],
          },
        });

        if (res.statusCode === 201) {
          successfulCheckouts++;
          totalUnitsPurchased += qty;
        }

        // Invariant Check after EVERY action: available_stock >= 0
        const currentStockRow = db.prepare("SELECT available_stock FROM catalog_items WHERE sku = 'SKU-MOUSE-PRO'").get() as any;
        const currentStock = Number(currentStockRow.available_stock);
        expect(currentStock).toBeGreaterThanOrEqual(0);
      }

      // Total purchased units must never exceed initial inventory
      expect(totalUnitsPurchased).toBeLessThanOrEqual(initialStock);
    });

    it("4.2 Invariant: Revoked mandate strictly yields zero (0) new financial executions", async () => {
      const mandate = createValidMandate(5000000);

      // Revoke the mandate
      await app.inject({
        method: "POST",
        url: "/v1/mandates/revoke",
        headers: { authorization: "Bearer secret_merchant_admin" },
        payload: { mandate_id: mandate.mandate_id, reason: "Security test revocation" },
      });

      // Execute 10 checkout attempts against the revoked mandate
      for (let i = 0; i < 10; i++) {
        const res = await app.inject({
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

        expect(res.statusCode).toBe(403);
      }

      // Invariant: Zero order sessions created for revoked mandate
      const orderCount = db.prepare("SELECT COUNT(*) as cnt FROM order_sessions WHERE receipt LIKE ?").get(`%${mandate.mandate_id}%`) as any;
      expect(Number(orderCount.cnt)).toBe(0);
    });
  });

  // ------------------------------------------------------------
  // V3.7: CHAOS / FAIL-CLOSED SAFETY
  // ------------------------------------------------------------
  describe("V3.7: Chaos & Fail-Closed Safety", () => {
    it("5.1 Fails closed on corrupted mandate or invalid input without financial execution", async () => {
      const corruptPayload = {
        intent_id: "not_a_uuid",
        client_nonce: "short",
        timestamp: -1,
      };

      const res = await app.inject({
        method: "POST",
        url: "/v1/agent/checkout",
        payload: corruptPayload,
      });

      // Must fail closed with 400
      expect(res.statusCode).toBe(400);

      // Zero orders created
      const orderCount = db.prepare("SELECT COUNT(*) as cnt FROM order_sessions").get() as any;
      expect(Number(orderCount.cnt)).toBe(0);
    });
  });
});
