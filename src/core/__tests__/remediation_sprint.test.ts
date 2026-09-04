import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fastify, { type FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { initDatabase, type SqliteDatabase } from "../../store/db.js";
import { registerGatewayRoutes } from "../../gateway/router.js";
import { buildApp } from "../../server.js";
import { generatePrincipalKeypair, signMandate } from "../crypto.js";
import { getValidTokens } from "../../gateway/auth.js";
import type { MerchantPolicy, CanonicalIntent } from "../types.js";

describe("CRITICAL & HIGH SECURITY REMEDIATION REGRESSION SUITE", () => {
  let app: FastifyInstance;
  let db: SqliteDatabase;
  let services: any;
  let defaultPolicy: MerchantPolicy;
  let keypair: ReturnType<typeof generatePrincipalKeypair>;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    process.env.RAZORPAY_WEBHOOK_SECRET = "rzp_webhook_secret_test";
    process.env.ACG_ADMIN_TOKEN = "test_admin_token_secure";
    process.env.ACG_VIEWER_TOKEN = "test_viewer_token_secure";

    db = initDatabase(":memory:");
    defaultPolicy = {
      policy_version: "pol_v1.0.0",
      effective_at: Math.floor(Date.now() / 1000) - 3600,
      merchant_id: "merchant_luxury_india_01",
      max_transaction_amount: 5000000,
      allowed_categories: ["electronics", "furniture", "stationery"],
      auto_refund_on_fulfillment_failure: true,
      min_margin_percentage: 15,
    };

    const built = await buildApp(db, defaultPolicy);
    app = built.app;
    services = built.services;
    await app.ready();
    keypair = generatePrincipalKeypair();
  });

  afterEach(async () => {
    await app.close();
    process.env = { ...originalEnv };
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

  // =========================================================================
  // CRITICAL 1: /v1/reservations Authorization Bypass Remediation
  // =========================================================================
  it("test_reservations_endpoint_requires_authorization", async () => {
    const mandate = createValidMandate(500000);
    const reservationPayload = {
      intent_id: crypto.randomUUID(),
      mandate,
      items: [{ sku: "SKU-KEYBOARD-RGB", quantity: 1 }],
    };

    // 1. Anonymous request without Authorization header -> 401
    const anonRes = await app.inject({
      method: "POST",
      url: "/v1/reservations",
      payload: reservationPayload,
    });
    expect(anonRes.statusCode).toBe(401);
    expect(anonRes.json().error).toBe("UNAUTHORIZED");

    // 2. Request with invalid credentials -> 401
    const invalidRes = await app.inject({
      method: "POST",
      url: "/v1/reservations",
      headers: { authorization: "Bearer invalid_attacker_token" },
      payload: reservationPayload,
    });
    expect(invalidRes.statusCode).toBe(401);

    // 3. Request with insufficient scope (viewer token) -> 403
    const viewerRes = await app.inject({
      method: "POST",
      url: "/v1/reservations",
      headers: { authorization: `Bearer ${process.env.ACG_VIEWER_TOKEN}` },
      payload: reservationPayload,
    });
    expect(viewerRes.statusCode).toBe(403);
    expect(viewerRes.json().error).toBe("FORBIDDEN");

    // 4. Invariant: Assert no stock decrement occurred in database
    const stockRow = db.prepare("SELECT available_stock FROM catalog_items WHERE sku = 'SKU-KEYBOARD-RGB'").get() as any;
    expect(stockRow.available_stock).toBe(5); // Initial stock completely untouched
  });

  // =========================================================================
  // CRITICAL 2: Mandate Re-Registration Budget Reset Remediation
  // =========================================================================
  it("test_mandate_reregistration_preserves_remaining_budget", async () => {
    const mandate = createValidMandate(500000); // ₹5,000.00 authority

    // 1. Initial Registration via POST /v1/mandates
    const regRes = await app.inject({
      method: "POST",
      url: "/v1/mandates",
      payload: mandate,
    });
    expect(regRes.statusCode).toBe(201);
    expect(regRes.json().remaining_budget).toBe(500000);

    // 2. Spend ₹4,130 (413000 paise for SKU-KEYBOARD-RGB)
    const intent: CanonicalIntent = {
      intent_id: crypto.randomUUID(),
      client_nonce: crypto.randomBytes(16).toString("hex"),
      timestamp: Math.floor(Date.now() / 1000),
      mandate,
      proposed_items: [{ sku: "SKU-KEYBOARD-RGB", quantity: 1 }],
    };

    const checkoutRes = await app.inject({
      method: "POST",
      url: "/v1/agent/checkout",
      payload: intent,
    });
    expect(checkoutRes.statusCode).toBe(201);

    // Assert remaining budget is 87,000 paise (500000 - 413000)
    const midRow = db.prepare("SELECT remaining_budget FROM buyer_mandates WHERE mandate_id = ?").get(mandate.mandate_id) as any;
    expect(Number(midRow.remaining_budget)).toBe(87000);

    // 3. Attacker re-registers the original signed mandate payload to reset budget
    const reRegRes = await app.inject({
      method: "POST",
      url: "/v1/mandates",
      payload: mandate,
    });
    // Re-registration must preserve remaining budget or return 409
    expect(reRegRes.statusCode).toBe(200);
    expect(reRegRes.json().remaining_budget).toBe(87000);

    // Verify DB remaining_budget was NOT restored to 500,000
    const afterRow = db.prepare("SELECT remaining_budget FROM buyer_mandates WHERE mandate_id = ?").get(mandate.mandate_id) as any;
    expect(Number(afterRow.remaining_budget)).toBe(87000);

    // 4. Subsequent ₹4,130 purchase must be strictly DENIED (87000 < 413000)
    const secondIntent: CanonicalIntent = {
      intent_id: crypto.randomUUID(),
      client_nonce: crypto.randomBytes(16).toString("hex"),
      timestamp: Math.floor(Date.now() / 1000),
      mandate,
      proposed_items: [{ sku: "SKU-KEYBOARD-RGB", quantity: 1 }],
    };

    const secondRes = await app.inject({
      method: "POST",
      url: "/v1/agent/checkout",
      payload: secondIntent,
    });
    expect(secondRes.statusCode).toBe(409); // MANDATE_EXHAUSTED
    expect(secondRes.json().error).toBe("MANDATE_EXHAUSTED");
  });

  // =========================================================================
  // CRITICAL 3: Webhook mock_signature Test Backdoor Removal
  // =========================================================================
  it("test_mock_signature_is_rejected", async () => {
    const payload = {
      event: "payment.captured",
      payload: {
        order: { entity: { id: "order_mock_test_123" } },
        payment: { entity: { id: "pay_mock_456", order_id: "order_mock_test_123", amount: 413000, status: "captured" } },
      },
    };

    // Attempt webhook injection with header x-razorpay-signature: mock_signature
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/razorpay",
      headers: {
        "x-razorpay-signature": "mock_signature",
        "x-razorpay-event-id": "evt_mock_attack",
      },
      payload,
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("INVALID_WEBHOOK_SIGNATURE");
  });

  // =========================================================================
  // HIGH 4: Live Checkout Enforces Policy Decision Point (PDP)
  // =========================================================================
  it("test_live_checkout_enforces_pdp", async () => {
    const now = Math.floor(Date.now() / 1000);
    const mandate = createValidMandate(10000000);

    // 1. Create a suspended agent principal
    services.principalRegistry.upsertPrincipal({
      agent_id: "agent_suspended_test",
      organization_id: "org_test",
      provider: "anthropic",
      model_name: "claude-3-7-sonnet",
      agent_type: "AUTONOMOUS",
      trust_level: "PROVISIONAL",
      credential_state: "ACTIVE",
      created_at: now,
      expires_at: now + 3600,
      status: "SUSPENDED",
    });

    const suspendedIntent: CanonicalIntent = {
      intent_id: crypto.randomUUID(),
      client_nonce: crypto.randomBytes(16).toString("hex"),
      timestamp: now,
      mandate,
      proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
    };

    const suspendedRes = await app.inject({
      method: "POST",
      url: "/v1/agent/checkout",
      headers: { "x-agent-id": "agent_suspended_test" },
      payload: suspendedIntent,
    });

    expect(suspendedRes.statusCode).toBe(403);
    expect(suspendedRes.json().error).toBe("AGENT_SUSPENDED");

    // 2. Create agent with active capability but confirmation_above: ₹1,000 (100000 paise)
    services.principalRegistry.upsertPrincipal({
      agent_id: "agent_confirmation_test",
      organization_id: "org_test",
      provider: "anthropic",
      model_name: "claude-3-7-sonnet",
      agent_type: "AUTONOMOUS",
      trust_level: "VERIFIED",
      credential_state: "ACTIVE",
      created_at: now,
      expires_at: now + 3600,
      status: "ACTIVE",
    });

    services.principalRegistry.upsertCapability({
      capability_id: "cap_conf_test",
      agent_id: "agent_confirmation_test",
      capability: "PURCHASE",
      max_amount: 10000000,
      currency: "INR",
      categories: ["*"],
      merchant_scope: ["*"],
      daily_budget: 50000000,
      daily_spent: 0,
      confirmation_above: 100000, // ₹1,000 ceiling
      expires_at: now + 3600,
      status: "ACTIVE",
      created_at: now,
    });

    // SKU-MOUSE-PRO is ₹2,124 -> Exceeds ₹1,000 ceiling -> Must REQUIRE_CONFIRMATION
    const confIntent: CanonicalIntent = {
      intent_id: crypto.randomUUID(),
      client_nonce: crypto.randomBytes(16).toString("hex"),
      timestamp: now,
      mandate,
      proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
    };

    const confRes = await app.inject({
      method: "POST",
      url: "/v1/agent/checkout",
      headers: { "x-agent-id": "agent_confirmation_test" },
      payload: confIntent,
    });

    expect(confRes.statusCode).toBe(200);
    const confBody = confRes.json();
    expect(confBody.status).toBe("REQUIRE_CONFIRMATION");
    expect(confBody.confirmation_token).toBeDefined();
  });

  // =========================================================================
  // HIGH 5: Human Confirmation Endpoint Authentication & Revocation Check
  // =========================================================================
  it("test_confirmation_requires_authorization", async () => {
    const now = Math.floor(Date.now() / 1000);
    const mandate = createValidMandate(5000000);

    // Setup agent requiring confirmation
    services.principalRegistry.upsertPrincipal({
      agent_id: "agent_supervisor_test",
      organization_id: "org_test",
      provider: "anthropic",
      model_name: "claude-3-7-sonnet",
      agent_type: "AUTONOMOUS",
      trust_level: "VERIFIED",
      credential_state: "ACTIVE",
      created_at: now,
      expires_at: now + 3600,
      status: "ACTIVE",
    });
    services.principalRegistry.upsertCapability({
      capability_id: "cap_supervisor_test",
      agent_id: "agent_supervisor_test",
      capability: "PURCHASE",
      max_amount: 10000000,
      currency: "INR",
      categories: ["*"],
      merchant_scope: ["*"],
      daily_budget: 50000000,
      daily_spent: 0,
      confirmation_above: 100000,
      expires_at: now + 3600,
      status: "ACTIVE",
      created_at: now,
    });

    const confIntent: CanonicalIntent = {
      intent_id: crypto.randomUUID(),
      client_nonce: crypto.randomBytes(16).toString("hex"),
      timestamp: now,
      mandate,
      proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
    };

    const trigRes = await app.inject({
      method: "POST",
      url: "/v1/agent/checkout",
      headers: { "x-agent-id": "agent_supervisor_test" },
      payload: confIntent,
    });
    const token = trigRes.json().confirmation_token;
    expect(token).toBeDefined();

    // 1. Anonymous confirmation -> 401
    const anonRes = await app.inject({
      method: "POST",
      url: "/v1/confirm",
      payload: { confirmation_token: token },
    });
    expect(anonRes.statusCode).toBe(401);

    // 2. Revoke the mandate before confirmation is executed
    await app.inject({
      method: "POST",
      url: "/v1/mandates/revoke",
      headers: { authorization: `Bearer ${process.env.ACG_ADMIN_TOKEN}` },
      payload: { mandate_id: mandate.mandate_id, reason: "Compromised credential" },
    });

    // 3. Attempt confirmation with valid admin credentials after revocation -> 403 MANDATE_REVOKED
    const revokeConfirmRes = await app.inject({
      method: "POST",
      url: "/v1/confirm",
      headers: { authorization: `Bearer ${process.env.ACG_ADMIN_TOKEN}` },
      payload: { confirmation_token: token },
    });
    expect(revokeConfirmRes.statusCode).toBe(403);
    expect(revokeConfirmRes.json().error).toBe("MANDATE_REVOKED");
  });

  // =========================================================================
  // HIGH 6: Webhook State Machine Invariant: Delayed Capture Rejected on Failed Session
  // =========================================================================
  it("test_delayed_capture_is_rejected", async () => {
    const mandate = createValidMandate(500000);
    const intent: CanonicalIntent = {
      intent_id: crypto.randomUUID(),
      client_nonce: crypto.randomBytes(16).toString("hex"),
      timestamp: Math.floor(Date.now() / 1000),
      mandate,
      proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
    };

    // 1. Place order
    const checkoutRes = await app.inject({
      method: "POST",
      url: "/v1/agent/checkout",
      payload: intent,
    });
    expect(checkoutRes.statusCode).toBe(201);
    const orderData = checkoutRes.json();
    const orderId = orderData.razorpay_order_id;
    const reservationId = orderData.reservation_id;

    // 2. Deliver payment.failed webhook
    const failPayload = {
      event: "payment.failed",
      payload: {
        payment: { entity: { id: "pay_fail_123", order_id: orderId, amount: 212400, status: "failed" } },
      },
    };
    const webhookSecret = (services.webhookProcessor as any).webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET || "rzp_webhook_secret_12345";
    const failSig = crypto.createHmac("sha256", webhookSecret).update(JSON.stringify(failPayload)).digest("hex");

    const failRes = await app.inject({
      method: "POST",
      url: "/webhooks/razorpay",
      headers: { "x-razorpay-signature": failSig, "x-razorpay-event-id": "evt_fail_1" },
      payload: failPayload,
    });
    expect(failRes.statusCode).toBe(200);

    // Verify session is in PAYMENT_FAILED and reservation is RELEASED
    const sessionRow = db.prepare("SELECT status FROM order_sessions WHERE intent_id = ?").get(intent.intent_id) as any;
    expect(sessionRow.status).toBe("PAYMENT_FAILED");
    const resRow = db.prepare("SELECT status FROM reservations WHERE reservation_id = ?").get(reservationId) as any;
    expect(resRow.status).toBe("RELEASED");

    // 3. Delayed payment.captured webhook arrives afterwards
    const lateCapturePayload = {
      event: "payment.captured",
      payload: {
        payment: { entity: { id: "pay_late_cap_456", order_id: orderId, amount: 212400, status: "captured" } },
      },
    };
    const lateCapSig = crypto.createHmac("sha256", webhookSecret).update(JSON.stringify(lateCapturePayload)).digest("hex");

    const lateCapRes = await app.inject({
      method: "POST",
      url: "/webhooks/razorpay",
      headers: { "x-razorpay-signature": lateCapSig, "x-razorpay-event-id": "evt_late_cap_2" },
      payload: lateCapturePayload,
    });

    // Must be rejected as an illegal transition; session remains PAYMENT_FAILED
    expect(lateCapRes.statusCode).toBe(409);
    const finalSession = db.prepare("SELECT status FROM order_sessions WHERE intent_id = ?").get(intent.intent_id) as any;
    expect(finalSession.status).toBe("PAYMENT_FAILED"); // NOT modified to PAYMENT_CAPTURED
  });

  // =========================================================================
  // HIGH 7: Webhook Raw Wire Byte HMAC Verification
  // =========================================================================
  it("test_webhook_uses_raw_body_hmac", async () => {
    const webhookSecret = (services.webhookProcessor as any).webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET || "rzp_webhook_secret_12345";

    // Non-standard formatted JSON with extra spaces and newlines
    const rawWireJson = '{\n  "event":   "payment.captured",\n  "payload": {\n    "payment": {\n      "entity": {\n        "id": "pay_wire_test_789",\n        "order_id": "order_non_existent",\n        "amount": 212400,\n        "status": "captured"\n      }\n    }\n  }\n}';

    // Signature computed over exact raw wire bytes
    const wireSig = crypto.createHmac("sha256", webhookSecret).update(rawWireJson).digest("hex");

    // Send the raw wire string directly
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/razorpay",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": wireSig,
        "x-razorpay-event-id": "evt_raw_wire_01",
      },
      payload: rawWireJson,
    });

    // Signature verification must succeed (returns 200 with ORDER_NOT_FOUND rather than 401 INVALID_SIGNATURE)
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ORDER_NOT_FOUND");

    // Altering whitespace by 1 space invalidates raw wire HMAC
    const tamperedWireJson = rawWireJson.replace('"event":   ', '"event":    ');
    const tamperedRes = await app.inject({
      method: "POST",
      url: "/webhooks/razorpay",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": wireSig,
        "x-razorpay-event-id": "evt_tampered_wire_02",
      },
      payload: tamperedWireJson,
    });

    expect(tamperedRes.statusCode).toBe(401);
    expect(tamperedRes.json().error).toBe("INVALID_WEBHOOK_SIGNATURE");
  });

  // =========================================================================
  // HIGH 8: Admin Credentials Strictly Disallowed as Static Defaults in Production
  // =========================================================================
  it("test_admin_credentials_not_hardcoded", () => {
    // 1. In Production mode without env variables set, getValidTokens() returns ZERO static credentials
    process.env.NODE_ENV = "production";
    delete process.env.ACG_ADMIN_TOKEN;
    delete process.env.ACG_VIEWER_TOKEN;
    delete process.env.ACG_AUDIT_TOKEN;

    const prodTokens = getValidTokens();
    expect(prodTokens["secret_merchant_admin"]).toBeUndefined();
    expect(prodTokens["secret_merchant_viewer"]).toBeUndefined();
    expect(prodTokens["secret_audit_bot"]).toBeUndefined();
    expect(Object.keys(prodTokens).length).toBe(0);

    // 2. In Production mode WITH explicit env token, only explicit token is recognized
    process.env.ACG_ADMIN_TOKEN = "prod_kms_secret_vault_999";
    const prodConfigured = getValidTokens();
    expect(prodConfigured["prod_kms_secret_vault_999"]).toBeDefined();
    expect(prodConfigured["secret_merchant_admin"]).toBeUndefined();
  });
});
