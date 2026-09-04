import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { initDatabase, type SqliteDatabase } from "../../store/db.js";
import { buildApp } from "../../server.js";
import { generatePrincipalKeypair, signMandate } from "../crypto.js";
import { RazorpayRailClient } from "../../rails/razorpay.js";
import { CommerceTruthEngine } from "../truth.js";
import { getValidTokens } from "../../gateway/auth.js";
import type { MerchantPolicy, CanonicalIntent } from "../types.js";

describe("SECURITY REMEDIATION REGRESSION & RED-TEAM AUDIT SUITE", () => {
  let app: FastifyInstance;
  let db: SqliteDatabase;
  let services: any;
  let defaultPolicy: MerchantPolicy;
  let keypair: ReturnType<typeof generatePrincipalKeypair>;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    process.env.RAZORPAY_WEBHOOK_SECRET = "rzp_webhook_secret_redteam_test";
    process.env.ACG_ADMIN_TOKEN = "admin_token_super_secret_xyz";
    process.env.ACG_VIEWER_TOKEN = "viewer_token_read_only_abc";

    db = initDatabase(":memory:");
    defaultPolicy = {
      policy_version: "pol_v1.0.0",
      effective_at: Math.floor(Date.now() / 1000) - 3600,
      merchant_id: "merch_acme_electronics_01",
      max_transaction_amount: 5000000,
      allowed_categories: ["electronics", "furniture", "accessories"],
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
      category_whitelist: ["electronics", "furniture", "accessories"],
      expiry: now + expiryOffset,
    };
    const signature = signMandate(mandateData, keypair.privateKeyObject);
    return { ...mandateData, signature };
  }

  function createValidIntent(overrides: Partial<CanonicalIntent> = {}): CanonicalIntent {
    const mandate = overrides.mandate || createValidMandate();
    return {
      intent_id: crypto.randomUUID(),
      client_nonce: crypto.randomBytes(16).toString("hex"),
      timestamp: Math.floor(Date.now() / 1000),
      mandate,
      proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
      ...overrides,
    };
  }

  // =========================================================================
  // 1. RF-05: Negative & Fractional/Zero Quantity Rejection
  // =========================================================================
  describe("1. RF-05: CommerceTruthEngine Quantity Hardening", () => {
    it("1.1 Rejects negative quantity and avoids budget inflation in CommerceTruthEngine", () => {
      const truthEngine = new CommerceTruthEngine(db);
      const res = truthEngine.resolveTruth([{ sku: "SKU-KEYBOARD-RGB", quantity: -10 }]);

      expect(res.isValid).toBe(false);
      expect(res.error).toBe("Invalid item quantity for SKU 'SKU-KEYBOARD-RGB': quantity must be a positive integer");
      expect(res.totalAmount).toBe(0);
      expect(res.resolvedItems).toHaveLength(0);
    });

    it("1.2 Rejects zero quantity in CommerceTruthEngine", () => {
      const truthEngine = new CommerceTruthEngine(db);
      const res = truthEngine.resolveTruth([{ sku: "SKU-KEYBOARD-RGB", quantity: 0 }]);

      expect(res.isValid).toBe(false);
      expect(res.error).toBe("Invalid item quantity for SKU 'SKU-KEYBOARD-RGB': quantity must be a positive integer");
    });

    it("1.3 Rejects fractional quantities (e.g. 1.5, 0.5) in CommerceTruthEngine", () => {
      const truthEngine = new CommerceTruthEngine(db);
      const res1 = truthEngine.resolveTruth([{ sku: "SKU-MOUSE-PRO", quantity: 1.5 }]);
      expect(res1.isValid).toBe(false);
      expect(res1.error).toContain("must be a positive integer");

      const res2 = truthEngine.resolveTruth([{ sku: "SKU-MOUSE-PRO", quantity: 0.1 }]);
      expect(res2.isValid).toBe(false);
      expect(res2.error).toContain("must be a positive integer");
    });

    it("1.4 Direct POST /v1/reservations rejects negative quantity with 400 COMMERCE_TRUTH_REJECTION", async () => {
      const mandate = createValidMandate(1000000);

      const res = await app.inject({
        method: "POST",
        url: "/v1/reservations",
        headers: { authorization: `Bearer ${process.env.ACG_ADMIN_TOKEN}` },
        payload: {
          intent_id: crypto.randomUUID(),
          mandate,
          items: [{ sku: "SKU-KEYBOARD-RGB", quantity: -10 }],
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error).toBe("COMMERCE_TRUTH_REJECTION");
      expect(body.message).toContain("must be a positive integer");
    });

    it("1.5 Rejects negative quantity at CanonicalIntentSchema validation with 400 INVALID_INTENT_SCHEMA", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/v1/agent/checkout",
        payload: {
          intent_id: crypto.randomUUID(),
          client_nonce: crypto.randomBytes(16).toString("hex"),
          timestamp: Math.floor(Date.now() / 1000),
          mandate: createValidMandate(),
          proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: -5 }],
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error).toBe("INVALID_INTENT_SCHEMA");
    });
  });

  // =========================================================================
  // 2. SEC-15: Mandate Revocation Registry Check in PDP.simulate()
  // =========================================================================
  describe("2. SEC-15: Mandate Revocation Registry Enforcement in PDP.simulate()", () => {
    it("2.1 Simulating intent with revoked mandate returns WOULD_DENY and MANDATE_REVOKED", () => {
      const mandate = createValidMandate();
      const intent = createValidIntent({ mandate });

      // Revoke the mandate in the merchant registry
      db.prepare(`
        INSERT INTO revoked_mandates (mandate_id, principal_public_key, revocation_reason, revoked_at)
        VALUES (?, ?, ?, ?)
      `).run(mandate.mandate_id, mandate.principal_public_key, "Key compromised in test audit", Math.floor(Date.now() / 1000));

      const simResult = services.pdp.simulate(intent, defaultPolicy, "native-llm-agent");

      expect(simResult.verdict).toBe("WOULD_DENY");
      expect(simResult.reason_code).toBe("MANDATE_REVOKED");
      expect(simResult.reason).toContain("has been revoked");
      expect(simResult.non_mutating).toBe(true);

      const revocationStage = simResult.stages.find((s: any) => s.stage === "MANDATE_REVOCATION");
      expect(revocationStage).toBeDefined();
      expect(revocationStage.passed).toBe(false);
      expect(revocationStage.error).toBe("Mandate is revoked in merchant registry");
    });

    it("2.2 POST /v1/simulate returns 200 with WOULD_DENY / MANDATE_REVOKED for revoked mandate", async () => {
      const mandate = createValidMandate();
      const intent = createValidIntent({ mandate });

      db.prepare(`
        INSERT INTO revoked_mandates (mandate_id, principal_public_key, revocation_reason, revoked_at)
        VALUES (?, ?, ?, ?)
      `).run(mandate.mandate_id, mandate.principal_public_key, "Security test revocation", Math.floor(Date.now() / 1000));

      const res = await app.inject({
        method: "POST",
        url: "/v1/simulate",
        payload: intent,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.verdict).toBe("WOULD_DENY");
      expect(body.reason_code).toBe("MANDATE_REVOKED");
      expect(body.non_mutating).toBe(true);
    });
  });

  // =========================================================================
  // 3. RF-09: Nonce Replay Prevention
  // =========================================================================
  describe("3. RF-09: Nonce Replay Prevention (used_nonces composite key)", () => {
    it("3.1 Replaying the same client_nonce and mandate_id returns 409 DUPLICATE_NONCE_REPLAY", async () => {
      const mandate = createValidMandate(1000000);
      const fixedNonce = "nonce_fixed_test_remediation_abc123";

      const intent1 = createValidIntent({
        intent_id: crypto.randomUUID(),
        client_nonce: fixedNonce,
        mandate,
      });

      // First request succeeds
      const res1 = await app.inject({
        method: "POST",
        url: "/v1/agent/checkout",
        payload: intent1,
      });
      expect([201, 202]).toContain(res1.statusCode);

      // Second request with different intent_id but IDENTICAL nonce and mandate_id
      const intent2 = createValidIntent({
        intent_id: crypto.randomUUID(),
        client_nonce: fixedNonce,
        mandate,
      });

      const res2 = await app.inject({
        method: "POST",
        url: "/v1/agent/checkout",
        payload: intent2,
      });

      expect(res2.statusCode).toBe(409);
      const body = res2.json();
      expect(body.error).toBe("DUPLICATE_NONCE_REPLAY");
      expect(body.message).toContain(`Client nonce '${fixedNonce}' has already been used for mandate '${mandate.mandate_id}'`);
    });

    it("3.2 Allows identical nonce on a DIFFERENT mandate (composite primary key)", async () => {
      const mandate1 = createValidMandate(500000);
      const mandate2 = createValidMandate(500000);
      const fixedNonce = "nonce_shared_across_distinct_mandates_789";

      const intent1 = createValidIntent({
        intent_id: crypto.randomUUID(),
        client_nonce: fixedNonce,
        mandate: mandate1,
      });

      const res1 = await app.inject({
        method: "POST",
        url: "/v1/agent/checkout",
        payload: intent1,
      });
      expect([201, 202]).toContain(res1.statusCode);

      // Same nonce, but different mandate
      const intent2 = createValidIntent({
        intent_id: crypto.randomUUID(),
        client_nonce: fixedNonce,
        mandate: mandate2,
      });

      const res2 = await app.inject({
        method: "POST",
        url: "/v1/agent/checkout",
        payload: intent2,
      });
      // Should NOT fail with DUPLICATE_NONCE_REPLAY
      expect(res2.statusCode).not.toBe(409);
      expect([201, 202]).toContain(res2.statusCode);
    });
  });

  // =========================================================================
  // 4. RF-09: Intent Timestamp Freshness Window (±300s)
  // =========================================================================
  describe("4. RF-09: Intent Timestamp Freshness Window Enforcement", () => {
    it("4.1 Rejects intent with timestamp > 300 seconds in past with 400 INTENT_EXPIRED", async () => {
      const pastTimestamp = Math.floor(Date.now() / 1000) - 305;
      const intent = createValidIntent({ timestamp: pastTimestamp });

      const res = await app.inject({
        method: "POST",
        url: "/v1/agent/checkout",
        payload: intent,
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error).toBe("INTENT_EXPIRED");
      expect(body.message).toContain("outside the valid 300-second window");
    });

    it("4.2 Rejects intent with timestamp > 300 seconds in future with 400 INTENT_EXPIRED", async () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 305;
      const intent = createValidIntent({ timestamp: futureTimestamp });

      const res = await app.inject({
        method: "POST",
        url: "/v1/agent/checkout",
        payload: intent,
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error).toBe("INTENT_EXPIRED");
      expect(body.message).toContain("outside the valid 300-second window");
    });

    it("4.3 Rejects millisecond-format timestamps outside ±300s window", async () => {
      const pastMillis = Date.now() - 350000; // 350 seconds ago in ms
      const intent = createValidIntent({ timestamp: pastMillis });

      const res = await app.inject({
        method: "POST",
        url: "/v1/agent/checkout",
        payload: intent,
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("INTENT_EXPIRED");
    });

    it("4.4 Accepts intent with fresh timestamp within ±300s window", async () => {
      const freshTimestamp = Math.floor(Date.now() / 1000) - 10;
      const intent = createValidIntent({ timestamp: freshTimestamp });

      const res = await app.inject({
        method: "POST",
        url: "/v1/agent/checkout",
        payload: intent,
      });

      expect(res.statusCode).not.toBe(400);
      expect([201, 202]).toContain(res.statusCode);
    });
  });

  // =========================================================================
  // 5. RF-10: Mandate Update Key Mismatch Protection
  // =========================================================================
  describe("5. RF-10: Cross-Principal Mandate Signature Substitution Protection", () => {
    it("5.1 Updating existing mandate with different public key returns 403 MANDATE_KEY_MISMATCH", async () => {
      const victimKeypair = generatePrincipalKeypair();
      const attackerKeypair = generatePrincipalKeypair();

      const mandateId = `man_victim_${crypto.randomUUID()}`;
      const now = Math.floor(Date.now() / 1000);

      // 1. Register Alice's original mandate
      const aliceMandate = {
        mandate_id: mandateId,
        principal_public_key: victimKeypair.publicKeyHex,
        budget_limit: 1000000,
        currency: "INR" as const,
        merchant_whitelist: [defaultPolicy.merchant_id],
        category_whitelist: ["electronics"],
        expiry: now + 3600,
      };
      const aliceSignature = signMandate(aliceMandate, victimKeypair.privateKeyObject);

      const regRes = await app.inject({
        method: "POST",
        url: "/v1/mandates",
        payload: { ...aliceMandate, signature: aliceSignature },
      });
      expect([200, 201]).toContain(regRes.statusCode);

      // 2. Attacker Bob tries to update Alice's mandate with Bob's public key & signature
      const bobMandate = {
        mandate_id: mandateId,
        principal_public_key: attackerKeypair.publicKeyHex,
        budget_limit: 5000000,
        currency: "INR" as const,
        merchant_whitelist: [defaultPolicy.merchant_id],
        category_whitelist: ["electronics"],
        expiry: now + 7200,
      };
      const bobSignature = signMandate(bobMandate, attackerKeypair.privateKeyObject);

      const attackRes = await app.inject({
        method: "POST",
        url: "/v1/mandates",
        payload: { ...bobMandate, signature: bobSignature },
      });

      expect(attackRes.statusCode).toBe(403);
      const body = attackRes.json();
      expect(body.error).toBe("MANDATE_KEY_MISMATCH");
      expect(body.message).toBe("Cannot update mandate registered to a different principal public key");

      // 3. Confirm Alice's stored key in the database was NOT overwritten
      const stored = db.prepare("SELECT principal_public_key FROM buyer_mandates WHERE mandate_id = ?").get(mandateId) as any;
      expect(stored.principal_public_key).toBe(victimKeypair.publicKeyHex);
      expect(stored.principal_public_key).not.toBe(attackerKeypair.publicKeyHex);
    });
  });

  // =========================================================================
  // 6. SEC-12: Auth Middleware Prototype Pollution/Crash Immunity
  // =========================================================================
  describe("6. SEC-12: Auth Middleware Prototype Crash Immunity", () => {
    it("6.1 Authorization: Bearer toString returns 401 without throwing 500 TypeError", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/v1/reservations",
        headers: { authorization: "Bearer toString" },
        payload: {
          intent_id: crypto.randomUUID(),
          items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
        },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.error).toBe("UNAUTHORIZED");
      expect(body.message).toBe("Invalid credentials");
    });

    it("6.2 Tests multiple prototype methods (valueOf, constructor, __proto__, hasOwnProperty)", async () => {
      const prototypeKeys = ["valueOf", "constructor", "__proto__", "hasOwnProperty", "isPrototypeOf"];

      for (const protoKey of prototypeKeys) {
        const res = await app.inject({
          method: "POST",
          url: "/v1/reservations",
          headers: { authorization: `Bearer ${protoKey}` },
          payload: {},
        });

        expect(res.statusCode).toBe(401);
        expect(res.json().error).toBe("UNAUTHORIZED");
      }
    });

    it("6.3 getValidTokens() uses null-prototype dictionary (Object.create(null))", () => {
      const tokens = getValidTokens();
      expect(Object.getPrototypeOf(tokens)).toBeNull();
      expect((tokens as any).toString).toBeUndefined();
      expect((tokens as any).valueOf).toBeUndefined();
    });
  });

  // =========================================================================
  // 7. RF-07: Live Razorpay Credential Detection
  // =========================================================================
  describe("7. RF-07: Live Razorpay Production Credential Detection", () => {
    it("7.1 Real live production key (rzp_live_...) sets isLiveCredentials === true", () => {
      const liveClient = new RazorpayRailClient("rzp_live_realprodkey123", "secret_live_999");
      expect(liveClient.isLiveCredentials).toBe(true);
    });

    it("7.2 Real live test key (rzp_test_...) sets isLiveCredentials === true", () => {
      const testClient = new RazorpayRailClient("rzp_test_authentic_key_456", "secret_test_123");
      expect(testClient.isLiveCredentials).toBe(true);
    });

    it("7.3 Mock and placeholder test keys evaluate isLiveCredentials === false", () => {
      const mockClient = new RazorpayRailClient("rzp_test_mock", "mock_secret");
      expect(mockClient.isLiveCredentials).toBe(false);

      const placeholderClient = new RazorpayRailClient("rzp_test_placeholder_key", "mock_secret");
      expect(placeholderClient.isLiveCredentials).toBe(false);
    });

    it("7.4 Arbitrary non-Razorpay prefix evaluates isLiveCredentials === false", () => {
      const invalidClient = new RazorpayRailClient("invalid_custom_key_789", "secret");
      expect(invalidClient.isLiveCredentials).toBe(false);
    });
  });

  // =========================================================================
  // 8. RF-04: Refund Protection & Mandate Budget Restoration
  // =========================================================================
  describe("8. RF-04: Post-Capture Fulfillment Failure & Refund Protection", () => {
    it("8.1 Blocks refund when session status is not PAYMENT_CAPTURED (e.g. ORDER_CREATED)", async () => {
      const intentId = `intent_precap_${crypto.randomUUID()}`;
      const reservationId = `res_precap_${crypto.randomUUID()}`;
      const mandateId = `man_precap_${crypto.randomUUID()}`;

      // Insert mandate and reservation to satisfy foreign keys
      db.prepare(`
        INSERT INTO buyer_mandates (mandate_id, principal_public_key, budget_limit, remaining_budget, currency, expiry, signature, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(mandateId, keypair.publicKeyHex, 500000, 250000, "INR", Math.floor(Date.now() / 1000) + 3600, "sig", Date.now());

      db.prepare(`
        INSERT INTO reservations (reservation_id, intent_id, mandate_id, reserved_budget, status, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(reservationId, intentId, mandateId, 250000, "HELD", Date.now(), Date.now() + 600000);

      db.prepare(`
        INSERT INTO order_sessions (
          intent_id, receipt, razorpay_order_id, razorpay_payment_id, amount, currency, status, reservation_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(intentId, intentId, "order_precap_123", "pay_precap_123", 250000, "INR", "ORDER_CREATED", reservationId, Date.now(), Date.now());

      await services.webhookProcessor.handlePostCaptureFulfillmentFailure(intentId, "Warehouse item damaged");

      const session = db.prepare("SELECT status FROM order_sessions WHERE intent_id = ?").get(intentId) as any;
      expect(session.status).toBe("ORDER_CREATED");

      const auditRow = db.prepare(`
        SELECT * FROM audit_ledger WHERE intent_id = ? AND event_type = 'REFUND_BLOCKED_INVALID_STATUS'
      `).get(intentId) as any;
      expect(auditRow).toBeDefined();
    });

    it("8.2 Blocks refund when session status is already REFUNDED (prevents repeated drain)", async () => {
      const intentId = `intent_double_rfnd_${crypto.randomUUID()}`;
      const reservationId = `res_already_rfnd_${crypto.randomUUID()}`;
      const mandateId = `man_already_rfnd_${crypto.randomUUID()}`;

      db.prepare(`
        INSERT INTO buyer_mandates (mandate_id, principal_public_key, budget_limit, remaining_budget, currency, expiry, signature, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(mandateId, keypair.publicKeyHex, 500000, 500000, "INR", Math.floor(Date.now() / 1000) + 3600, "sig", Date.now());

      db.prepare(`
        INSERT INTO reservations (reservation_id, intent_id, mandate_id, reserved_budget, status, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(reservationId, intentId, mandateId, 250000, "COMMITTED", Date.now(), Date.now() + 600000);

      db.prepare(`
        INSERT INTO order_sessions (
          intent_id, receipt, razorpay_order_id, razorpay_payment_id, amount, currency, status, reservation_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(intentId, intentId, "order_already_rfnd", "pay_already_rfnd", 250000, "INR", "REFUNDED", reservationId, Date.now(), Date.now());

      await services.webhookProcessor.handlePostCaptureFulfillmentFailure(intentId, "Second refund attempt");

      const session = db.prepare("SELECT status FROM order_sessions WHERE intent_id = ?").get(intentId) as any;
      expect(session.status).toBe("REFUNDED");

      const auditRow = db.prepare(`
        SELECT * FROM audit_ledger WHERE intent_id = ? AND event_type = 'REFUND_BLOCKED_INVALID_STATUS'
      `).get(intentId) as any;
      expect(auditRow).toBeDefined();
    });

    it("8.3 Processes refund on PAYMENT_CAPTURED session, uses deterministic idempotency key, and restores mandate budget", async () => {
      const intentId = `intent_captured_rfnd_${crypto.randomUUID()}`;
      const reservationId = `res_rfnd_${crypto.randomUUID()}`;
      const mandateId = `man_rfnd_${crypto.randomUUID()}`;
      const refundAmount = 300000; // ₹3,000.00

      // 1. Create buyer mandate with 500,000 budget and 200,000 remaining
      db.prepare(`
        INSERT INTO buyer_mandates (
          mandate_id, principal_public_key, budget_limit, remaining_budget, currency, expiry, signature, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(mandateId, keypair.publicKeyHex, 500000, 200000, "INR", Math.floor(Date.now() / 1000) + 3600, "sig", Date.now());

      // 2. Create reservation binding
      db.prepare(`
        INSERT INTO reservations (
          reservation_id, intent_id, mandate_id, reserved_budget, status, created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(reservationId, intentId, mandateId, refundAmount, "HELD", Date.now(), Date.now() + 600000);

      // 3. Create captured order session
      db.prepare(`
        INSERT INTO order_sessions (
          intent_id, receipt, razorpay_order_id, razorpay_payment_id, amount, currency, status, reservation_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(intentId, intentId, "order_captured_ok", "pay_captured_ok", refundAmount, "INR", "PAYMENT_CAPTURED", reservationId, Date.now(), Date.now());

      // 4. Trigger fulfillment failure
      await services.webhookProcessor.handlePostCaptureFulfillmentFailure(intentId, "Warehouse damaged remaining stock");

      // Verify session transitioned to REFUNDED
      const session = db.prepare("SELECT status FROM order_sessions WHERE intent_id = ?").get(intentId) as any;
      expect(session.status).toBe("REFUNDED");

      // Verify mandate budget restored from 200,000 to 500,000 (+300,000)
      const mandate = db.prepare("SELECT remaining_budget FROM buyer_mandates WHERE mandate_id = ?").get(mandateId) as any;
      expect(mandate.remaining_budget).toBe(500000);

      // Verify deterministic idempotency key in audit ledger
      const pendingAudit = db.prepare(`
        SELECT * FROM audit_ledger WHERE intent_id = ? AND event_type = 'REFUND_PENDING'
      `).get(intentId) as any;
      expect(pendingAudit).toBeDefined();
      const pendingDetails = JSON.parse(pendingAudit.details_json);
      expect(pendingDetails.refundIdempotencyKey).toBe(`rfnd_${intentId}_fulfillment_failure`);

      // Verify refund processed audit entry
      const processedAudit = db.prepare(`
        SELECT * FROM audit_ledger WHERE intent_id = ? AND event_type = 'REFUND_PROCESSED'
      `).get(intentId) as any;
      expect(processedAudit).toBeDefined();
      const processedDetails = JSON.parse(processedAudit.details_json);
      expect(processedDetails.restoredMandateId).toBe(mandateId);
      expect(processedDetails.amountRestored).toBe(refundAmount);
    });
  });

  // =========================================================================
  // 9. RF-08: Webhook Deduplication via Payload Hash
  // =========================================================================
  describe("9. RF-08: Webhook Deduplication via Body Payload Hash", () => {
    it("9.1 Identical payload body with modified x-razorpay-event-id header is detected and rejected as duplicate", async () => {
      const orderId = `order_webhook_dedup_${crypto.randomUUID()}`;
      const paymentId = `pay_webhook_dedup_${crypto.randomUUID()}`;
      const intentId = `intent_webhook_dedup_${crypto.randomUUID()}`;
      const reservationId = `res_webhook_dedup_${crypto.randomUUID()}`;
      const mandateId = `man_webhook_dedup_${crypto.randomUUID()}`;

      db.prepare(`
        INSERT INTO buyer_mandates (mandate_id, principal_public_key, budget_limit, remaining_budget, currency, expiry, signature, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(mandateId, keypair.publicKeyHex, 500000, 400000, "INR", Math.floor(Date.now() / 1000) + 3600, "sig", Date.now());

      db.prepare(`
        INSERT INTO reservations (reservation_id, intent_id, mandate_id, reserved_budget, status, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(reservationId, intentId, mandateId, 100000, "HELD", Date.now(), Date.now() + 600000);

      // Insert active order session
      db.prepare(`
        INSERT INTO order_sessions (
          intent_id, receipt, razorpay_order_id, razorpay_payment_id, amount, currency, status, reservation_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(intentId, intentId, orderId, null, 100000, "INR", "ORDER_CREATED", reservationId, Date.now(), Date.now());

      const webhookPayload = {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: paymentId,
              order_id: orderId,
              amount: 100000,
              status: "captured",
            },
          },
        },
      };

      const webhookSecret = (services.webhookProcessor as any).webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET || "rzp_webhook_secret_redteam_test";
      const rawBodyStr = JSON.stringify(webhookPayload);
      const signature = crypto.createHmac("sha256", webhookSecret).update(rawBodyStr).digest("hex");

      // 1. First webhook delivery with event ID 'evt_first_original_1'
      const firstRes = await app.inject({
        method: "POST",
        url: "/webhooks/razorpay",
        headers: {
          "content-type": "application/json",
          "x-razorpay-signature": signature,
          "x-razorpay-event-id": "evt_first_original_1",
        },
        payload: rawBodyStr,
      });

      expect(firstRes.statusCode).toBe(200);
      expect(firstRes.json().status).toBe("PROCESSED");

      const sessionAfterFirst = db.prepare("SELECT status FROM order_sessions WHERE intent_id = ?").get(intentId) as any;
      expect(sessionAfterFirst.status).toBe("PAYMENT_CAPTURED");

      // 2. Second webhook delivery: EXACT SAME body, but ATTACKER modified event ID header to 'evt_second_forged_2'
      const secondRes = await app.inject({
        method: "POST",
        url: "/webhooks/razorpay",
        headers: {
          "content-type": "application/json",
          "x-razorpay-signature": signature,
          "x-razorpay-event-id": "evt_second_forged_2",
        },
        payload: rawBodyStr,
      });

      expect(secondRes.statusCode).toBe(200);
      const secondBody = secondRes.json();
      expect(secondBody.status).toBe("DUPLICATE_IGNORED");
      expect(secondBody.message).toContain("already processed");
    });
  });

  // =========================================================================
  // 10. RF-01: Universal Protocol Ingress PDP Evaluation
  // =========================================================================
  describe("10. RF-01: Protocol Ingress Evaluates V2 Policy Decision Point", () => {
    it("10.1 Suspended agent on MCP protocol ingress is rejected with 403 AGENT_SUSPENDED", async () => {
      const suspendedAgentId = "agent_suspended_mcp_redteam";
      const now = Math.floor(Date.now() / 1000);

      // Register agent as SUSPENDED
      db.prepare(`
        INSERT INTO agent_principals (
          agent_id, organization_id, provider, model_name, agent_type,
          trust_level, credential_state, created_at, expires_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(suspendedAgentId, "org_acme", "anthropic", "claude-3-7-sonnet", "AUTONOMOUS", "VERIFIED", "ACTIVE", now, now + 86400, "SUSPENDED");

      const mandate = createValidMandate(500000);
      const mcpPayload = {
        method: "tools/call",
        params: {
          name: "acg_checkout",
          arguments: {
            intent_id: crypto.randomUUID(),
            client_nonce: crypto.randomBytes(16).toString("hex"),
            timestamp: now,
            mandate,
            items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
            agent_metadata: { agent_id: suspendedAgentId },
          },
        },
      };

      const res = await app.inject({
        method: "POST",
        url: "/v1/agent/ingress/mcp",
        payload: mcpPayload,
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.error).toBe("AGENT_SUSPENDED");
      expect(body.message).toContain("AGENT_SUSPENDED");
    });

    it("10.2 Header x-agent-id with suspended agent on protocol ingress returns 403 AGENT_SUSPENDED", async () => {
      const suspendedAgentId = "agent_suspended_header_redteam";
      const now = Math.floor(Date.now() / 1000);

      db.prepare(`
        INSERT INTO agent_principals (
          agent_id, organization_id, provider, model_name, agent_type,
          trust_level, credential_state, created_at, expires_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(suspendedAgentId, "org_acme", "anthropic", "claude-3-7-sonnet", "AUTONOMOUS", "VERIFIED", "ACTIVE", now, now + 86400, "SUSPENDED");

      const mandate = createValidMandate(500000);
      const mcpPayload = {
        method: "tools/call",
        params: {
          name: "acg_checkout",
          arguments: {
            intent_id: crypto.randomUUID(),
            client_nonce: crypto.randomBytes(16).toString("hex"),
            timestamp: now,
            mandate,
            items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
          },
        },
      };

      const res = await app.inject({
        method: "POST",
        url: "/v1/agent/ingress/mcp",
        headers: { "x-agent-id": suspendedAgentId },
        payload: mcpPayload,
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("AGENT_SUSPENDED");
    });
  });

  // =========================================================================
  // 11. RF-02: Agent Principal Protection
  // =========================================================================
  describe("11. RF-02: Agent Principal Protection & Unauthorized Reactivation Blocking", () => {
    it("11.1 Unauthenticated caller cannot modify or un-suspend existing agent (403 FORBIDDEN)", async () => {
      const targetAgentId = "agent_rogue_target_01";
      const now = Math.floor(Date.now() / 1000);

      // Register agent as SUSPENDED
      db.prepare(`
        INSERT INTO agent_principals (
          agent_id, organization_id, provider, model_name, agent_type,
          trust_level, credential_state, created_at, expires_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(targetAgentId, "org_acme", "openai", "gpt-4o", "AUTONOMOUS", "STANDARD", "ACTIVE", now, now + 86400, "SUSPENDED");

      // Anonymous attempt to modify existing agent
      const res = await app.inject({
        method: "POST",
        url: "/v1/agents",
        payload: {
          agent_id: targetAgentId,
          status: "ACTIVE",
          confirmation_above: 1000000000,
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.error).toBe("FORBIDDEN");
      expect(body.message).toContain("Modifying existing agent principals requires authenticated merchant:write scope");

      // Ensure status remains SUSPENDED
      const agent = db.prepare("SELECT status FROM agent_principals WHERE agent_id = ?").get(targetAgentId) as any;
      expect(agent.status).toBe("SUSPENDED");
    });

    it("11.2 Authenticated caller cannot reactivate suspended agent without explicit override (403 FORBIDDEN)", async () => {
      const targetAgentId = "agent_suspended_no_override";
      const now = Math.floor(Date.now() / 1000);

      db.prepare(`
        INSERT INTO agent_principals (
          agent_id, organization_id, provider, model_name, agent_type,
          trust_level, credential_state, created_at, expires_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(targetAgentId, "org_acme", "anthropic", "claude-3-7-sonnet", "AUTONOMOUS", "VERIFIED", "ACTIVE", now, now + 86400, "SUSPENDED");

      // Authenticated with admin token (has merchant:write scope) but NO override flag
      const res = await app.inject({
        method: "POST",
        url: "/v1/agents",
        headers: { authorization: `Bearer ${process.env.ACG_ADMIN_TOKEN}` },
        payload: {
          agent_id: targetAgentId,
          status: "ACTIVE",
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.error).toBe("FORBIDDEN");
      expect(body.message).toContain("Cannot reactivate suspended agent 'agent_suspended_no_override' without explicit override");

      const agent = db.prepare("SELECT status FROM agent_principals WHERE agent_id = ?").get(targetAgentId) as any;
      expect(agent.status).toBe("SUSPENDED");
    });

    it("11.3 Authenticated caller with override_suspension: true can reactivate suspended agent", async () => {
      const targetAgentId = "agent_suspended_with_override";
      const now = Math.floor(Date.now() / 1000);

      db.prepare(`
        INSERT INTO agent_principals (
          agent_id, organization_id, provider, model_name, agent_type,
          trust_level, credential_state, created_at, expires_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(targetAgentId, "org_acme", "anthropic", "claude-3-7-sonnet", "AUTONOMOUS", "VERIFIED", "ACTIVE", now, now + 86400, "SUSPENDED");

      // Authenticated with admin token AND override_suspension: true
      const res = await app.inject({
        method: "POST",
        url: "/v1/agents",
        headers: { authorization: `Bearer ${process.env.ACG_ADMIN_TOKEN}` },
        payload: {
          agent_id: targetAgentId,
          status: "ACTIVE",
          override_suspension: true,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.status).toBe("CREATED");
      expect(body.principal.status).toBe("ACTIVE");

      const agent = db.prepare("SELECT status FROM agent_principals WHERE agent_id = ?").get(targetAgentId) as any;
      expect(agent.status).toBe("ACTIVE");
    });
  });
});
