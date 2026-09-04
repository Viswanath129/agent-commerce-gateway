import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { buildApp } from "../../server.js";
import { initDatabase } from "../../store/db.js";
import { generatePrincipalKeypair, signMandate } from "../crypto.js";
import type { BuyerMandate, CanonicalIntent } from "../types.js";
import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance } from "fastify";

describe("SECURITY_WARFARE_SUITE: Complete Hostile-Evaluator Verification", () => {
  let app: FastifyInstance;
  let db: DatabaseSync;
  let services: any;

  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    db = initDatabase(":memory:");
    const built = await buildApp(db);
    app = built.app;
    services = built.services;
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  // =========================================================================
  // 1. CONCURRENCY & DOUBLE-SPEND WARFARE
  // =========================================================================
  describe("1. Concurrency Warfare & Invariant Proofs", () => {
    it("Scenario A: N agents, 1 inventory unit -> Exactly 1 succeeds, remaining fail with 409", async () => {
      // Set SKU-KEYBOARD-RGB available_stock = 1
      db.prepare("UPDATE catalog_items SET available_stock = 1 WHERE sku = 'SKU-KEYBOARD-RGB'").run();

      const principal = generatePrincipalKeypair();
      const now = Math.floor(Date.now() / 1000);
      const mandateData = {
        mandate_id: `man_concur_1_${crypto.randomBytes(4).toString("hex")}`,
        principal_public_key: principal.publicKeyHex,
        budget_limit: 5000000, // Sufficient budget
        currency: "INR" as const,
        expiry: now + 3600,
      };
      const signature = signMandate(mandateData, principal.privateKeyObject);

      const agentCount = 5;
      const promises = Array.from({ length: agentCount }, () => {
        const intent: CanonicalIntent = {
          intent_id: crypto.randomUUID(),
          client_nonce: crypto.randomBytes(16).toString("hex"),
          timestamp: now,
          mandate: { ...mandateData, signature },
          proposed_items: [{ sku: "SKU-KEYBOARD-RGB", quantity: 1 }],
        };
        return app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intent });
      });

      const responses = await Promise.all(promises);
      const successes = responses.filter((r) => r.statusCode === 201);
      const blocked = responses.filter((r) => r.statusCode === 400 || r.statusCode === 409);

      expect(successes.length).toBe(1);
      expect(blocked.length).toBe(agentCount - 1);

      // Verify stock invariant: available_stock = 0 (never negative)
      const stockRow = db.prepare("SELECT available_stock FROM catalog_items WHERE sku = 'SKU-KEYBOARD-RGB'").get() as any;
      expect(Number(stockRow.available_stock)).toBe(0);
    });

    it("Scenario B: N agents, residual budget smaller than aggregate demand -> Budget strictly guarded", async () => {
      const principal = generatePrincipalKeypair();
      const now = Math.floor(Date.now() / 1000);
      // Mouse is ₹2,124.00 (212400 paise). Budget limit is ₹3,000.00 (300000 paise).
      // 2 concurrent agents requesting ₹2,124.00 each -> Total ₹4,248.00 > ₹3,000.00
      const mandateData = {
        mandate_id: `man_concur_b_${crypto.randomBytes(4).toString("hex")}`,
        principal_public_key: principal.publicKeyHex,
        budget_limit: 300000, // ₹3,000.00
        currency: "INR" as const,
        expiry: now + 3600,
      };
      const signature = signMandate(mandateData, principal.privateKeyObject);

      const intent1: CanonicalIntent = {
        intent_id: crypto.randomUUID(),
        client_nonce: crypto.randomBytes(16).toString("hex"),
        timestamp: now,
        mandate: { ...mandateData, signature },
        proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
      };

      const intent2: CanonicalIntent = {
        intent_id: crypto.randomUUID(),
        client_nonce: crypto.randomBytes(16).toString("hex"),
        timestamp: now,
        mandate: { ...mandateData, signature },
        proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
      };

      const [res1, res2] = await Promise.all([
        app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intent1 }),
        app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intent2 }),
      ]);

      const statusList = [res1.statusCode, res2.statusCode];
      expect(statusList).toContain(201);
      expect(statusList).toContain(409);

      // Remaining budget must be 300000 - 212400 = 87600 paise (never negative)
      const mandateRow = db.prepare("SELECT remaining_budget FROM buyer_mandates WHERE mandate_id = ?").get(mandateData.mandate_id) as any;
      expect(Number(mandateRow.remaining_budget)).toBe(87600);
    });

    it("Scenario C: Same intent_id submitted multiple times -> Exactly 1 created, second rejected with 409", async () => {
      const principal = generatePrincipalKeypair();
      const now = Math.floor(Date.now() / 1000);
      const mandateData = {
        mandate_id: `man_concur_c_${crypto.randomBytes(4).toString("hex")}`,
        principal_public_key: principal.publicKeyHex,
        budget_limit: 500000,
        currency: "INR" as const,
        expiry: now + 3600,
      };
      const signature = signMandate(mandateData, principal.privateKeyObject);

      const fixedIntentId = crypto.randomUUID();
      const intent: CanonicalIntent = {
        intent_id: fixedIntentId,
        client_nonce: crypto.randomBytes(16).toString("hex"),
        timestamp: now,
        mandate: { ...mandateData, signature },
        proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
      };

      const res1 = await app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intent });
      expect(res1.statusCode).toBe(201);

      const res2 = await app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intent });
      expect(res2.statusCode).toBe(409);
      expect(res2.json().error).toBe("DUPLICATE_INTENT_REPLAY");

      // Verify at most one financial effect recorded
      const sessions = db.prepare("SELECT COUNT(*) as count FROM order_sessions WHERE intent_id = ?").get(fixedIntentId) as any;
      expect(Number(sessions.count)).toBe(1);
    });
  });

  // =========================================================================
  // 2. CRYPTOGRAPHIC INTEGRITY & MUTATION TESTS
  // =========================================================================
  describe("2. Cryptographic Assurance & Negative Mutation Tests", () => {
    it("Bit flip in signature -> Rejected with 401 INVALID_MANDATE_SIGNATURE", async () => {
      const principal = generatePrincipalKeypair();
      const now = Math.floor(Date.now() / 1000);
      const mandateData = {
        mandate_id: "man_crypto_bitflip",
        principal_public_key: principal.publicKeyHex,
        budget_limit: 500000,
        currency: "INR" as const,
        expiry: now + 3600,
      };
      const validSignature = signMandate(mandateData, principal.privateKeyObject);

      // Mutate one hex character in signature (bit flip)
      const corruptedSig = validSignature.slice(0, -1) + (validSignature.slice(-1) === "0" ? "1" : "0");

      const intent: CanonicalIntent = {
        intent_id: crypto.randomUUID(),
        client_nonce: crypto.randomBytes(16).toString("hex"),
        timestamp: now,
        mandate: { ...mandateData, signature: corruptedSig },
        proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
      };

      const res = await app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intent });
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe("INVALID_MANDATE_SIGNATURE");
    });

    it("Wrong public key substituted -> Rejected with 401 INVALID_MANDATE_SIGNATURE", async () => {
      const principalA = generatePrincipalKeypair();
      const principalB = generatePrincipalKeypair();
      const now = Math.floor(Date.now() / 1000);

      const mandateData = {
        mandate_id: "man_crypto_subst",
        principal_public_key: principalA.publicKeyHex,
        budget_limit: 500000,
        currency: "INR" as const,
        expiry: now + 3600,
      };
      // Signed with Principal A, but public key field changed to Principal B
      const signatureA = signMandate(mandateData, principalA.privateKeyObject);

      const intent: CanonicalIntent = {
        intent_id: crypto.randomUUID(),
        client_nonce: crypto.randomBytes(16).toString("hex"),
        timestamp: now,
        mandate: { ...mandateData, principal_public_key: principalB.publicKeyHex, signature: signatureA },
        proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
      };

      const res = await app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intent });
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe("INVALID_MANDATE_SIGNATURE");
    });
  });

  // =========================================================================
  // 3. WEBHOOK SECURITY WARFARE
  // =========================================================================
  describe("3. Webhook Security Warfare", () => {
    it("Missing signature on webhook -> 401 INVALID_WEBHOOK_SIGNATURE", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/webhooks/razorpay",
        payload: { event: "payment.captured", payload: {} },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe("INVALID_WEBHOOK_SIGNATURE");
    });

    it("Altered body with forged signature -> 401 INVALID_WEBHOOK_SIGNATURE", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/webhooks/razorpay",
        headers: { "x-razorpay-signature": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" },
        payload: { event: "payment.captured", payload: { malicious: true } },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe("INVALID_WEBHOOK_SIGNATURE");
    });

    it("Valid signature with non-existent order_id -> 200 ORDER_NOT_FOUND (graceful discard without crash)", async () => {
      const payload = {
        event: "payment.captured",
        payload: { payment: { entity: { id: "pay_unknown", order_id: "order_non_existent", amount: 1000, status: "captured" } } },
      };
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "rzp_webhook_secret_test";
      const validSig = crypto
        .createHmac("sha256", webhookSecret)
        .update(JSON.stringify(payload))
        .digest("hex");

      const res = await app.inject({
        method: "POST",
        url: "/webhooks/razorpay",
        headers: { "x-razorpay-signature": validSig },
        payload,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe("ORDER_NOT_FOUND");
    });
  });

  // =========================================================================
  // 4. API AUTHORIZATION & LEAST PRIVILEGE
  // =========================================================================
  describe("4. API Authorization & Privileged Scopes", () => {
    it("Privileged route without token -> 401 UNAUTHORIZED", async () => {
      const res = await app.inject({ method: "GET", url: "/dashboard/metrics" });
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe("UNAUTHORIZED");
    });

    it("Viewer token attempting policy write -> 403 FORBIDDEN", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/v1/merchant/policy",
        headers: { Authorization: "Bearer secret_merchant_viewer" },
        payload: { policy_version: "pol_v_illegal" },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("Viewer token attempting mandate revocation -> 403 FORBIDDEN", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/v1/mandates/revoke",
        headers: { Authorization: "Bearer secret_merchant_viewer" },
        payload: { mandate_id: "man_test_123" },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });
  });

  // =========================================================================
  // 5. INPUT SANITIZATION & APPLICATION BOUNDARIES
  // =========================================================================
  describe("5. Input Sanitization & Bounds", () => {
    it("Zero quantity rejected -> 400 INVALID_INTENT_SCHEMA", async () => {
      const principal = generatePrincipalKeypair();
      const now = Math.floor(Date.now() / 1000);
      const mandateData = {
        mandate_id: "man_input_zero",
        principal_public_key: principal.publicKeyHex,
        budget_limit: 500000,
        currency: "INR" as const,
        expiry: now + 3600,
      };
      const signature = signMandate(mandateData, principal.privateKeyObject);

      const intent: CanonicalIntent = {
        intent_id: crypto.randomUUID(),
        client_nonce: crypto.randomBytes(16).toString("hex"),
        timestamp: now,
        mandate: { ...mandateData, signature },
        proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 0 }],
      };

      const res = await app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intent });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("INVALID_INTENT_SCHEMA");
    });
  });

  // =========================================================================
  // 6. FAIL-CLOSED CHAOS TESTING
  // =========================================================================
  describe("6. Fail-Closed Resilience", () => {
    it("Downstream rail failure -> Dual reservation rolled back cleanly with 502 PAYMENT_RAIL_ERROR", async () => {
      // Mock railClient.createOrder to throw an exception
      services.railClient.createOrder = async () => {
        throw new Error("Simulated Razorpay 503 Service Unavailable timeout");
      };

      const principal = generatePrincipalKeypair();
      const now = Math.floor(Date.now() / 1000);
      const mandateData = {
        mandate_id: "man_failclosed_01",
        principal_public_key: principal.publicKeyHex,
        budget_limit: 500000,
        currency: "INR" as const,
        expiry: now + 3600,
      };
      const signature = signMandate(mandateData, principal.privateKeyObject);

      const initialStock = (db.prepare("SELECT available_stock FROM catalog_items WHERE sku = 'SKU-MOUSE-PRO'").get() as any).available_stock;

      const intent: CanonicalIntent = {
        intent_id: crypto.randomUUID(),
        client_nonce: crypto.randomBytes(16).toString("hex"),
        timestamp: now,
        mandate: { ...mandateData, signature },
        proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
      };

      const res = await app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intent });
      expect(res.statusCode).toBe(502);
      expect(res.json().error).toBe("PAYMENT_RAIL_ERROR");

      // Verify stock was restored to initial value (Dual resource rollback)
      const finalStock = (db.prepare("SELECT available_stock FROM catalog_items WHERE sku = 'SKU-MOUSE-PRO'").get() as any).available_stock;
      expect(finalStock).toBe(initialStock);

      // Verify mandate budget was restored
      const mandateRow = db.prepare("SELECT remaining_budget FROM buyer_mandates WHERE mandate_id = ?").get("man_failclosed_01") as any;
      expect(Number(mandateRow.remaining_budget)).toBe(500000);
    });
  });
});
