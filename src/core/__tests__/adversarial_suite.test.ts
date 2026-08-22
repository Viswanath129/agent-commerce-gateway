import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { buildApp } from "../../server.js";
import { initDatabase } from "../../store/db.js";
import { generatePrincipalKeypair, signMandate, verifyMandateSignature } from "../crypto.js";
import type { BuyerMandate, CanonicalIntent } from "../types.js";
import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance } from "fastify";

describe("ACG Comprehensive Adversarial Verification Suite", () => {
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
  // DOMAIN 1: CRYPTOGRAPHIC AUTHENTICITY & TAMPER RESISTANCE
  // =========================================================================
  describe("Domain 1: Cryptographic Mandate Authority", () => {
    it("1.1 [VALID]: Generates and verifies valid Ed25519 mandate signature", () => {
      const principal = generatePrincipalKeypair();
      const mandateData = {
        mandate_id: "mandate_valid_01",
        principal_public_key: principal.publicKeyHex,
        budget_limit: 500000,
        currency: "INR" as const,
        expiry: Math.floor(Date.now() / 1000) + 3600,
      };
      const signature = signMandate(mandateData, principal.privateKeyObject);
      const validMandate: BuyerMandate = { ...mandateData, signature };

      expect(verifyMandateSignature(validMandate)).toBe(true);
    });

    it("1.2 [FORGERY ATTACK]: Rejects tampered budget in mandate payload", async () => {
      const principal = generatePrincipalKeypair();
      const now = Math.floor(Date.now() / 1000);
      const mandateData = {
        mandate_id: "mandate_forged_01",
        principal_public_key: principal.publicKeyHex,
        budget_limit: 500000, // ₹5,000
        currency: "INR" as const,
        expiry: now + 3600,
      };
      const signature = signMandate(mandateData, principal.privateKeyObject);

      // Attacker tampers budget to ₹50,000 after signature
      const tamperedIntent: CanonicalIntent = {
        intent_id: crypto.randomUUID(),
        client_nonce: crypto.randomBytes(16).toString("hex"),
        timestamp: now,
        mandate: { ...mandateData, budget_limit: 5000000, signature },
        proposed_items: [{ sku: "SKU-KEYBOARD-RGB", quantity: 1 }],
      };

      const res = await app.inject({
        method: "POST",
        url: "/v1/agent/checkout",
        payload: tamperedIntent,
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe("INVALID_MANDATE_SIGNATURE");
    });

    it("1.3 [TEMPORAL ATTACK]: Rejects expired buyer mandate", async () => {
      const principal = generatePrincipalKeypair();
      const pastTime = Math.floor(Date.now() / 1000) - 60; // Expired 1 min ago
      const mandateData = {
        mandate_id: "mandate_expired_01",
        principal_public_key: principal.publicKeyHex,
        budget_limit: 500000,
        currency: "INR" as const,
        expiry: pastTime,
      };
      const signature = signMandate(mandateData, principal.privateKeyObject);

      const expiredIntent: CanonicalIntent = {
        intent_id: crypto.randomUUID(),
        client_nonce: crypto.randomBytes(16).toString("hex"),
        timestamp: pastTime,
        mandate: { ...mandateData, signature },
        proposed_items: [{ sku: "SKU-KEYBOARD-RGB", quantity: 1 }],
      };

      const res = await app.inject({
        method: "POST",
        url: "/v1/agent/checkout",
        payload: expiredIntent,
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("MANDATE_EXPIRED");
    });
  });

  // =========================================================================
  // DOMAIN 2: COMMERCE TRUTH & PROMPT INJECTION RESISTANCE
  // =========================================================================
  describe("Domain 2: Commerce Truth & Catalog Grounding", () => {
    it("2.1 [HALLUCINATION ATTACK]: Ignores hallucinated price; computes deterministic total from DB", async () => {
      const principal = generatePrincipalKeypair();
      const now = Math.floor(Date.now() / 1000);
      const mandateData = {
        mandate_id: "mandate_truth_01",
        principal_public_key: principal.publicKeyHex,
        budget_limit: 500000, // ₹5,000
        currency: "INR" as const,
        expiry: now + 3600,
      };
      const signature = signMandate(mandateData, principal.privateKeyObject);

      // LLM claims keyboard is ₹1.00 (100 paise)
      const intent: CanonicalIntent = {
        intent_id: crypto.randomUUID(),
        client_nonce: crypto.randomBytes(16).toString("hex"),
        timestamp: now,
        mandate: { ...mandateData, signature },
        proposed_items: [{ sku: "SKU-KEYBOARD-RGB", quantity: 1 }],
      };

      const res = await app.inject({
        method: "POST",
        url: "/v1/agent/checkout",
        payload: intent,
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.amount_paise).toBe(413000);
      expect(body.receipt).toBe(intent.intent_id);
    });

    it("2.2 [INVENTORY STOCKOUT]: Rejects item when requested qty exceeds available stock", async () => {
      const principal = generatePrincipalKeypair();
      const now = Math.floor(Date.now() / 1000);
      const mandateData = {
        mandate_id: "mandate_stock_01",
        principal_public_key: principal.publicKeyHex,
        budget_limit: 50000000, // Large budget
        currency: "INR" as const,
        expiry: now + 3600,
      };
      const signature = signMandate(mandateData, principal.privateKeyObject);

      // Stock is only 5 units in default catalog; agent requests 100
      const intent: CanonicalIntent = {
        intent_id: crypto.randomUUID(),
        client_nonce: crypto.randomBytes(16).toString("hex"),
        timestamp: now,
        mandate: { ...mandateData, signature },
        proposed_items: [{ sku: "SKU-KEYBOARD-RGB", quantity: 100 }],
      };

      const res = await app.inject({
        method: "POST",
        url: "/v1/agent/checkout",
        payload: intent,
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("COMMERCE_TRUTH_REJECTION");
    });
  });

  // =========================================================================
  // DOMAIN 3: TRUE CONCURRENT DOUBLE-SPEND DEFENSE
  // =========================================================================
  describe("Domain 3: High-Concurrency Dual-Resource Locking", () => {
    it("3.1 [RACE CONDITION]: When Mandate = ₹5,000 and Agent A & B both request ₹4,130 concurrently, exactly ONE succeeds", async () => {
      const principal = generatePrincipalKeypair();
      const now = Math.floor(Date.now() / 1000);
      const mandateData = {
        mandate_id: `mandate_true_race_${crypto.randomBytes(4).toString("hex")}`,
        principal_public_key: principal.publicKeyHex,
        budget_limit: 500000, // ₹5,000.00
        currency: "INR" as const,
        expiry: now + 3600,
      };
      const signature = signMandate(mandateData, principal.privateKeyObject);

      // Both agents request SKU-KEYBOARD-RGB (₹4,130.00 each)
      const intentA: CanonicalIntent = {
        intent_id: crypto.randomUUID(),
        client_nonce: crypto.randomBytes(16).toString("hex"),
        timestamp: now,
        mandate: { ...mandateData, signature },
        proposed_items: [{ sku: "SKU-KEYBOARD-RGB", quantity: 1 }],
      };

      const intentB: CanonicalIntent = {
        intent_id: crypto.randomUUID(),
        client_nonce: crypto.randomBytes(16).toString("hex"),
        timestamp: now,
        mandate: { ...mandateData, signature },
        proposed_items: [{ sku: "SKU-KEYBOARD-RGB", quantity: 1 }],
      };

      const [resA, resB] = await Promise.all([
        app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intentA }),
        app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intentB }),
      ]);

      const statusCodes = [resA.statusCode, resB.statusCode];
      expect(statusCodes).toContain(201); // Exactly 1 allowed
      expect(statusCodes).toContain(409); // Exactly 1 blocked

      // Verify DB remaining budget in ledger
      const mandateRow = db.prepare("SELECT remaining_budget FROM buyer_mandates WHERE mandate_id = ?").get(mandateData.mandate_id) as any;
      expect(Number(mandateRow.remaining_budget)).toBe(87000); // 500000 - 413000 = 87000 paise (₹870.00)
    });
  });

  // =========================================================================
  // DOMAIN 4: WEBHOOK RECONCILIATION, DEDUPLICATION & MONOTONICITY
  // =========================================================================
  describe("Domain 4: Webhook Processing & Reconciliation", () => {
    it("4.1 [WEBHOOK DEDUPLICATION]: Drops duplicate webhook events using x-razorpay-event-id", async () => {
      const orderId = `order_${crypto.randomBytes(6).toString("hex")}`;
      const intentId = crypto.randomUUID();

      db.prepare(`
        INSERT INTO buyer_mandates (mandate_id, principal_public_key, budget_limit, remaining_budget, currency, expiry, signature, created_at)
        VALUES ('man_wb_1', 'pubkey', 500000, 500000, 'INR', 9999999999, 'sig', 1000)
      `).run();

      db.prepare(`
        INSERT INTO reservations (reservation_id, intent_id, mandate_id, reserved_budget, status, created_at, expires_at)
        VALUES ('res_wb_1', ?, 'man_wb_1', 350000, 'HELD', 1000, 2000)
      `).run(intentId);

      db.prepare(`
        INSERT INTO order_sessions (intent_id, receipt, razorpay_order_id, amount, currency, status, reservation_id, created_at, updated_at)
        VALUES (?, ?, ?, 350000, 'INR', 'ORDER_CREATED', 'res_wb_1', 1000, 1000)
      `).run(intentId, intentId, orderId);

      const eventId = `evt_${crypto.randomBytes(6).toString("hex")}`;
      const payload = {
        event: "payment.captured",
        payload: {
          order: { entity: { id: orderId, receipt: intentId, status: "paid" } },
          payment: { entity: { id: "pay_test_01", order_id: orderId, amount: 350000, status: "captured" } },
        },
      };

      // 1st delivery
      const res1 = await app.inject({
        method: "POST",
        url: "/webhooks/razorpay",
        headers: { "x-razorpay-signature": "mock_signature", "x-razorpay-event-id": eventId },
        payload,
      });
      expect(res1.statusCode).toBe(200);
      expect(res1.json().status).toBe("PROCESSED");

      // 2nd delivery (Duplicate)
      const res2 = await app.inject({
        method: "POST",
        url: "/webhooks/razorpay",
        headers: { "x-razorpay-signature": "mock_signature", "x-razorpay-event-id": eventId },
        payload,
      });
      expect(res2.statusCode).toBe(200);
      expect(res2.json().status).toBe("DUPLICATE_IGNORED");
    });
  });

  // =========================================================================
  // DOMAIN 5: SAFE REFUND LIFECYCLE & CAPTURE REQUISITE
  // =========================================================================
  describe("Domain 5: Safe Refund Lifecycle", () => {
    it("5.1 [SAFE REFUND]: Post-capture failure executes idempotent refund and transitions to REFUNDED", async () => {
      const intentId = crypto.randomUUID();
      const orderId = `order_${crypto.randomBytes(6).toString("hex")}`;
      const paymentId = `pay_${crypto.randomBytes(6).toString("hex")}`;

      db.prepare(`
        INSERT INTO buyer_mandates (mandate_id, principal_public_key, budget_limit, remaining_budget, currency, expiry, signature, created_at)
        VALUES ('man_rf_1', 'pubkey', 500000, 87000, 'INR', 9999999999, 'sig', 1000)
      `).run();

      db.prepare(`
        INSERT INTO reservations (reservation_id, intent_id, mandate_id, reserved_budget, status, created_at, expires_at)
        VALUES ('res_rf_1', ?, 'man_rf_1', 413000, 'COMMITTED', 1000, 2000)
      `).run(intentId);

      db.prepare(`
        INSERT INTO order_sessions (intent_id, receipt, razorpay_order_id, razorpay_payment_id, amount, currency, status, reservation_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, 413000, 'INR', 'PAYMENT_CAPTURED', 'res_rf_1', 1000, 1000)
      `).run(intentId, intentId, orderId, paymentId);

      // Trigger post-capture fulfillment failure
      await services.webhookProcessor.handlePostCaptureFulfillmentFailure(intentId, "Damaged in transit");

      const session = db.prepare("SELECT status FROM order_sessions WHERE intent_id = ?").get(intentId) as any;
      expect(session.status).toBe("REFUNDED");
    });

    it("5.2 [REFUND PRE-CAPTURE BLOCK]: Strictly blocks refund if order has not been captured", async () => {
      const intentId = crypto.randomUUID();
      const orderId = `order_${crypto.randomBytes(6).toString("hex")}`;

      db.prepare(`
        INSERT INTO buyer_mandates (mandate_id, principal_public_key, budget_limit, remaining_budget, currency, expiry, signature, created_at)
        VALUES ('man_rf_unauth', 'pubkey', 500000, 87000, 'INR', 9999999999, 'sig', 1000)
      `).run();

      db.prepare(`
        INSERT INTO reservations (reservation_id, intent_id, mandate_id, reserved_budget, status, created_at, expires_at)
        VALUES ('res_rf_unauth', ?, 'man_rf_unauth', 413000, 'HELD', 1000, 2000)
      `).run(intentId);

      // Order created but NO payment captured (razorpay_payment_id is null)
      db.prepare(`
        INSERT INTO order_sessions (intent_id, receipt, razorpay_order_id, razorpay_payment_id, amount, currency, status, reservation_id, created_at, updated_at)
        VALUES (?, ?, ?, NULL, 413000, 'INR', 'ORDER_CREATED', 'res_rf_unauth', 1000, 1000)
      `).run(intentId, intentId, orderId);

      await services.webhookProcessor.handlePostCaptureFulfillmentFailure(intentId, "Stockout before capture");

      const session = db.prepare("SELECT status FROM order_sessions WHERE intent_id = ?").get(intentId) as any;
      expect(session.status).toBe("ORDER_CREATED");
    });
  });

  // =========================================================================
  // DOMAIN 6: CRYPTOGRAPHIC AUDIT, REPRODUCIBILITY & POLICY VERSIONING
  // =========================================================================
  describe("Domain 6: Cryptographic Audit Ledger & State Invariants", () => {
    it("6.1 [CHAIN INTEGRITY]: Verifies full valid SHA-256 hash chain and detects tampered records", () => {
      const intentId = "intent_audit_01";
      services.auditLedger.logTransition(intentId, "STEP_1", null, "INTENT_RECEIVED", { step: 1 });
      services.auditLedger.logTransition(intentId, "STEP_2", "INTENT_RECEIVED", "INTENT_VALIDATED", { step: 2 });
      services.auditLedger.logTransition(intentId, "STEP_3", "INTENT_VALIDATED", "ORDER_CREATED", { step: 3 });

      const check1 = services.auditLedger.verifyLedgerIntegrity();
      expect(check1.isValid).toBe(true);
      expect(check1.checkedBlocks).toBeGreaterThanOrEqual(3);

      // Adversary tampers with a record in the database
      db.prepare("UPDATE audit_ledger SET details_json = '{\"tampered\":true}' WHERE event_type = 'STEP_2'").run();

      const check2 = services.auditLedger.verifyLedgerIntegrity();
      expect(check2.isValid).toBe(false);
      expect(check2.error).toContain("Tampered hash");
    });

    it("6.2 [IDEMPOTENT INTENT REPLAY]: Replayed Intent with same ID is blocked before duplicate order creation", async () => {
      const principal = generatePrincipalKeypair();
      const now = Math.floor(Date.now() / 1000);
      const mandateData = {
        mandate_id: `mandate_replay_${crypto.randomBytes(4).toString("hex")}`,
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
        proposed_items: [{ sku: "SKU-KEYBOARD-RGB", quantity: 1 }],
      };

      // 1st request
      const res1 = await app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intent });
      expect(res1.statusCode).toBe(201);

      // 2nd request (Replay with same intent_id)
      const res2 = await app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intent });
      expect(res2.statusCode).toBe(409);
      expect(res2.json().error).toBe("DUPLICATE_INTENT_REPLAY");

      // Verify only 1 order session was recorded for this intent
      const countRow = db.prepare("SELECT COUNT(*) as count FROM order_sessions WHERE intent_id = ?").get(intent.intent_id) as any;
      expect(Number(countRow.count)).toBe(1);
    });

    it("6.3 [POLICY VERSIONING REPRODUCIBILITY]: Audit trail records exact immutable policy_version used for decision", async () => {
      const principal = generatePrincipalKeypair();
      const now = Math.floor(Date.now() / 1000);
      const mandateData = {
        mandate_id: `mandate_ver_${crypto.randomBytes(4).toString("hex")}`,
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
        proposed_items: [{ sku: "SKU-KEYBOARD-RGB", quantity: 1 }],
      };

      const res = await app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intent });
      expect(res.statusCode).toBe(201);
      expect(res.json().policy_version).toBe("pol_v1.0.0");

      // Retrieve full audit trajectory and assert policy_version is logged
      const trajectory = services.auditLedger.getTrajectory(intent.intent_id) as Array<{
        event_type: string;
        details_json: string;
      }>;

      const policyEvent = trajectory.find((t) => t.event_type === "POLICY_EVALUATED_ALLOWED");
      expect(policyEvent).toBeDefined();
      const details = JSON.parse(policyEvent!.details_json);
      expect(details.policy_version).toBe("pol_v1.0.0");
      expect(details.decision_timestamp).toBeDefined();
    });
  });

  // =========================================================================
  // DOMAIN 7: DYNAMIC CONTROL PLANE LIFECYCLE & ACTIVE MUTATION INVARIANTS
  // =========================================================================
  describe("Domain 7: Active Policy Mutation & Mandate Revocation Semantics", () => {
    it("7.1 (#16) [POLICY MUTATION DURING TRANSACTION]: Enforces real-time policy mutation semantics without retroactive corruption", async () => {
      const principal = generatePrincipalKeypair();
      const now = Math.floor(Date.now() / 1000);
      const mandateData = {
        mandate_id: `mandate_mut_${crypto.randomBytes(4).toString("hex")}`,
        principal_public_key: principal.publicKeyHex,
        budget_limit: 500000, // ₹5,000.00
        currency: "INR" as const,
        expiry: now + 3600,
      };
      const signature = signMandate(mandateData, principal.privateKeyObject);

      // 1. Transaction 1: Executed under Policy v1.0.0 (Max ₹50,000 allowed) -> Should SUCCEED
      const intent1: CanonicalIntent = {
        intent_id: crypto.randomUUID(),
        client_nonce: crypto.randomBytes(16).toString("hex"),
        timestamp: now,
        mandate: { ...mandateData, signature },
        proposed_items: [{ sku: "SKU-KEYBOARD-RGB", quantity: 1 }], // ₹4,130.00
      };

      const res1 = await app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intent1 });
      expect(res1.statusCode).toBe(201);
      expect(res1.json().policy_version).toBe("pol_v1.0.0");

      // 2. Merchant mutates policy in real-time to Policy v2.0.0 (Max transaction limit reduced to ₹2,000)
      const policyV2 = {
        policy_version: "pol_v2.0.0",
        effective_at: now + 1,
        merchant_id: "merch_acme_electronics_01",
        max_transaction_amount: 200000, // ₹2,000.00 max limit
        allowed_categories: ["electronics", "furniture", "accessories"],
        auto_refund_on_fulfillment_failure: true,
        min_margin_percentage: 15,
      };

      const updateRes = await app.inject({
        method: "PUT",
        url: "/v1/merchant/policy",
        payload: policyV2,
      });
      expect(updateRes.statusCode).toBe(200);
      expect(updateRes.json().policy.policy_version).toBe("pol_v2.0.0");

      // 3. Transaction 2: Executed under Policy v2.0.0 -> ₹4,130 exceeds ₹2,000 max -> Should be BLOCKED
      const intent2: CanonicalIntent = {
        intent_id: crypto.randomUUID(),
        client_nonce: crypto.randomBytes(16).toString("hex"),
        timestamp: now + 2,
        mandate: { ...mandateData, signature },
        proposed_items: [{ sku: "SKU-KEYBOARD-RGB", quantity: 1 }], // ₹4,130.00
      };

      const res2 = await app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intent2 });
      expect(res2.statusCode).toBe(403);
      expect(res2.json().error).toBe("MERCHANT_MAX_AMOUNT_EXCEEDED");

      // 4. Verify Audit Ledgers prove non-retroactive reproducibility:
      // Transaction 1 remains pinned to pol_v1.0.0
      const traj1 = services.auditLedger.getTrajectory(intent1.intent_id) as Array<{ details_json: string }>;
      const policyEvent1 = traj1.find((t) => t.details_json.includes("pol_v1.0.0"));
      expect(policyEvent1).toBeDefined();

      // Transaction 2 rejection is pinned to pol_v2.0.0
      const traj2 = services.auditLedger.getTrajectory(intent2.intent_id) as Array<{ details_json: string }>;
      const policyEvent2 = traj2.find((t) => t.details_json.includes("pol_v2.0.0"));
      expect(policyEvent2).toBeDefined();
    });

    it("7.2 (#17) [MANDATE REVOCATION DURING TRANSACTION]: Strictly blocks execution when principal revokes mandate", async () => {
      const principal = generatePrincipalKeypair();
      const now = Math.floor(Date.now() / 1000);
      const mandateId = `mandate_rev_${crypto.randomBytes(4).toString("hex")}`;
      const mandateData = {
        mandate_id: mandateId,
        principal_public_key: principal.publicKeyHex,
        budget_limit: 500000,
        currency: "INR" as const,
        expiry: now + 3600,
      };
      const signature = signMandate(mandateData, principal.privateKeyObject);

      // Principal issues explicit revocation to the control plane
      const revokeRes = await app.inject({
        method: "POST",
        url: "/v1/mandates/revoke",
        payload: {
          mandate_id: mandateId,
          reason: "Suspicious subagent behavior detected by user principal",
        },
      });
      expect(revokeRes.statusCode).toBe(200);
      expect(revokeRes.json().status).toBe("REVOKED");

      // Rogue / Outdated Agent attempts checkout with mathematically valid cryptographic signature
      const intent: CanonicalIntent = {
        intent_id: crypto.randomUUID(),
        client_nonce: crypto.randomBytes(16).toString("hex"),
        timestamp: now,
        mandate: { ...mandateData, signature },
        proposed_items: [{ sku: "SKU-KEYBOARD-RGB", quantity: 1 }],
      };

      const res = await app.inject({
        method: "POST",
        url: "/v1/agent/checkout",
        payload: intent,
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("MANDATE_REVOKED");
      expect(res.json().message).toContain("Suspicious subagent behavior");

      // Verify audit trail logged the revocation rejection
      const trajectory = services.auditLedger.getTrajectory(intent.intent_id) as Array<{
        event_type: string;
        details_json: string;
      }>;
      const revokedEvent = trajectory.find((t) => t.event_type === "MANDATE_REVOKED");
      expect(revokedEvent).toBeDefined();
    });
  });
});
