import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../../server.js";
import { initDatabase } from "../../store/db.js";

describe("Frontend Auth Integration", () => {
  let app: any;
  let testDb: any;

  beforeEach(async () => {
    testDb = initDatabase(":memory:");
    const built = await buildApp(testDb);
    app = built.app;
    await app.ready();
  });

  it("1. protected dashboard without token -> 401", async () => {
    const res = await app.inject({ method: "GET", url: "/dashboard/metrics" });
    expect(res.statusCode).toBe(401);
  });

  it("2. dashboard with valid merchant token -> 200", async () => {
    const res = await app.inject({ method: "GET", url: "/dashboard/metrics", headers: { Authorization: "Bearer secret_merchant_admin" } });
    expect(res.statusCode).toBe(200);
  });

  it("3. policy mutation without token -> 401", async () => {
    const res = await app.inject({ method: "PUT", url: "/v1/merchant/policy", payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it("4. policy mutation with wrong scope -> 403", async () => {
    const res = await app.inject({ method: "PUT", url: "/v1/merchant/policy", payload: {}, headers: { Authorization: "Bearer secret_merchant_viewer" } });
    expect(res.statusCode).toBe(403);
  });

  it("5. mandate revoke without token -> 401", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/mandates/revoke", payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it("6. mandate revoke with correct scope -> success and blocks checkout", async () => {
    // Seed a dummy mandate
    const intentId = `test_intent_${Date.now()}`;
    const mandateId = `test_mandate_${Date.now()}`;
    testDb.prepare(`
      INSERT INTO buyer_mandates (mandate_id, principal_public_key, budget_limit, remaining_budget, currency, expiry, signature, created_at)
      VALUES (?, 'test_principal', 500000, 500000, 'INR', 9999999999, 'sig', 123)
    `).run(mandateId);

    // 2. Revoke it via authenticated API
    const revokeRes = await app.inject({ 
      method: "POST", 
      url: "/v1/mandates/revoke", 
      payload: { mandate_id: mandateId, reason: "integration test" }, 
      headers: { Authorization: "Bearer secret_merchant_admin" } 
    });
    
    expect(revokeRes.statusCode).toBe(200);
    const revokeData = JSON.parse(revokeRes.body);
    expect(revokeData.status).toBe("REVOKED");

    // 3. Attempt a checkout using the revoked mandate
    const checkoutPayload = {
      intent_id: "00000000-0000-0000-0000-000000000001",
      client_nonce: "nonce_1234567890_12345",
      timestamp: Date.now(),
      mandate: {
        mandate_id: mandateId,
        principal_public_key: "6314b14f24d43ee8e83b0909e3a6c9d8ab34f6e1f0e21379c67b0933d31ab1a1",
        budget_limit: 500000,
        currency: "INR",
        expiry: Date.now() + 1000000,
        signature: "13511eb9ab51a8dce1f6e246dbf82d1b7d52a78121f64929497e5968b556b27e69d95f87b8d0032cc629ed34958f2edb23b3c3c7809a7ef2049e0a2da5a36d0b"
      },
      proposed_items: [
        { sku: "SKU-MOUSE-PRO", quantity: 1 }
      ]
    };
    
    const checkoutRes = await app.inject({
      method: "POST",
      url: "/v1/agent/checkout",
      payload: checkoutPayload
    });

    // 4. Verify checkout is blocked at the financial control plane
    expect(checkoutRes.statusCode).toBe(403);
    const checkoutData = JSON.parse(checkoutRes.body);
    expect(checkoutData.error).toBe("MANDATE_REVOKED");
  });

  it("7. audit verification with allowed scope -> success", async () => {
    const res = await app.inject({ method: "GET", url: "/dashboard/audit", headers: { Authorization: "Bearer secret_merchant_admin" } });
    expect(res.statusCode).toBe(200);
  });
});
