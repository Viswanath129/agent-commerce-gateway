import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { initDatabase, type SqliteDatabase } from "../../store/db.js";
import { buildApp } from "../../server.js";
import { generatePrincipalKeypair, signMandate } from "../crypto.js";
import { AuditLedger } from "../../store/audit.js";
import type { CanonicalIntent, MerchantPolicy } from "../types.js";
import type { FastifyInstance } from "fastify";

describe("EMPIRICAL ADVERSARIAL CONCURRENCY & RACE-CONDITION CHALLENGE", () => {
  let app: FastifyInstance;
  let db: SqliteDatabase;
  let services: any;
  let defaultPolicy: MerchantPolicy;
  let keypair: ReturnType<typeof generatePrincipalKeypair>;

  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    process.env.RAZORPAY_WEBHOOK_SECRET = "rzp_webhook_secret_empirical_test";

    db = initDatabase(":memory:");
    defaultPolicy = {
      policy_version: "pol_empirical_v1",
      effective_at: Math.floor(Date.now() / 1000) - 3600,
      merchant_id: "merch_empirical_01",
      max_transaction_amount: 10000000,
      allowed_categories: ["electronics", "furniture", "accessories"],
      auto_refund_on_fulfillment_failure: true,
      min_margin_percentage: 10,
    };

    const built = await buildApp(db, defaultPolicy);
    app = built.app;
    services = built.services;
    await app.ready();
    keypair = generatePrincipalKeypair();
  });

  afterEach(async () => {
    await app.close();
  });

  function createMandate(budgetPaise = 5000000, expiryOffset = 3600) {
    const now = Math.floor(Date.now() / 1000);
    const mandateData = {
      mandate_id: `man_emp_${crypto.randomUUID()}`,
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

  // =========================================================================
  // 1. NONCE DEDUPLICATION & REPLAY ATTACK VECTORS
  // =========================================================================
  describe("1. Nonce Deduplication & Replay Protection", () => {
    it("1.1 Sequential Replay: Submitting identical nonce on same mandate is rejected with 409", async () => {
      const mandate = createMandate();
      const fixedNonce = `nonce_seq_${crypto.randomBytes(8).toString("hex")}`;
      const now = Math.floor(Date.now() / 1000);

      const intent1: CanonicalIntent = {
        intent_id: crypto.randomUUID(),
        client_nonce: fixedNonce,
        timestamp: now,
        mandate,
        proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
      };

      const res1 = await app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intent1 });
      expect([201, 202]).toContain(res1.statusCode);

      const intent2: CanonicalIntent = {
        intent_id: crypto.randomUUID(),
        client_nonce: fixedNonce,
        timestamp: now,
        mandate,
        proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
      };

      const res2 = await app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intent2 });
      expect(res2.statusCode).toBe(409);
      expect(res2.json().error).toBe("DUPLICATE_NONCE_REPLAY");
    });

    it("1.2 Concurrent Nonce Collision: 20 parallel requests racing with identical nonce -> exactly 1 accepted, remaining rejected with 409", async () => {
      const mandate = createMandate(10000000);
      const sharedNonce = `nonce_concurrent_${crypto.randomBytes(8).toString("hex")}`;
      const now = Math.floor(Date.now() / 1000);
      const CONCURRENCY = 20;

      const promises = Array.from({ length: CONCURRENCY }, () => {
        const intent: CanonicalIntent = {
          intent_id: crypto.randomUUID(),
          client_nonce: sharedNonce,
          timestamp: now,
          mandate,
          proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
        };
        return app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intent });
      });

      const responses = await Promise.all(promises);
      const accepted = responses.filter((r) => r.statusCode === 201 || r.statusCode === 202);
      const rejected409 = responses.filter((r) => r.statusCode === 409);
      const crashes500 = responses.filter((r) => r.statusCode === 500);

      // Invariant: Exactly 1 can be processed; zero 500 crashes
      expect(accepted.length).toBe(1);
      expect(rejected409.length).toBe(CONCURRENCY - 1);
      expect(crashes500.length).toBe(0);
    });

    it("1.3 Cross-Protocol Ingress Replay: Nonce used on /v1/agent/checkout is rejected on /v1/agent/ingress/mcp", async () => {
      const mandate = createMandate();
      const crossNonce = `nonce_cross_${crypto.randomBytes(8).toString("hex")}`;
      const now = Math.floor(Date.now() / 1000);

      const intent: CanonicalIntent = {
        intent_id: crypto.randomUUID(),
        client_nonce: crossNonce,
        timestamp: now,
        mandate,
        proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
      };

      const res1 = await app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intent });
      expect([201, 202]).toContain(res1.statusCode);

      // Now attempt to use same nonce through MCP protocol ingress
      const mcpPayload = {
        method: "tools/call",
        params: {
          name: "acg_checkout",
          arguments: {
            intent_id: crypto.randomUUID(),
            client_nonce: crossNonce,
            timestamp: now,
            mandate,
            items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
          },
        },
      };

      const res2 = await app.inject({ method: "POST", url: "/v1/agent/ingress/mcp", payload: mcpPayload });
      expect(res2.statusCode).toBe(409);
      expect(res2.json().error).toBe("DUPLICATE_NONCE_REPLAY");
    });
  });

  // =========================================================================
  // 2. DUAL-RESOURCE LOCKING & CONCURRENT DOUBLE-SPEND WARFARE
  // =========================================================================
  describe("2. Dual-Resource Locking & Double-Spend Warfare", () => {
    it("2.1 High Concurrency Inventory Race: 30 parallel checkouts racing for 1 unit of stock -> exactly 1 succeeds, stock remains 0 (never negative)", async () => {
      db.prepare("UPDATE catalog_items SET available_stock = 1 WHERE sku = 'SKU-KEYBOARD-RGB'").run();

      const mandate = createMandate(50000000);
      const now = Math.floor(Date.now() / 1000);
      const WORKERS = 30;

      const promises = Array.from({ length: WORKERS }, () => {
        const intent: CanonicalIntent = {
          intent_id: crypto.randomUUID(),
          client_nonce: `nonce_stock_${crypto.randomBytes(8).toString("hex")}`,
          timestamp: now,
          mandate,
          proposed_items: [{ sku: "SKU-KEYBOARD-RGB", quantity: 1 }],
        };
        return app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intent });
      });

      const responses = await Promise.all(promises);
      const successes = responses.filter((r) => r.statusCode === 201);
      const blocked = responses.filter((r) => r.statusCode === 409 || r.statusCode === 400);
      const crashes500 = responses.filter((r) => r.statusCode === 500);

      expect(successes.length).toBe(1);
      expect(blocked.length).toBe(WORKERS - 1);
      expect(crashes500.length).toBe(0);

      // Invariant: Available stock is strictly 0, never negative
      const stockRow = db.prepare("SELECT available_stock FROM catalog_items WHERE sku = 'SKU-KEYBOARD-RGB'").get() as any;
      expect(Number(stockRow.available_stock)).toBe(0);

      // Invariant: Exactly 1 HELD reservation exists
      const resCount = db.prepare("SELECT COUNT(*) as count FROM reservations WHERE status = 'HELD'").get() as any;
      expect(Number(resCount.count)).toBe(1);
    });

    it("2.2 High Concurrency Budget Depletion: 30 parallel checkouts vs tight budget (only 2 affordable) -> exactly 2 succeed, remaining budget never negative", async () => {
      // SKU-MOUSE-PRO is ₹2,124 (212,400 paise). Budget limit is 500,000 paise (can afford 2, not 3).
      const tightMandate = createMandate(500000);
      db.prepare("UPDATE catalog_items SET available_stock = 100 WHERE sku = 'SKU-MOUSE-PRO'").run();

      const now = Math.floor(Date.now() / 1000);
      const WORKERS = 30;

      const promises = Array.from({ length: WORKERS }, () => {
        const intent: CanonicalIntent = {
          intent_id: crypto.randomUUID(),
          client_nonce: `nonce_tight_${crypto.randomBytes(8).toString("hex")}`,
          timestamp: now,
          mandate: tightMandate,
          proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
        };
        return app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intent });
      });

      const responses = await Promise.all(promises);
      const successes = responses.filter((r) => r.statusCode === 201);
      const blocked = responses.filter((r) => r.statusCode === 409 || r.statusCode === 400);
      const crashes = responses.filter((r) => r.statusCode === 500);

      expect(successes.length).toBe(2);
      expect(blocked.length).toBe(WORKERS - 2);
      expect(crashes.length).toBe(0);

      // 500,000 - 2 * 212,400 = 75,200 paise
      const mandateRow = db.prepare("SELECT remaining_budget FROM buyer_mandates WHERE mandate_id = ?").get(tightMandate.mandate_id) as any;
      expect(Number(mandateRow.remaining_budget)).toBe(75200);
    });

    it("2.3 Partial Allocation Rollback: Multi-item checkout where 1 SKU is missing rolls back all SKU decrements", async () => {
      db.prepare("UPDATE catalog_items SET available_stock = 10 WHERE sku = 'SKU-MOUSE-PRO'").run();
      db.prepare("UPDATE catalog_items SET available_stock = 0 WHERE sku = 'SKU-KEYBOARD-RGB'").run();

      const mandate = createMandate();
      const now = Math.floor(Date.now() / 1000);

      const intent: CanonicalIntent = {
        intent_id: crypto.randomUUID(),
        client_nonce: crypto.randomBytes(16).toString("hex"),
        timestamp: now,
        mandate,
        proposed_items: [
          { sku: "SKU-MOUSE-PRO", quantity: 2 },
          { sku: "SKU-KEYBOARD-RGB", quantity: 1 },
        ],
      };

      const res = await app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intent });
      expect([400, 409]).toContain(res.statusCode);

      // Mouse stock must remain untouched at 10
      const stockRow = db.prepare("SELECT available_stock FROM catalog_items WHERE sku = 'SKU-MOUSE-PRO'").get() as any;
      expect(Number(stockRow.available_stock)).toBe(10);
    });
  });

  // =========================================================================
  // 3. WEBHOOK DEDUPLICATION & STATE TRANSITION CONCURRENCY
  // =========================================================================
  describe("3. Webhook Deduplication & State Machine Concurrency", () => {
    it("3.1 20 Concurrent Webhooks with identical payload -> exactly 1 PROCESSED, remaining DUPLICATE_IGNORED", async () => {
      const now = Math.floor(Date.now() / 1000);
      const mandateId = `man_wh_barrage_${crypto.randomUUID()}`;
      const intentId = `intent_wh_barrage_${crypto.randomUUID()}`;
      const reservationId = `res_wh_barrage_${crypto.randomUUID()}`;
      const orderId = `order_wh_barrage_${crypto.randomUUID()}`;
      const paymentId = `pay_wh_barrage_${crypto.randomUUID()}`;

      db.prepare(`
        INSERT INTO buyer_mandates (mandate_id, principal_public_key, budget_limit, remaining_budget, currency, expiry, signature, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(mandateId, keypair.publicKeyHex, 500000, 400000, "INR", now + 3600, "sig", Date.now());

      db.prepare(`
        INSERT INTO reservations (reservation_id, intent_id, mandate_id, reserved_budget, status, created_at, expires_at)
        VALUES (?, ?, ?, ?, 'HELD', ?, ?)
      `).run(reservationId, intentId, mandateId, 100000, Date.now(), Date.now() + 600000);

      db.prepare(`
        INSERT INTO order_sessions (intent_id, receipt, razorpay_order_id, razorpay_payment_id, amount, currency, status, reservation_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, 100000, 'INR', 'ORDER_CREATED', ?, ?, ?)
      `).run(intentId, intentId, orderId, null, reservationId, Date.now(), Date.now());

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

      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "rzp_webhook_secret_empirical_test";
      const rawBodyStr = JSON.stringify(webhookPayload);
      const signature = crypto.createHmac("sha256", webhookSecret).update(rawBodyStr).digest("hex");

      const PARALLEL_WEBHOOKS = 20;
      const promises = Array.from({ length: PARALLEL_WEBHOOKS }, (_, i) => {
        return app.inject({
          method: "POST",
          url: "/webhooks/razorpay",
          headers: {
            "content-type": "application/json",
            "x-razorpay-signature": signature,
            "x-razorpay-event-id": `evt_barrage_${i}`,
          },
          payload: rawBodyStr,
        });
      });

      const responses = await Promise.all(promises);
      const processed = responses.filter((r) => r.json().status === "PROCESSED");
      const duplicates = responses.filter((r) => r.json().status === "DUPLICATE_IGNORED");
      const crashes = responses.filter((r) => r.statusCode === 500);

      expect(processed.length).toBe(1);
      expect(duplicates.length).toBe(PARALLEL_WEBHOOKS - 1);
      expect(crashes.length).toBe(0);

      // Invariant: Session status transitioned to PAYMENT_CAPTURED and not duplicated
      const session = db.prepare("SELECT status FROM order_sessions WHERE intent_id = ?").get(intentId) as any;
      expect(session.status).toBe("PAYMENT_CAPTURED");

      // Invariant: Deduplication table contains exactly 1 entry for this order
      const eventCount = db.prepare("SELECT COUNT(*) as count FROM processed_webhook_events WHERE order_id = ?").get(orderId) as any;
      expect(Number(eventCount.count)).toBe(1);
    });

    it("3.2 Webhook against already REFUNDED session does not resurrect or mutate session state", async () => {
      const intentId = `intent_ref_${crypto.randomUUID()}`;
      const reservationId = `res_ref_${crypto.randomUUID()}`;
      const mandateId = `man_ref_${crypto.randomUUID()}`;
      const orderId = `order_ref_${crypto.randomUUID()}`;

      db.prepare(`
        INSERT INTO buyer_mandates (mandate_id, principal_public_key, budget_limit, remaining_budget, currency, expiry, signature, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(mandateId, keypair.publicKeyHex, 500000, 500000, "INR", Math.floor(Date.now() / 1000) + 3600, "sig", Date.now());

      db.prepare(`
        INSERT INTO reservations (reservation_id, intent_id, mandate_id, reserved_budget, status, created_at, expires_at)
        VALUES (?, ?, ?, ?, 'COMMITTED', ?, ?)
      `).run(reservationId, intentId, mandateId, 100000, Date.now(), Date.now() + 600000);

      db.prepare(`
        INSERT INTO order_sessions (intent_id, receipt, razorpay_order_id, razorpay_payment_id, amount, currency, status, reservation_id, created_at, updated_at)
        VALUES (?, ?, ?, 'pay_ref_123', 100000, 'INR', 'REFUNDED', ?, ?, ?)
      `).run(intentId, intentId, orderId, reservationId, Date.now(), Date.now());

      const webhookPayload = {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_late_resurrect",
              order_id: orderId,
              amount: 100000,
              status: "captured",
            },
          },
        },
      };

      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "rzp_webhook_secret_empirical_test";
      const rawBodyStr = JSON.stringify(webhookPayload);
      const signature = crypto.createHmac("sha256", webhookSecret).update(rawBodyStr).digest("hex");

      const res = await app.inject({
        method: "POST",
        url: "/webhooks/razorpay",
        headers: {
          "content-type": "application/json",
          "x-razorpay-signature": signature,
          "x-razorpay-event-id": "evt_late_attempt",
        },
        payload: rawBodyStr,
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().status).toBe("ERROR");

      // Invariant: Status remains REFUNDED
      const session = db.prepare("SELECT status FROM order_sessions WHERE intent_id = ?").get(intentId) as any;
      expect(session.status).toBe("REFUNDED");
    });
  });

  // =========================================================================
  // 4. AUDIT LEDGER HASH CHAIN INTEGRITY UNDER CONCURRENT WRITES
  // =========================================================================
  describe("4. Audit Ledger Cryptographic Hash Chain Under Concurrent Writes", () => {
    it("4.1 50 Concurrent Audit Writes maintain an unbroken, linear SHA-256 forward-chained hash ledger", async () => {
      const auditLedger = new AuditLedger(db);
      const CONCURRENT_WRITES = 50;

      const promises = Array.from({ length: CONCURRENT_WRITES }, (_, i) => {
        return new Promise<void>((resolve, reject) => {
          setImmediate(() => {
            try {
              auditLedger.logTransition(
                `intent_concurrent_audit_${i}`,
                `EVENT_CONCURRENT_${i % 4}`,
                "STATE_PREV" as any,
                "STATE_NEXT" as any,
                { index: i, nonce: crypto.randomBytes(8).toString("hex") }
              );
              resolve();
            } catch (err) {
              reject(err);
            }
          });
        });
      });

      await Promise.all(promises);

      const count = db.prepare("SELECT COUNT(*) as count FROM audit_ledger").get() as any;
      expect(Number(count.count)).toBe(CONCURRENT_WRITES);

      const verification = auditLedger.verifyLedgerIntegrity();
      expect(verification.isValid).toBe(true);
      expect(verification.checkedBlocks).toBe(CONCURRENT_WRITES);
      expect(verification.error).toBeUndefined();
    });

    it("4.2 Audit Ledger Tamper Oracle: Modifying any bit in block payload invalidates verification", () => {
      const auditLedger = new AuditLedger(db);

      auditLedger.logTransition("intent_oracle_1", "EVENT_1", null, "INTENT_RECEIVED", { step: 1 });
      auditLedger.logTransition("intent_oracle_2", "EVENT_2", "INTENT_RECEIVED", "ORDER_CREATED", { step: 2 });
      auditLedger.logTransition("intent_oracle_3", "EVENT_3", "ORDER_CREATED", "PAYMENT_CAPTURED", { step: 3 });

      expect(auditLedger.verifyLedgerIntegrity().isValid).toBe(true);

      // Adversary tampers with block 2
      db.prepare("UPDATE audit_ledger SET details_json = '{\"tampered\": true}' WHERE intent_id = 'intent_oracle_2'").run();

      const verification = auditLedger.verifyLedgerIntegrity();
      expect(verification.isValid).toBe(false);
      expect(verification.error).toContain("Tampered hash");
    });
  });
});
