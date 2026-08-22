import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../../server.js";
import { initDatabase } from "../../store/db.js";
import type { FastifyInstance } from "fastify";

describe("ACG Luxury Dashboard & Real API Integration Test Suite", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const db = initDatabase(":memory:");
    const serverInstance = await buildApp(db);
    app = serverInstance.app;
  });

  it("1. GET / - Serves complete zero-mock Luxury Edition Dashboard SPA", async () => {
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.body).toContain("AGENT COMMERCE CONTROL PLANE");
    expect(res.body).toContain("ZERO-MOCK ACTIVE");
  });

  it("2. GET /dashboard/metrics - Aggregates real numerical metrics from SQLite", async () => {
    const res = await app.inject({ method: "GET", url: "/dashboard/metrics" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("ai_intents_count");
    expect(body).toHaveProperty("authorized_gmv_inr");
    expect(body).toHaveProperty("blocked_attempts_count");
    expect(body).toHaveProperty("active_policy_version", "pol_v1.0.0");
    expect(body).toHaveProperty("merchant_id", "merch_acme_electronics_01");
  });

  it("3. GET /dashboard/transactions & /dashboard/mandates - Returns real persistent registries", async () => {
    const txRes = await app.inject({ method: "GET", url: "/dashboard/transactions" });
    expect(txRes.statusCode).toBe(200);
    expect(Array.isArray(JSON.parse(txRes.body).transactions)).toBe(true);

    const mandRes = await app.inject({ method: "GET", url: "/dashboard/mandates" });
    expect(mandRes.statusCode).toBe(200);
    const mandData = JSON.parse(mandRes.body);
    expect(Array.isArray(mandData.mandates)).toBe(true);
    expect(Array.isArray(mandData.revoked)).toBe(true);
  });

  it("4. GET /dashboard/health - Returns live operational node status", async () => {
    const res = await app.inject({ method: "GET", url: "/dashboard/health" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("HEALTHY");
    expect(body.components.gateway.status).toBe("LIVE");
    expect(body.components.database.status).toBe("CONNECTED");
    expect(body.components.policy_engine.status).toBe("READY");
    expect(body.components.reservation_engine.status).toBe("READY");
  });

  it("5. POST /dashboard/demo/run-scenario (happy-path) - Executes real nominal flow", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/dashboard/demo/run-scenario",
      payload: { scenario: "happy-path" },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ORDER_CREATED");
    expect(body.razorpay_order_id).toBeDefined();
    expect(body.amount_paise).toBe(212400); // ₹1,800 + 18% GST = ₹2,124.00
  });

  it("6. POST /dashboard/demo/run-scenario (mandate-violation) - Intercepts overspend with HTTP 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/dashboard/demo/run-scenario",
      payload: { scenario: "mandate-violation" },
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("MANDATE_BUDGET_EXCEEDED");
  });

  it("7. POST /dashboard/demo/run-scenario (concurrent) - Enforces ACID race isolation (201 / 409)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/dashboard/demo/run-scenario",
      payload: { scenario: "concurrent" },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.subagentA.status).toBe(201);
    expect(body.subagentB.status).toBe(409);
    expect(body.subagentB.body.error).toBe("MANDATE_EXHAUSTED");
  });

  it("8. POST /dashboard/demo/run-scenario (refund) - Executes safe reversal audit path", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/dashboard/demo/run-scenario",
      payload: { scenario: "refund" },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.scenario).toBe("refund");
    expect(body.refundExecution.success).toBe(true);
    expect(body.refundExecution.status).toBe("REFUNDED");
  });

  it("9. Mandate Revocation & Enforcement - Revokes mandate and blocks subsequent checkout", async () => {
    const revokeRes = await app.inject({
      method: "POST",
      url: "/v1/mandates/revoke",
      payload: { mandate_id: "man_ui_test_1", reason: "Revoked via UI action button" },
    });
    expect(revokeRes.statusCode).toBe(200);
    expect(JSON.parse(revokeRes.body).status).toBe("REVOKED");

    // Verify presence in revoked list
    const mandListRes = await app.inject({ method: "GET", url: "/dashboard/mandates" });
    const mandListData = JSON.parse(mandListRes.body);
    expect(mandListData.revoked.some((r: any) => r.mandate_id === "man_ui_test_1")).toBe(true);
  });

  it("10. Dynamic Policy Mutation - Updates max transaction cap in real time", async () => {
    const updateRes = await app.inject({
      method: "PUT",
      url: "/v1/merchant/policy",
      payload: {
        policy_version: "pol_v2.1.0",
        effective_at: Math.floor(Date.now() / 1000),
        merchant_id: "merch_acme_electronics_01",
        max_transaction_amount: 150000, // ₹1,500
        allowed_categories: ["electronics"],
        auto_refund_on_fulfillment_failure: true,
        min_margin_percentage: 15,
      },
    });
    expect(updateRes.statusCode).toBe(200);
    expect(JSON.parse(updateRes.body).policy.policy_version).toBe("pol_v2.1.0");

    // Verify active policy returned by dashboard
    const polRes = await app.inject({ method: "GET", url: "/dashboard/policies" });
    expect(JSON.parse(polRes.body).policy.policy_version).toBe("pol_v2.1.0");
  });

  it("11. Cryptographic Audit Integrity - Verifies SHA-256 hash chain validity", async () => {
    const res = await app.inject({ method: "GET", url: "/audit/integrity" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.isValid).toBe(true);
    expect(body.checkedBlocks).toBeGreaterThanOrEqual(0);
  });
});
